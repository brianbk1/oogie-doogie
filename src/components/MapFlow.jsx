import { useMemo, useState } from 'react';
import { allQuestions, addToMaster, EXTRA_SECTION, cleanQuestion } from '../lib/master.js';
import { SECTIONS, TYPE_LABELS, formatAnswer } from '../lib/questions.js';
import { buildMappingPrompt, looksLikeMappingPrompt, parseMapping, coerceAnswer } from '../lib/mapping.js';
import { callAi, copyText } from '../lib/ai.js';
import { getClient, saveClient, newClientId } from '../lib/clients.js';

const SECTION_OPTS = [...SECTIONS.filter((s) => s.id !== 'files'), EXTRA_SECTION];
const show = (v) => (Array.isArray(v) ? v.join(', ') : v === undefined || v === null ? '' : String(v));

// Upload any completed questionnaire → AI matches answers to our questions → you review → apply.
// Answers to questions we don't have become new questions in the master questionnaire.
export default function MapFlow({ pending, clients, onDone, onCancel }) {
  const master = useMemo(() => allQuestions(), []);
  const prompt = useMemo(() => buildMappingPrompt(master, pending.text, pending.fileName), [master, pending]);
  const [target, setTarget] = useState(pending.targetId || 'new');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [result, setResult] = useState(null); // { rows: [...], newRows: [...], notes }
  const [showText, setShowText] = useState(false);

  function load(text) {
    if (looksLikeMappingPrompt(text)) { setMsg({ kind: 'warn', text: 'That is the prompt from step 1, not the AI’s answer. Paste it into ChatGPT, Claude or Copilot first, then paste the reply here.' }); return; }
    const m = parseMapping(text);
    if (!m) { setMsg({ kind: 'warn', text: 'No JSON found in that reply. Paste the whole answer, including the ```json block.' }); return; }
    const byId = Object.fromEntries(master.map((q) => [q.id, q]));
    const rows = Object.entries(m.answers).filter(([id]) => byId[id]).map(([id, v]) => {
      const q = byId[id];
      const val = coerceAnswer(q, v);
      return { id, q, value: val, text: show(val), include: val !== undefined, uncertain: m.uncertain.includes(id) };
    }).filter((r) => r.value !== undefined);
    const taken = new Set(master.map((q) => q.id));
    const newRows = m.newQuestions.map((nq, i) => {
      const q = cleanQuestion({ ...nq, label: nq.label || nq.question }, taken);
      taken.add(q.id);
      return { key: i, q, text: show(nq.answer), include: true };
    });
    setResult({ rows, newRows, notes: m.notes, unknown: Object.keys(m.answers).filter((id) => !byId[id]) });
    setMsg({ kind: 'tip', text: `Matched ${rows.length} answers and found ${newRows.length} question${newRows.length === 1 ? '' : 's'} not in your questionnaire. Review, then apply.` });
  }

  async function mapWithAi() {
    setBusy(true); setMsg({ kind: 'note', text: 'Mapping… this usually takes under a minute.' });
    try { load(await callAi('map', prompt)); } catch (e) { setMsg({ kind: 'warn', text: e.message }); }
    setBusy(false);
  }

  async function apply() {
    const inc = result.rows.filter((r) => r.include);
    const incNew = result.newRows.filter((r) => r.include && r.q.label.trim());
    const { ids, added } = addToMaster(incNew.map((r) => r.q));
    const fresh = allQuestions();
    const byId = Object.fromEntries(fresh.map((q) => [q.id, q]));
    const answers = {};
    inc.forEach((r) => {
      const v = r.text === show(r.value) ? r.value : coerceAnswer(r.q, r.q.type === 'multi' || r.q.type === 'rank' ? r.text.split(',') : r.text);
      if (v !== undefined) answers[r.id] = v;
    });
    incNew.forEach((r, i) => { const id = ids[i]; if (id && byId[id]) { const v = coerceAnswer(byId[id], r.q.type === 'multi' || r.q.type === 'rank' ? r.text.split(',') : r.text); if (v !== undefined) answers[id] = v; } });

    let client = target !== 'new' ? await getClient(target) : null;
    if (!client) client = { id: newClientId(), createdAt: new Date().toISOString(), company: '', answers: {}, review: {}, files: {}, questions: [] };
    const qmap = new Map([...(client.questions || []), ...fresh].map((q) => [q.id, q]));
    const merged = { ...client.answers, ...answers };
    const saved = await saveClient({
      ...client,
      company: client.company || String(merged.company_name || pending.fileName.replace(/\.[^.]+$/, '')),
      questions: fresh.filter((q) => qmap.has(q.id)),
      answers: merged,
      status: 'received', receivedAt: new Date().toISOString(),
      sources: [...(client.sources || []), { file: pending.fileName, at: new Date().toISOString(), mapped: Object.keys(answers).length }],
      review: { ...(client.review || {}), overall: [client.review?.overall, result.notes ? `Mapping notes (${pending.fileName}): ${result.notes}` : ''].filter(Boolean).join('\n\n') },
    });
    onDone(saved.id, `${Object.keys(answers).length} answers imported from ${pending.fileName}${added.length ? `; ${added.length} new question${added.length === 1 ? '' : 's'} added to your master questionnaire` : ''}.`);
  }

  return (
    <div className="deck">
      <div className="main-head">
        <div><div className="muted small">Import a completed questionnaire</div><h1>{pending.fileName}</h1></div>
        <span className="topbar-spacer" />
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>This file is not in the app’s own response format, so an AI matches its answers to your questions. You review every match before anything is saved. Read {pending.text.length.toLocaleString()} characters. <button className="link small" onClick={() => setShowText((v) => !v)}>{showText ? 'Hide' : 'Show'} extracted text</button></p>
      {showText && <textarea className="prompt-box" readOnly value={pending.text} rows={10} />}
      <label className="field" style={{ maxWidth: 420 }}><span className="field-label">Import into</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="new">A new client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
      </label>

      <section className="deck-ai">
        <div className="deck-ai-step"><span className="step-badge">1</span><div>
          <strong>Copy the mapping prompt</strong>
          <p className="muted small">Your question list plus the file’s text, asking for JSON back.</p>
          <div className="row tight"><button className="btn small primary" onClick={async () => setMsg(await copyText(prompt) ? { kind: 'tip', text: 'Copied. Paste it into any AI, then paste the reply into box 2.' } : { kind: 'warn', text: 'Copy was blocked. Use “Show extracted text” and copy manually.' })}>Copy prompt</button></div>
        </div></div>
        <div className="deck-ai-step"><span className="step-badge">2</span><div>
          <strong>Paste the reply</strong>
          <textarea rows={3} value={paste} placeholder="Paste the whole reply, including the ```json block" onChange={(e) => setPaste(e.target.value)} />
          <div className="row tight">
            <button className="btn small primary" disabled={!paste.trim()} onClick={() => load(paste)}>Review matches</button>
            <span className="muted small">or</span>
            <button className="btn small" disabled={busy} onClick={mapWithAi}>{busy ? 'Mapping…' : 'Map with AI'}</button>
          </div>
        </div></div>
        <div className="deck-ai-step"><span className="step-badge">3</span><div>
          <strong>Review and apply</strong>
          <p className="muted small">Untick anything wrong, fix wording, then apply. New questions are added to your master questionnaire for future clients.</p>
          {result && <button className="btn small primary" onClick={apply}>Apply {result.rows.filter((r) => r.include).length + result.newRows.filter((r) => r.include).length} answers</button>}
        </div></div>
      </section>
      {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}

      {result && (
        <>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="map-table">
              <thead><tr><th style={{ width: 40 }}>Use</th><th style={{ width: '38%' }}>Your question</th><th>Answer found</th></tr></thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={r.id}>
                    <td><input type="checkbox" style={{ width: 'auto' }} checked={r.include} onChange={(e) => setResult((s) => ({ ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)) }))} /></td>
                    <td>{r.q.label} {r.uncertain && <span className="badge warn">check</span>}<div className="muted small">{TYPE_LABELS[r.q.type]}{r.q.unit ? ` · ${r.q.unit}` : ''} → {formatAnswer(r.q, r.value)}</div></td>
                    <td><textarea rows={2} value={r.text} onChange={(e) => setResult((s) => ({ ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.newRows.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.25rem' }}>New questions → added to your master questionnaire</h2>
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="map-table">
                  <thead><tr><th style={{ width: 40 }}>Add</th><th>Question</th><th style={{ width: 150 }}>Type</th><th style={{ width: 170 }}>Section</th><th>Answer</th></tr></thead>
                  <tbody>
                    {result.newRows.map((r, i) => {
                      const setQ = (p) => setResult((s) => ({ ...s, newRows: s.newRows.map((x, j) => (j === i ? { ...x, q: { ...x.q, ...p } } : x)) }));
                      return (
                        <tr key={r.key}>
                          <td><input type="checkbox" style={{ width: 'auto' }} checked={r.include} onChange={(e) => setResult((s) => ({ ...s, newRows: s.newRows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)) }))} /></td>
                          <td><textarea rows={2} value={r.q.label} onChange={(e) => setQ({ label: e.target.value })} /></td>
                          <td><select value={r.q.type} onChange={(e) => setQ({ type: e.target.value })}>{Object.entries(TYPE_LABELS).filter(([k]) => k !== 'file').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                          <td><select value={r.q.section} onChange={(e) => setQ({ section: e.target.value })}>{SECTION_OPTS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></td>
                          <td><textarea rows={2} value={r.text} onChange={(e) => setResult((s) => ({ ...s, newRows: s.newRows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {result.notes && <div className="callout note"><strong>AI notes</strong>{result.notes}</div>}
        </>
      )}
    </div>
  );
}
