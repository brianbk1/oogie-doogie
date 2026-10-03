import { useState } from 'react';
import { BUILT_IN_QUESTIONS, SECTIONS, TYPE_LABELS, UNITS } from '../lib/questions.js';
import { loadCustom, saveCustom, cleanQuestion, allQuestions, EXTRA_SECTION } from '../lib/master.js';
import { downloadBlob } from '../lib/download.js';

const SECTION_OPTS = [...SECTIONS.filter((s) => s.id !== 'files'), EXTRA_SECTION];

// Questions you have added (by hand or from uploaded questionnaires). Built-in questions are fixed in
// src/lib/questions.js; added questions travel to clients inside each new link.
export default function MasterQuestions() {
  const [list, setList] = useState(loadCustom);
  const [msg, setMsg] = useState(null);
  const commit = (next) => { setList(next); saveCustom(next); };
  const patch = (i, p) => commit(list.map((q, j) => (j === i ? { ...q, ...p } : q)));

  function add() {
    const taken = new Set(allQuestions(list).map((q) => q.id));
    commit([...list, cleanQuestion({ label: 'New question', type: 'long', section: EXTRA_SECTION.id }, taken)]);
  }

  async function importJson(file) {
    try {
      const data = JSON.parse(await file.text());
      const arr = Array.isArray(data) ? data : data.questions || [];
      const taken = new Set(allQuestions(list).map((q) => q.id));
      const labels = new Set(allQuestions(list).map((q) => q.label.toLowerCase()));
      const fresh = arr.filter((q) => q && q.label && !labels.has(String(q.label).toLowerCase())).map((q) => { const c = cleanQuestion(q, taken); taken.add(c.id); return c; });
      commit([...list, ...fresh]);
      setMsg({ kind: 'tip', text: `Added ${fresh.length} question${fresh.length === 1 ? '' : 's'}.` });
    } catch { setMsg({ kind: 'warn', text: 'That is not a question list exported from this app.' }); }
  }

  return (
    <div className="deck" style={{ maxWidth: 1000 }}>
      <h1>Master questionnaire</h1>
      <p className="muted" style={{ margin: 0 }}>{BUILT_IN_QUESTIONS.length} built-in questions across {SECTIONS.length} sections, plus {list.length} you have added. Added questions appear in their chosen section for every new link. Links already sent keep the questions they had.</p>
      <div className="row tight">
        <button className="btn primary" onClick={add}>+ Add question</button>
        <button className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify({ format: 'bkcg-questions', questions: list }, null, 2)], { type: 'application/json' }), 'bkcg-added-questions.json')}>Export added questions</button>
        <label className="btn">Import…<input type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} /></label>
      </div>
      {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
      <div className="card">
        {list.length === 0 && <p className="muted" style={{ margin: 0 }}>No added questions yet. Import a completed questionnaire in another format and any questions it answers that you do not ask are added here automatically.</p>}
        {list.map((q, i) => (
          <div key={q.id} className="qedit">
            <div className="field">
              <input aria-label="Question" value={q.label} onChange={(e) => patch(i, { label: e.target.value })} />
              {['choice', 'multi', 'rank'].includes(q.type) && <input aria-label="Options" value={(q.options || []).join(', ')} placeholder="Options, comma-separated" onChange={(e) => patch(i, { options: e.target.value.split(',').map((s) => s.trim()) })} />}
              {q.type === 'number' && <select aria-label="Unit" value={q.unit || ''} onChange={(e) => patch(i, { unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{u || 'no unit'}</option>)}</select>}
            </div>
            <select aria-label="Type" value={q.type} onChange={(e) => patch(i, { type: e.target.value, ...(['choice', 'multi', 'rank'].includes(e.target.value) && !q.options ? { options: ['Option A', 'Option B'] } : {}) })}>{Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select aria-label="Section" value={q.section} onChange={(e) => patch(i, { section: e.target.value })}>{SECTION_OPTS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
            <button className="icon-btn" aria-label={`Delete ${q.label}`} onClick={() => commit(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
