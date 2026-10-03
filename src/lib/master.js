// Master questionnaire = a template's built-in questions + custom questions you added (by hand or
// from uploaded questionnaires). Custom questions live in your browser, are tagged with their
// template, and travel to clients inside the questionnaire link, so no database is needed.
import { TEMPLATES, DEFAULT_TEMPLATE, templateOf, SECTION_REGISTRY } from './templates.js';
import { lsGet, lsSet } from './idb.js';

const KEY = 'bkcg-master-custom';
export const EXTRA_SECTION = { id: 'additional', title: 'Additional questions', intro: 'A few more questions specific to this engagement.' };

export const tplOf = (q) => q.template || DEFAULT_TEMPLATE;

// ---------------------------------------------------------------- Imported versions
// A version replaces a template's built-in questions (you edit the questionnaire in Excel and import it).
// It lives in your browser and travels to clients inside the link, like added questions do.
const vkey = (t) => `bkcg-version-${t}`;
export function loadVersion(template) {
  const v = lsGet(vkey(template), null);
  return v && Array.isArray(v.questions) && v.questions.length ? v : null;
}
export function saveVersion(template, version) {
  const prev = loadVersion(template);
  if (prev) lsSet(`${vkey(template)}-previous`, prev);
  return lsSet(vkey(template), version);
}
export function clearVersion(template) {
  const prev = loadVersion(template);
  if (prev) lsSet(`${vkey(template)}-previous`, prev);
  try { localStorage.removeItem(vkey(template)); } catch { /* ignore */ }
}
export function restorePreviousVersion(template) {
  const prev = lsGet(`${vkey(template)}-previous`, null);
  if (!prev) return false;
  lsSet(vkey(template), prev);
  return true;
}
export function hasPreviousVersion(template) { return !!lsGet(`${vkey(template)}-previous`, null); }

// The questions a template starts from: an explicit base (from a client link), your imported version, or the standard set.
export function baseQuestions(template = DEFAULT_TEMPLATE, base = null) {
  if (Array.isArray(base) && base.length) return base;
  return loadVersion(template)?.questions || templateOf(template).questions;
}

const normLabel = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BUILT_IN_LABELS = new Set(Object.values(TEMPLATES).flatMap((t) => t.questions.map((q) => normLabel(q.label))));

export function loadCustom(template = null) {
  const v = lsGet(KEY, []);
  let list = Array.isArray(v) ? v.filter(validQuestion) : [];
  // Questions that are now built in (e.g. the sample questions you imported) are dropped so nothing shows twice.
  const kept = list.filter((q) => !BUILT_IN_LABELS.has(normLabel(q.label)));
  if (kept.length !== list.length) { lsSet(KEY, kept); list = kept; }
  return template ? list.filter((q) => tplOf(q) === template) : list;
}
export function saveCustom(list) { lsSet(KEY, list.filter(validQuestion)); }
// Replace the custom questions of one template, keeping the others.
export function saveCustomFor(template, list) {
  saveCustom([...loadCustom().filter((q) => tplOf(q) !== template), ...list.map((q) => ({ ...q, template }))]);
}

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

// Sections a template's questions can go in (for editors and the AI mapping prompt).
export function sectionOptions(template = DEFAULT_TEMPLATE) {
  const v = loadVersion(template);
  if (v) return [...allSections(v.questions).filter((s) => s.id !== 'files' && s.id !== EXTRA_SECTION.id), EXTRA_SECTION];
  return [...templateOf(template).sections.filter((s) => s.id !== 'files'), EXTRA_SECTION];
}

// Normalize a question coming from AI / a file / the editor.
export function cleanQuestion(q, taken, template = DEFAULT_TEMPLATE) {
  const type = TYPES.includes(q.type) ? q.type : 'long';
  const label = String(q.label || q.question || '').trim().slice(0, 300);
  const sectionIds = new Set(sectionOptions(template).map((s) => s.id));
  const out = {
    id: q.id && !taken.has(q.id) ? String(q.id).replace(/[^\w]/g, '_').slice(0, 60) : slugId(label, taken),
    section: sectionIds.has(q.section) ? q.section : EXTRA_SECTION.id,
    type, label, custom: true, template,
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

// Full question list for a template: built-ins + that template's custom questions, in section order.
export function allQuestions(custom = null, template = DEFAULT_TEMPLATE, base = null) {
  const t = templateOf(template);
  const core = baseQuestions(t.id, base);
  const extra = (custom ?? loadCustom(t.id)).filter((q) => tplOf(q) === t.id);
  const seen = new Set();
  const list = [...core, ...extra].filter((q) => (seen.has(q.id) ? false : seen.add(q.id)));
  const order = [];
  [...core.map((q) => q.section), ...t.sections.map((s) => s.id), ...extra.map((q) => q.section)].forEach((id) => { if (id !== 'files' && id !== EXTRA_SECTION.id && !order.includes(id)) order.push(id); });
  order.push(EXTRA_SECTION.id, 'files');
  return order.flatMap((sid) => list.filter((q) => q.section === sid));
}

// Sections used by a question list, in the order the questions appear (files always last).
export function allSections(questions) {
  const order = [];
  questions.forEach((q) => { if (!order.includes(q.section)) order.push(q.section); });
  const sorted = [...order.filter((id) => id !== 'files'), ...order.filter((id) => id === 'files')];
  return sorted.map((id) => {
    if (id === EXTRA_SECTION.id) return EXTRA_SECTION;
    const own = questions.find((q) => q.section === id && q.sectionTitle);
    if (own) return { id, title: own.sectionTitle, intro: own.sectionIntro || SECTION_REGISTRY.get(id)?.intro || '' };
    return SECTION_REGISTRY.get(id) || { id, title: id.replace(/^sec_/, '').replace(/[_-]+/g, ' ') };
  });
}

// Add new questions to a template's master (the chosen setting: always add to master).
export function addToMaster(newQs, template = DEFAULT_TEMPLATE) {
  const custom = loadCustom(template);
  const taken = new Set([...allQuestions(custom, template), ...loadCustom()].map((q) => q.id));
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const byLabel = new Map(allQuestions(custom, template).map((q) => [norm(q.label), q.id]));
  const added = [];
  // ids[i] is the master id that new question i ended up with (an existing one if it was a duplicate).
  const ids = newQs.map((q) => {
    const k = norm(q.label || q.question || '');
    if (!k) return null;
    if (byLabel.has(k)) return byLabel.get(k);
    const c = cleanQuestion(q, taken, template);
    taken.add(c.id); byLabel.set(k, c.id);
    custom.push(c); added.push(c);
    return c.id;
  });
  saveCustomFor(template, custom);
  return { added, ids };
}

export { TEMPLATES, DEFAULT_TEMPLATE, templateOf };
