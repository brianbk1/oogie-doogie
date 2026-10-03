// Edit a questionnaire in Excel: download the current version, change it, import it back as a new version.
import { allQuestions, allSections, EXTRA_SECTION, templateOf } from './master.js';
import { SECTION_REGISTRY } from './templates.js';

const TYPES = ['short', 'long', 'choice', 'multi', 'rating', 'number', 'rank', 'file'];
const UNITS = ['', '$', '%', 'months', 'days', 'people', 'customers'];
const NAVY = 'FF17365D', INK3 = 'FF737B88';
const COLS = [
  { key: 'section', header: 'Section', width: 26 },
  { key: 'label', header: 'Question', width: 60 },
  { key: 'type', header: 'Type', width: 10 },
  { key: 'options', header: 'Options (comma-separated)', width: 40 },
  { key: 'unit', header: 'Unit', width: 9 },
  { key: 'low', header: '1 means', width: 14 },
  { key: 'high', header: '5 means', width: 14 },
  { key: 'help', header: 'Help text', width: 36 },
  { key: 'example', header: 'Example of a good answer', width: 44 },
  { key: 'required', header: 'Required', width: 9 },
  { key: 'id', header: 'ID (leave as is)', width: 22 },
];
const HEADER_ROW = 4;

export async function questionnaireWorkbookBlob(template) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'The BK Consulting Group';
  const ws = wb.addWorksheet('Questions', { views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }] });
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));
  ws.mergeCells(1, 1, 1, 6);
  ws.getCell(1, 1).value = `${templateOf(template).label} questionnaire`;
  ws.getCell(1, 1).font = { name: 'Georgia', size: 16, bold: true, color: { argb: NAVY } };
  ws.mergeCells(2, 1, 2, COLS.length);
  ws.getCell(2, 1).value = 'Edit, add, reorder or delete rows, then import this file as a new version. One row per question; questions appear in this order. Type: short, long, choice, multi, rating, number, rank or file. Leave the ID of existing questions unchanged (charts and checks rely on them); leave it blank for new questions. A new section name creates a new section.';
  ws.getCell(2, 1).font = { size: 10, italic: true, color: { argb: INK3 } };
  ws.getCell(2, 1).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(2).height = 44;
  const head = ws.getRow(HEADER_ROW);
  COLS.forEach((c, i) => { head.getCell(i + 1).value = c.header; });
  head.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  head.height = 30;

  const questions = allQuestions(null, template);
  const titles = Object.fromEntries(allSections(questions).map((s) => [s.id, s.title]));
  let r = HEADER_ROW + 1;
  questions.forEach((q) => {
    const row = ws.getRow(r++);
    const v = { section: titles[q.section] || q.section, label: q.label, type: q.type, options: (q.options || []).join(', '), unit: q.unit || '', low: q.low || '', high: q.high || '', help: q.help || '', example: q.example || '', required: q.required ? 'Yes' : '', id: q.id };
    COLS.forEach((c, i) => { row.getCell(i + 1).value = v[c.key]; row.getCell(i + 1).alignment = { wrapText: true, vertical: 'top' }; });
  });
  const last = Math.max(r + 50, HEADER_ROW + 200);
  ws.dataValidations.add(`C${HEADER_ROW + 1}:C${last}`, { type: 'list', allowBlank: true, formulae: [`"${TYPES.join(',')}"`], showErrorMessage: true, errorTitle: 'Type', error: `Use one of: ${TYPES.join(', ')}` });
  ws.dataValidations.add(`E${HEADER_ROW + 1}:E${last}`, { type: 'list', allowBlank: true, formulae: ['"$,%,months,days,people,customers"'] });
  ws.dataValidations.add(`J${HEADER_ROW + 1}:J${last}`, { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] });
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: COLS.length } };
  const meta = wb.addWorksheet('meta', { state: 'veryHidden' });
  meta.getCell('A1').value = 'bkcg-questionnaire-definition';
  meta.getCell('A2').value = template;
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if (v.text) return String(v.text);
  }
  return String(v).trim();
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

