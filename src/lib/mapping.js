// Turn any completed questionnaire (Word, PDF, Excel, CSV, text) into plain text, then ask an AI
// to map it onto the master questions. New questions it finds are added to the master.
import { SECTIONS } from './questions.js';
import { EXTRA_SECTION } from './master.js';
import { extractJson } from './deckModel.js';

export const MAP_MARKER = 'QUESTIONNAIRE MAPPING TASK';
const MAX_DOC = 90000;

export async function extractText(file) {
  const name = (file.name || '').toLowerCase();
  if (/\.(docx)$/.test(name)) {
    const m = await import('mammoth/mammoth.browser.js');
    const mammoth = m.default || m;
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }
  if (/\.pdf$/.test(name)) {
    const pdfjs = await import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      let line = '', lastY = null;
      const lines = [];
      tc.items.forEach((it) => {
        const y = Math.round(it.transform?.[5] ?? 0);
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
        line += (line && !line.endsWith(' ') ? ' ' : '') + it.str;
        lastY = y;
      });
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
    }
    if (!pages.join('').trim()) throw new Error('That PDF has no selectable text (it is probably a scan). Ask for a Word or text version, or paste the text into a .txt file.');
    return pages.join('\n\n');
  }
  if (/\.(xlsx|xlsm)$/.test(name)) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const out = [];
    wb.eachSheet((ws) => {
      out.push(`## Sheet: ${ws.name}`);
      ws.eachRow((row) => {
        const cells = (row.values || []).slice(1).map(cellText).filter((v) => v !== '');
        if (cells.length) out.push(cells.join(' | '));
      });
    });
    return out.join('\n');
  }
  if (/\.(doc|xls|ppt|pptx|pages|numbers)$/.test(name)) throw new Error('That file type cannot be read in the browser. Save it as .docx, .pdf, .xlsx or .txt and try again.');
  const text = await file.text();
  return /\.html?$/.test(name) ? text.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dt|dd)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') : text;
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if (v.text) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

export function buildMappingPrompt(questions, docText, fileName) {
  const qs = questions.filter((q) => q.type !== 'file').map((q) => {
    const extra = q.options ? ` | options: ${q.options.join(' / ')}` : q.unit ? ` | unit: ${q.unit}` : q.type === 'rating' ? ` | 1 = ${q.low || 'low'}, 5 = ${q.high || 'high'}` : '';
    return `- ${q.id} | ${q.type} | ${q.label}${extra}`;
  }).join('\n');
  const sections = [...SECTIONS.filter((s) => s.id !== 'files'), EXTRA_SECTION].map((s) => `${s.id} (${s.title})`).join(', ');
  const doc = String(docText || '').slice(0, MAX_DOC);
  return `${MAP_MARKER} (from "${fileName}")
Below are (1) the questions in our questionnaire, as "id | type | question", and (2) the text of a questionnaire a client completed, in some other format. Match each answer in the document to the question it answers.

QUESTIONS
${qs}

DOCUMENT
<<<
${doc}
>>>${docText.length > MAX_DOC ? '\n(document truncated)' : ''}

RULES
- Only use answers that are in the document. Leave out questions it does not answer. Never invent.
- Answer format by type: number → plain number (1.2M → 1200000; 18% → 18); rating → whole number 1–5 (convert other scales, e.g. 8/10 → 4); choice → exactly one of the listed options (closest match); multi → array of listed options; rank → array of the listed options in the client's order; short/long → the client's own words, trimmed.
- If the document answers something that is NOT on the list, add it to newQuestions: rewrite the label as a clear question, pick a type, pick a section id from: ${sections}, and include the answer.
- In "uncertain", list ids where the match or conversion is a judgment call.

OUTPUT FORMAT: one JSON object in a \`\`\`json block, nothing else:
{"answers": {"<question id>": <answer>}, "newQuestions": [{"label": "", "type": "short|long|choice|multi|rating|number|rank", "section": "", "options": [], "unit": "", "answer": null}], "uncertain": [], "notes": ""}`;
}

export function looksLikeMappingPrompt(text) {
  return String(text).includes(MAP_MARKER) && String(text).includes('<<<');
}

export function parseMapping(text) {
  const j = extractJson(text);
  if (!j || typeof j !== 'object') return null;
  const answers = j.answers && typeof j.answers === 'object' && !Array.isArray(j.answers) ? j.answers : {};
  const newQuestions = (Array.isArray(j.newQuestions) ? j.newQuestions : []).filter((q) => q && (q.label || q.question)).slice(0, 60);
  return { answers, newQuestions, uncertain: Array.isArray(j.uncertain) ? j.uncertain.map(String) : [], notes: String(j.notes || '').slice(0, 2000) };
}

// Coerce one mapped answer to the stored format for its question (returns undefined if unusable).
export function coerceAnswer(q, v) {
  if (v === null || v === undefined || v === '') return undefined;
  if (q.type === 'number') { const n = Number(String(v).replace(/[$,%\s]/g, '')); return Number.isFinite(n) ? n : String(v); }
  if (q.type === 'rating') { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : undefined; }
  if (q.type === 'multi' || q.type === 'rank') {
    const arr = (Array.isArray(v) ? v : String(v).split(/[,;\n]/)).map((x) => String(x).trim()).filter(Boolean);
    const opts = q.options || [];
    const matched = arr.map((x) => opts.find((o) => o.toLowerCase() === x.toLowerCase()) || x).filter((x) => q.type === 'multi' || opts.includes(x));
    return matched.length ? [...new Set(matched)] : undefined;
  }
  if (q.type === 'choice') {
    const s = String(v).trim();
    return (q.options || []).find((o) => o.toLowerCase() === s.toLowerCase()) || s;
  }
  if (q.type === 'file') return undefined;
  return typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join(', ') : String(v);
}
