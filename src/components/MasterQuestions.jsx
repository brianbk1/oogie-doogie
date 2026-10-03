import { useState } from 'react';
import { TYPE_LABELS, UNITS } from '../lib/questions.js';
import { loadCustom, saveCustomFor, cleanQuestion, allQuestions, allSections, EXTRA_SECTION, sectionOptions, TEMPLATES, templateOf, loadVersion, saveVersion, clearVersion, restorePreviousVersion, hasPreviousVersion } from '../lib/master.js';
import { questionnaireWorkbookBlob, readQuestionnaireFile } from '../lib/versions.js';
import { downloadBlob } from '../lib/download.js';


// Questions you have added (by hand or from uploaded questionnaires). Built-in questions are fixed in
// src/lib/questions.js; added questions travel to clients inside each new link.
export default function MasterQuestions() {
  const [tpl, setTpl] = useState('strategy');
  const [list, setList] = useState(() => loadCustom('strategy'));
  const [msg, setMsg] = useState(null);
  const [, bump] = useState(0);
  const [arm, setArm] = useState('');
  const T = templateOf(tpl);
  const version = loadVersion(tpl);
  const current = allQuestions(null, tpl);
  const sectionCount = allSections(current).length;
  const confirmArm = (key, fn) => { if (arm !== key) { setArm(key); setTimeout(() => setArm((a) => (a === key ? '' : a)), 4000); return; } setArm(''); fn(); };

  async function downloadXlsx() {
    downloadBlob(await questionnaireWorkbookBlob(tpl), `${T.label.replace(/\s+/g, '-')}-questionnaire${version ? '-custom' : ''}.xlsx`);
    setMsg({ kind: 'tip', text: 'Downloaded. Edit the questions in Excel (add, delete, reword, reorder rows), save, then use “Import new version”.' });
  }
  async function importVersion(file) {
    setMsg(null);
    try {
      const r = await readQuestionnaireFile(file, tpl);
      const before = new Set(current.map((q) => q.id));
      const after = new Set(r.questions.map((q) => q.id));
      const added = [...after].filter((id) => !before.has(id)).length;
      const removed = [...before].filter((id) => !after.has(id)).length;
      saveVersion(tpl, { importedAt: new Date().toISOString(), fileName: file.name, questions: r.questions });
      bump((n) => n + 1);
      setMsg({ kind: 'tip', text: `Imported “${file.name}”: ${r.questions.length} questions in ${r.sectionCount} sections (${added} new, ${removed} removed). New client links use this version.${r.warnings.length ? ` Notes: ${r.warnings.join(' ')}` : ''}` });
    } catch (e) { setMsg({ kind: 'warn', text: e.message || 'Could not read that file.' }); }
  }
  const SECTION_OPTS = sectionOptions(tpl);
  const commit = (next) => { setList(next); saveCustomFor(tpl, next); };
  const switchTo = (id) => { setTpl(id); setList(loadCustom(id)); setMsg(null); };
  const patch = (i, p) => commit(list.map((q, j) => (j === i ? { ...q, ...p } : q)));

  function add() {
    const taken = new Set([...allQuestions(list, tpl), ...loadCustom()].map((q) => q.id));
    commit([...list, cleanQuestion({ label: 'New question', type: 'long', section: EXTRA_SECTION.id }, taken, tpl)]);
  }

  async function importJson(file) {
    try {
      const data = JSON.parse(await file.text());
      const arr = Array.isArray(data) ? data : data.questions || [];
      const taken = new Set([...allQuestions(list, tpl), ...loadCustom()].map((q) => q.id));
      const labels = new Set(allQuestions(list, tpl).map((q) => q.label.toLowerCase()));
      const fresh = arr.filter((q) => q && q.label && !labels.has(String(q.label).toLowerCase())).map((q) => { const c = cleanQuestion(q, taken, tpl); taken.add(c.id); return c; });
      commit([...list, ...fresh]);
      setMsg({ kind: 'tip', text: `Added ${fresh.length} question${fresh.length === 1 ? '' : 's'}.` });
    } catch { setMsg({ kind: 'warn', text: 'That is not a question list exported from this app.' }); }
  }

  return (
    <div className="deck" style={{ maxWidth: 1000 }}>
      <h1>Master questionnaires</h1>
      <div className="choice-grid">
        {Object.values(TEMPLATES).map((t) => <button key={t.id} type="button" className={`choice ${tpl === t.id ? 'on' : ''}`} onClick={() => switchTo(t.id)}>{t.label}</button>)}
      </div>
      <p className="muted" style={{ margin: 0 }}>{T.description}</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row tight">
          <strong style={{ fontSize: 16 }}>{version ? 'Your imported version' : 'Standard version'}</strong>
          <span className={`badge ${version ? 'teal' : 'good'}`}>{version ? `from ${version.fileName}, ${new Date(version.importedAt).toLocaleDateString()}` : 'loads automatically'}</span>
          <span className="muted small">{current.length} questions in {sectionCount} sections{list.length ? `, including ${list.length} you added below` : ''}</span>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Every new client link uses this version. Links already sent keep the questions they had. To change many questions at once, download the questionnaire as Excel, edit it, and import it as a new version.</p>
        <div className="row tight">
          <button className="btn" onClick={downloadXlsx}>Download questionnaire (Excel)</button>
          <label className="btn primary">Import new version…<input type="file" accept=".xlsx,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importVersion(f); }} /></label>
          <a className="btn ghost" href={`#/questionnaire/${tpl}`} target="_blank" rel="noreferrer">Preview</a>
          {version && <button className="btn ghost" onClick={() => confirmArm('reset', () => { clearVersion(tpl); bump((n) => n + 1); setMsg({ kind: 'tip', text: 'Back to the standard version. Your imported version is kept as “previous” in case you want it back.' }); })}>{arm === 'reset' ? 'Click again to reset' : 'Reset to standard'}</button>}
          {hasPreviousVersion(tpl) && <button className="btn ghost" onClick={() => { restorePreviousVersion(tpl); bump((n) => n + 1); setMsg({ kind: 'tip', text: 'Previous version restored.' }); }}>Restore previous version</button>}
        </div>
      </div>
      {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
      <h2 style={{ fontSize: '1.25rem' }}>Questions you added</h2>
      <p className="muted small" style={{ margin: 0 }}>Added on top of the version above — by hand here, or automatically when you import a client’s questionnaire that answers something you don’t ask.</p>
      <div className="row tight">
        <button className="btn" onClick={add}>+ Add question</button>
        <button className="btn ghost" onClick={() => downloadBlob(new Blob([JSON.stringify({ format: 'bkcg-questions', template: tpl, questions: list }, null, 2)], { type: 'application/json' }), `bkcg-added-questions-${tpl}.json`)}>Export added questions</button>
        <label className="btn ghost">Add questions from a file…<input type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} /></label>
      </div>
      <div className="card">
        {list.length === 0 && <p className="muted" style={{ margin: 0 }}>None yet.</p>}
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