// Reads an edited questionnaire (Excel from questionnaireWorkbookBlob, or JSON exported by this app).
// Returns { questions, warnings, sectionCount } or throws with a readable message.
export async function readQuestionnaireFile(file, template) {
  const name = (file.name || '').toLowerCase();
  let rows = [];
  if (name.endsWith('.json')) {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list)) throw new Error('That JSON file has no "questions" list.');
    rows = list.map((q) => ({ ...q, section: q.sectionTitle || q.section, options: Array.isArray(q.options) ? q.options.join(', ') : q.options || '' }));
  } else if (name.endsWith('.xlsx')) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.getWorksheet('Questions') || wb.worksheets[0];
    let headerRow = 0;
    const idx = {};
    ws.eachRow((row, n) => {
      if (headerRow) return;
      const vals = (row.values || []).map(text);
      if (vals.some((v) => /^question$/i.test(v))) {
        headerRow = n;
        vals.forEach((v, i) => {
          const c = COLS.find((x) => x.header.toLowerCase() === v.toLowerCase() || (x.key === 'id' && /^id\b/i.test(v)) || (x.key === 'options' && /^options/i.test(v)) || (x.key === 'example' && /^example/i.test(v)) || (x.key === 'help' && /^help/i.test(v)));
          if (c) idx[c.key] = i;
        });
      }
    });
    if (!headerRow || !idx.label) throw new Error('Could not find a “Question” column. Start from “Download questionnaire (Excel)” and edit that file.');
    ws.eachRow((row, n) => {
      if (n <= headerRow) return;
      const vals = row.values || [];
      const g = (k) => (idx[k] ? text(vals[idx[k]]) : '');
      if (!g('label')) return;
      rows.push({ section: g('section'), label: g('label'), type: g('type'), options: g('options'), unit: g('unit'), low: g('low'), high: g('high'), help: g('help'), example: g('example'), required: g('required'), id: g('id') });
    });
  } else {
    throw new Error('Import an .xlsx (from “Download questionnaire”) or a .json file.');
  }
  if (rows.length < 3) throw new Error('That file has fewer than 3 questions — nothing was changed.');

  const warnings = [];
  const registryByTitle = new Map([...SECTION_REGISTRY.values(), EXTRA_SECTION].map((s) => [s.title.toLowerCase(), s.id]));
  const sectionIds = new Map();
  const taken = new Set();
  const questions = rows.map((r, i) => {
    const title = r.section || 'Questions';
    let sid = sectionIds.get(title.toLowerCase());
    if (!sid) {
      sid = /^documents\b/i.test(title) ? 'files' : registryByTitle.get(title.toLowerCase()) || `sec_${slug(title) || i}`;
      sectionIds.set(title.toLowerCase(), sid);
    }
    let type = String(r.type || '').toLowerCase().trim();
    if (!TYPES.includes(type)) { if (r.type) warnings.push(`Row “${r.label.slice(0, 40)}”: type “${r.type}” is not valid, used long text.`); type = r.options ? 'choice' : 'long'; }
    let id = String(r.id || '').replace(/[^\w]/g, '_').slice(0, 60);
    if (!id || taken.has(id)) id = `q_${slug(r.label) || i}`;
    while (taken.has(id)) id = `${id}_2`;
    taken.add(id);
    const q = { id, section: sid, sectionTitle: title, type, label: r.label.slice(0, 300) };
    if (r.help) q.help = String(r.help).slice(0, 300);
    if (r.example) q.example = String(r.example).slice(0, 500);
    if (/^(yes|y|true|1)$/i.test(String(r.required || ''))) q.required = true;
    if (['choice', 'multi', 'rank'].includes(type)) {
      q.options = String(r.options || '').split(/[,;\n]/).map((o) => o.trim()).filter(Boolean).slice(0, 15);
      if (q.options.length < 2) { warnings.push(`“${r.label.slice(0, 40)}” needs at least 2 options — changed to short text.`); q.type = 'short'; delete q.options; }
    }
    if (type === 'number') q.unit = UNITS.includes(r.unit) ? r.unit : '';
    if (type === 'rating') { q.low = r.low || 'Low'; q.high = r.high || 'High'; }
    if (type === 'file') q.section = 'files';
    return q;
  });
  if (!questions.some((q) => q.id === 'company_name')) {
    questions.unshift({ id: 'company_name', section: questions[0].section, sectionTitle: questions[0].sectionTitle, type: 'short', label: 'Company name', required: true });
    warnings.push('Added “Company name” at the top — every questionnaire needs it.');
  }
  return { questions, warnings, sectionCount: new Set(questions.map((q) => q.section)).size };
}
