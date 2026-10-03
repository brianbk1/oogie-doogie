import { useState } from 'react';
import { TYPE_LABELS, UNITS } from '../lib/questions.js';
import { loadCustom, saveCustomFor, cleanQuestion, allQuestions, allSections, EXTRA_SECTION, sectionOptions, TEMPLATES, templateOf, loadVersion, saveVersion, clearVersion, restorePreviousVersion, hasPreviousVersion, baseQuestions, slugId } from '../lib/master.js';
import { questionnaireWorkbookBlob, readQuestionnaireFile } from '../lib/versions.js';
import { downloadBlob } from '../lib/download.js';


// Questions you have added (by hand or from uploaded questionnaires). Built-in questions are fixed in
// src/lib/questions.js; added questions travel to clients inside each new link.
export default function MasterQuestions({ onAnswer }) {
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

  const coreQs = baseQuestions(tpl);
  const coreSections = allSections(coreQs);
  const [open, setOpen] = useState({});
  // Any edit to the core questions saves them as your own version (Reset to standard undoes it).
  function editCore(fn) {
    const next = fn(coreQs.map((q) => ({ ...q })));
    saveVersion(tpl, { importedAt: new Date().toISOString(), fileName: 'edits made here', questions: next });
    bump((n) => n + 1);
  }
  const patchCore = (id, p) => editCore((qs) => qs.map((q) => (q.id === id ? { ...q, ...p } : q)));
  const moveCore = (id, d) => editCore((qs) => {
    const i = qs.findIndex((q) => q.id === id);
    const j = i + d;
    if (j < 0 || j >= qs.length || qs[j].section !== qs[i].section) return qs;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return qs;
  });
  const addCore = (section) => editCore((qs) => {
    const taken = new Set([...qs, ...loadCustom()].map((q) => q.id));
    const last = qs.map((q) => q.section).lastIndexOf(section);
    const sectionTitle = coreSections.find((s) => s.id === section)?.title;
    const q = { id: slugId('new question', taken).replace(/^x_/, 'q_'), section, sectionTitle, type: 'long', label: 'New question' };
    qs.splice(last + 1, 0, q);
    return qs;
  });

  async function downloadXlsx() {
    downloadBlob(await questionnaireWorkbookBlob(tpl), `${T.label.replace(/\s+/g, '-')}-questionnaire${version ? '-custom' : ''}.xlsx`);
    setMsg({ kind: 'tip', text: 'Downloaded. Edit the questions in Excel (add, delete, reword, reorder rows), save, then use “Import new version”.' });
  }
  const [pending, setPending] = useState(null); // { file, result }
  async function readUpload(file) {
    setMsg(null); setPending(null);
    try { setPending({ file, result: await readQuestionnaireFile(file, tpl) }); }
    catch (e) { setMsg({ kind: 'warn', text: e.message || 'Could not read that file.' }); }
  }
  function addFromUpload() {
    const { file, result } = pending;
    const opts = sectionOptions(tpl);
    const taken = new Set([...allQuestions(list, tpl), ...loadCustom()].map((q) => q.id));
    const labels = new Set(allQuestions(list, tpl).map((q) => q.label.toLowerCase()));
    const fresh = result.questions.filter((q) => q.id !== 'company_name' || !labels.has('company name')).filter((q) => q.type !== 'file' && !labels.has(q.label.toLowerCase())).map((q) => {
      const sec = opts.find((o) => o.id === q.section || o.title.toLowerCase() === String(q.sectionTitle || '').toLowerCase());
      const c = cleanQuestion({ ...q, id: undefined, section: sec?.id || EXTRA_SECTION.id }, taken, tpl);
      taken.add(c.id); return c;
    });
    commit([...list, ...fresh]);
    setPending(null);
    setMsg({ kind: 'tip', text: `Added ${fresh.length} question${fresh.length === 1 ? '' : 's'} from “${file.name}” (${result.questions.length - fresh.length} were already in the questionnaire). They are listed under “Questions you added”.` });
  }
  async function importVersion(file, preRead = null) {
    setMsg(null); setPending(null);
    try {
      const r = preRead || await readQuestionnaireFile(file, tpl);
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
        <p className="muted small" style={{ margin: 0 }}>Every new client link uses this version. Links already sent keep the questions they had. To change many questions at once, download it as Excel, edit it and upload it. You can also upload a Word, PDF or text list of questions.</p>
        <div className="row tight">
          <button className="btn" onClick={downloadXlsx}>Download questionnaire (Excel)</button>
          <label className="btn primary">Upload a file of questions…<input type="file" accept=".xlsx,.json,.docx,.pdf,.txt,.md,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readUpload(f); }} /></label>
          {onAnswer && <button className="btn teal" onClick={() => onAnswer(tpl)}>Answer this questionnaire</button>}
          <a className="btn ghost" href={`#/questionnaire/${tpl}`} target="_blank" rel="noreferrer">Preview</a>
          {version && <button className="btn ghost" onClick={() => confirmArm('reset', () => { clearVersion(tpl); bump((n) => n + 1); setMsg({ kind: 'tip', text: 'Back to the standard version. Your imported version is kept as “previous” in case you want it back.' }); })}>{arm === 'reset' ? 'Click again to reset' : 'Reset to standard'}</button>}
          {hasPreviousVersion(tpl) && <button className="btn ghost" onClick={() => { restorePreviousVersion(tpl); bump((n) => n + 1); setMsg({ kind: 'tip', text: 'Previous version restored.' }); }}>Restore previous version</button>}
        </div>
      </div>
      {pending && (
        <div className="callout note" style={{ gap: 10 }}>
          <div><strong>Found {pending.result.questions.length} questions in {pending.result.sectionCount} sections in “{pending.file.name}”.</strong> {pending.result.questions.slice(0, 3).map((q) => `“${q.label}”`).join(', ')}{pending.result.questions.length > 3 ? '…' : ''}</div>
          {pending.result.warnings.length > 0 && <div className="small">{pending.result.warnings.join(' ')}</div>}
          <div className="row tight">
            <button className="btn primary small" onClick={addFromUpload}>Add them to this questionnaire</button>
            <button className="btn small" onClick={() => importVersion(pending.file, pending.result)}>Replace the questionnaire with them</button>
            <button className="btn ghost small" onClick={() => setPending(null)}>Cancel</button>
          </div>
          <span className="muted small">Add keeps every current question. Replace makes this file the whole questionnaire (Reset to standard undoes it). Types are guessed from the wording — adjust them below.</span>
        </div>
      )}
      {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}

      <h2 style={{ fontSize: '1.25rem' }}>Questions ({coreQs.length})</h2>
      <p className="muted small" style={{ margin: 0 }}>Click a section to see and edit its questions. Any change here saves as your own version{version ? '' : ' (Reset to standard brings back the original)'}.</p>
      <div className="row tight">
        <button className="btn ghost small" onClick={() => setOpen(Object.fromEntries(coreSections.map((s) => [s.id, true])))}>Expand all</button>
        <button className="btn ghost small" onClick={() => setOpen({})}>Collapse all</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {coreSections.map((sec) => {
          const qs = coreQs.filter((q) => q.section === sec.id);
          const isOpen = !!open[sec.id];
          return (
            <div key={sec.id} className="sec-block">
              <button type="button" className="sec-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))}>
                <span>{isOpen ? '▾' : '▸'} {sec.title}</span><span className="muted small">{qs.length} question{qs.length === 1 ? '' : 's'}</span>
              </button>
              {isOpen && (
                <div className="sec-body">
                  {qs.map((q, i) => (
                    <div key={q.id} className="qedit">
                      <div className="field">
                        <input aria-label="Question" value={q.label} onChange={(e) => patchCore(q.id, { label: e.target.value })} />
                        {['choice', 'multi', 'rank'].includes(q.type) && <input aria-label="Options" value={(q.options || []).join(', ')} placeholder="Options, comma-separated" onChange={(e) => patchCore(q.id, { options: e.target.value.split(',').map((x) => x.trim()) })} />}
                        {q.example && <span className="field-hint">Example: {q.example}</span>}
                      </div>
                      <select aria-label="Type" value={q.type} disabled={q.id === 'company_name'} onChange={(e) => patchCore(q.id, { type: e.target.value, ...(['choice', 'multi', 'rank'].includes(e.target.value) && !q.options ? { options: ['Option A', 'Option B'] } : {}) })}>{Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                      <div className="row tight" style={{ gap: 4 }}>
                        <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => moveCore(q.id, -1)}>↑</button>
                        <button className="icon-btn" aria-label="Move down" disabled={i === qs.length - 1} onClick={() => moveCore(q.id, 1)}>↓</button>
                      </div>
                      <button className="icon-btn" aria-label={`Delete ${q.label}`} disabled={q.id === 'company_name'} onClick={() => confirmArm(`del-${q.id}`, () => editCore((all) => all.filter((x) => x.id !== q.id)))}>{arm === `del-${q.id}` ? '?' : '✕'}</button>
                    </div>
                  ))}
                  <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => addCore(sec.id)}>+ Add question to {sec.title}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: '1.25rem' }}>Questions you added</h2>
      <p className="muted small" style={{ margin: 0 }}>Added on top of the version above — by hand here, or automatically when you import a client’s questionnaire that answers something you don’t ask.</p>
      <div className="row tight">
        <button className="btn" onClick={add}>+ Add question</button>
        <button className="btn ghost" onClick={() => downloadBlob(new Blob([JSON.stringify({ format: 'bkcg-questions', template: tpl, questions: list }, null, 2)], { type: 'application/json' }), `bkcg-added-questions-${tpl}.json`)}>Export added questions</button>

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
