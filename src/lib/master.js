// Master questionnaire = built-in questions + custom questions added from uploaded questionnaires.
// Custom questions live in the admin's browser and travel to clients inside the questionnaire link,
// so no database is needed. Export/Import keeps a copy you can back up or commit.
import { BUILT_IN_QUESTIONS, SECTIONS } from './questions.js';
import { lsGet, lsSet } from './idb.js';

const KEY = 'bkcg-master-custom';
export const EXTRA_SECTION = { id: 'additional', title: 'Additional questions', intro: 'A few more questions specific to this engagement.' };

export function loadCustom() {
  const v = lsGet(KEY, []);
  return Array.isArray(v) ? v.filter(validQuestion) : [];
}
export function saveCustom(list) { lsSet(KEY, list.filter(validQuestion)); }

const TYPES = ['short', 'long', 'choice', 'multi', 'rating', 'number', 'rank', 'file'];
export function validQuestion(q) {
  return q && typeof q.id === 'string' && q.id && typeof q.label === 'string' && q.label.trim() && TYPES.includes(q.type);
}

export function slugId(label, taken) {
  const base = 'x_' + String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'x_question';
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  return id;
}

// Normalize a question coming from AI / a file / the editor.
export function cleanQuestion(q, taken) {
  const type = TYPES.includes(q.type) ? q.type : 'long';
  const label = String(q.label || q.question || '').trim().slice(0, 300);
  const sectionIds = new Set([...SECTIONS.map((s) => s.id), EXTRA_SECTION.id]);
  const out = {
    id: q.id && !taken.has(q.id) ? String(q.id).replace(/[^\w]/g, '_').slice(0, 60) : slugId(label, taken),
    section: sectionIds.has(q.section) && q.section !== 'files' ? q.section : EXTRA_SECTION.id,
    type, label, custom: true,
  };
  if (q.help) out.help = String(q.help).slice(0, 300);
  if (q.example) out.example = String(q.example).slice(0, 400);
  if (['choice', 'multi', 'rank'].includes(type)) {
    out.options = (Array.isArray(q.options) ? q.options : String(q.options || '').split(/[,;\n]/)).map((o) => String(o).trim()).filter(Boolean).slice(0, 12);
    if (out.options.length < 2) { out.type = 'short'; delete out.options; }
  }
  if (type === 'number') out.unit = ['$', '%', 'months', 'days', 'people', 'customers'].includes(q.unit) ? q.unit : '';
  if (type === 'rating') { out.low = q.low || 'Low'; out.high = q.high || 'High'; }
  return out;
}

// Full question list for a questionnaire: built-ins + custom, in section order.
export function allQuestions(custom = loadCustom()) {
  const seen = new Set();
  const list = [...BUILT_IN_QUESTIONS, ...custom].filter((q) => (seen.has(q.id) ? false : seen.add(q.id)));
  const order = [...SECTIONS.map((s) => s.id).filter((id) => id !== 'files'), EXTRA_SECTION.id, 'files'];
  return order.flatMap((sid) => list.filter((q) => q.section === sid));
}

export function allSections(questions) {
  const used = new Set(questions.map((q) => q.section));
  const order = [...SECTIONS.filter((s) => s.id !== 'files'), EXTRA_SECTION, SECTIONS.find((s) => s.id === 'files')];
  return order.filter((s) => used.has(s.id));
}

// Add new questions to the master (the chosen setting: always add to master).
export function addToMaster(newQs) {
  const custom = loadCustom();
  const taken = new Set(allQuestions(custom).map((q) => q.id));
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const byLabel = new Map(allQuestions(custom).map((q) => [norm(q.label), q.id]));
  const added = [];
  // ids[i] is the master id that new question i ended up with (an existing one if it was a duplicate).
  const ids = newQs.map((q) => {
    const k = norm(q.label || q.question || '');
    if (!k) return null;
    if (byLabel.has(k)) return byLabel.get(k);
    const c = cleanQuestion(q, taken);
    taken.add(c.id); byLabel.set(k, c.id);
    custom.push(c); added.push(c);
    return c.id;
  });
  saveCustom(custom);
  return { added, ids };
}
