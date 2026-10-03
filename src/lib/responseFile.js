// The response file a client downloads and emails back: a .zip holding
//   responses.json  — machine-readable answers (what the admin view imports)
//   answers.html    — a readable copy the client can open and keep
//   files/...       — any documents they attached
// The same format doubles as a "save progress" file the client can reload later.
import { formatAnswer, isAnswered } from './questions.js';
import { allSections } from './master.js';

export const FORMAT = 'bkcg-kickoff-response';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safe = (s) => String(s || '').replace(/[^\w.\- ]+/g, '_').trim().slice(0, 80) || 'file';

export function responseFileName(company, complete) {
  const stem = String(company || 'company').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'company';
  const d = new Date().toISOString().slice(0, 10);
  return `${complete ? 'BKCG-responses' : 'BKCG-progress'}-${stem}-${d}.zip`;
}

// answers: { qid: value }; for file questions value = [{ name, size, type, key }] and blobs come from getBlob(key)
export async function buildResponseZip({ link, questions, answers, complete, getBlob }) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const fileMeta = {};
  for (const q of questions.filter((x) => x.type === 'file')) {
    const list = Array.isArray(answers[q.id]) ? answers[q.id] : [];
    fileMeta[q.id] = [];
    for (const f of list) {
      const blob = await getBlob(f.key);
      if (!blob) continue;
      const path = `files/${q.id}/${safe(f.name)}`;
      zip.file(path, blob);
      fileMeta[q.id].push({ name: f.name, size: f.size, type: f.type, path });
    }
  }
  const plain = { ...answers };
  Object.keys(fileMeta).forEach((k) => { plain[k] = fileMeta[k]; });
  const company = String(answers.company_name || link?.company || '').trim();
  const doc = {
    format: FORMAT, version: 1, linkId: link?.id || 'open', company,
    complete: !!complete, savedAt: new Date().toISOString(),
    questions: questions.map(({ id, section, type, label, options, unit, low, high, custom }) => ({ id, section, type, label, options, unit, low, high, custom })),
    answers: plain,
  };
  zip.file('responses.json', JSON.stringify(doc, null, 2));
  zip.file('answers.html', readableHtml(doc));
  return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), doc };
}

function readableHtml(doc) {
  const sections = allSections(doc.questions);
  const rows = sections.map((s) => {
    const qs = doc.questions.filter((q) => q.section === s.id);
    return `<h2>${esc(s.title)}</h2><dl>${qs.map((q) => `<dt>${esc(q.label)}</dt><dd>${esc(formatAnswer(q, doc.answers[q.id])) || '<em>—</em>'}</dd>`).join('')}</dl>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><title>${esc(doc.company)} — pre-kickoff answers</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#1d2430}h1{font-family:Georgia,serif;color:#17365D}h2{font-family:Georgia,serif;color:#17365D;border-bottom:1px solid #dcdfe2;padding-bottom:4px;margin-top:32px}dt{font-weight:600;margin-top:12px}dd{margin:2px 0 0;white-space:pre-wrap}</style>
<h1>${esc(doc.company || 'Pre-kickoff questionnaire')}</h1><p>The BK Consulting Group · pre-kickoff questionnaire · saved ${esc(doc.savedAt.slice(0, 10))}${doc.complete ? '' : ' (in progress)'}</p>${rows}`;
}

// Read a response file (.zip or .json). Returns { doc, blobs: { path: Blob } } or null if it is not one.
export async function readResponseFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.json')) {
    try {
      const doc = JSON.parse(await file.text());
      return doc?.format === FORMAT ? { doc, blobs: {} } : null;
    } catch { return null; }
  }
  if (!name.endsWith('.zip')) return null;
  const { default: JSZip } = await import('jszip');
  let zip;
  try { zip = await JSZip.loadAsync(file); } catch { return null; }
  const entry = zip.file('responses.json');
  if (!entry) return null;
  let doc;
  try { doc = JSON.parse(await entry.async('string')); } catch { return null; }
  if (doc?.format !== FORMAT) return null;
  const blobs = {};
  for (const q of Object.values(doc.answers || {})) {
    if (!Array.isArray(q)) continue;
    for (const f of q) {
      if (f && f.path && zip.file(f.path)) blobs[f.path] = new Blob([await zip.file(f.path).async('arraybuffer')], { type: f.type || 'application/octet-stream' });
    }
  }
  return { doc, blobs };
}

export function answeredCount(questions, answers) {
  return questions.filter((q) => isAnswered(q, answers[q.id])).length;
}
