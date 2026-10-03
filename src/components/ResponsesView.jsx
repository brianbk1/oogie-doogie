import { useMemo, useState } from 'react';
import QuestionInput from './QuestionInput.jsx';
import { allSections } from '../lib/master.js';
import { formatAnswer, isAnswered } from '../lib/questions.js';
import { autoChecks } from '../lib/checks.js';
import { copyText } from '../lib/ai.js';

const FLAG_LABEL = { vague: 'Vague', contradictory: 'Contradictory' };

export default function ResponsesView({ client, update }) {
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState(false);
  const [openNote, setOpenNote] = useState({});
  const [msg, setMsg] = useState(null);
  const { questions = [], answers = {}, review = {} } = client;
  const flags = review.flags || {};
  const notes = review.notes || {};
  const checks = useMemo(() => autoChecks(questions, answers), [questions, answers]);
  const sections = allSections(questions);
  const qs = questions.filter((q) => q.type !== 'file');
  const answered = qs.filter((q) => isAnswered(q, answers[q.id])).length;
  const flagged = Object.values(flags).filter(Boolean).length;
  const suggestions = Object.keys(checks).filter((id) => !flags[id]).length;

  const setReview = (fn) => update((c) => ({ ...c, review: fn(c.review || {}) }));
  const setFlag = (id, kind) => setReview((r) => ({ ...r, flags: { ...(r.flags || {}), [id]: (r.flags || {})[id] === kind ? '' : kind } }));
  const setNote = (id, text) => setReview((r) => ({ ...r, notes: { ...(r.notes || {}), [id]: text } }));
  const setAnswer = (id, v) => update((c) => ({ ...c, answers: { ...c.answers, [id]: v } }));

  const visible = (q) => {
    if (filter === 'flagged') return !!flags[q.id] || !!checks[q.id];
    if (filter === 'blank') return q.type !== 'file' && !isAnswered(q, answers[q.id]);
    if (filter === 'notes') return !!String(notes[q.id] || '').trim();
    return true;
  };

  async function copyFollowUps() {
    const lines = [];
    questions.forEach((q) => {
      if (flags[q.id]) lines.push(`- ${q.label}\n  You wrote: “${formatAnswer(q, answers[q.id])}”\n  ${flags[q.id] === 'contradictory' ? 'This seems to conflict with another answer — can you confirm?' : 'Could you be more specific (numbers, examples, names)?'}${notes[q.id] ? ` ${notes[q.id]}` : ''}`);
    });
    const blanks = qs.filter((q) => !isAnswered(q, answers[q.id]));
    if (blanks.length) lines.push(`\nStill open (a rough answer is fine):\n${blanks.map((q) => `- ${q.label}`).join('\n')}`);
    if (!lines.length) { setMsg({ kind: 'note', text: 'Nothing flagged or blank — no follow-ups needed.' }); return; }
    const name = String(answers.respondent || client.contact || '').split(/[ ,]/)[0];
    const text = `Hi${name ? ` ${name}` : ''},\n\nThanks for the questionnaire — it already makes kickoff more productive. A few follow-ups:\n\n${lines.join('\n\n')}\n\nThanks,\n`;
    setMsg(await copyText(text) ? { kind: 'tip', text: 'Follow-up email copied — paste it into your email.' } : { kind: 'warn', text: 'Copy was blocked by the browser.' });
  }

  return (
    <div className="deck">
      <div className="stats">
        <div className="stat"><strong>{answered}/{qs.length}</strong><span>questions answered</span></div>
        <div className="stat"><strong>{flagged}</strong><span>answers you flagged</span></div>
        <div className="stat"><strong>{suggestions}</strong><span>suggested checks to review</span></div>
        <div className="stat"><strong>{Object.values(client.files || {}).flat().length}</strong><span>files attached</span></div>
      </div>
      <div className="row tight">
        <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All answers</option><option value="flagged">Flagged + suggested checks</option><option value="blank">Not answered</option><option value="notes">With my notes</option>
        </select>
        <button className={`btn small ${edit ? 'primary' : ''}`} onClick={() => setEdit((v) => !v)}>{edit ? 'Done editing answers' : 'Edit answers'}</button>
        <button className="btn small" onClick={copyFollowUps}>Copy follow-up questions</button>
      </div>
      {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
      <label className="field"><span className="field-label">My overall notes (included in the AI prompt)</span>
        <textarea rows={3} value={review.overall || ''} placeholder="First impressions, hypotheses, what to probe at kickoff…" onChange={(e) => setReview((r) => ({ ...r, overall: e.target.value }))} />
      </label>

      {sections.map((s) => {
        const list = questions.filter((q) => q.section === s.id && visible(q));
        if (!list.length) return null;
        return (
          <section key={s.id} className="resp-section">
            <h2>{s.title}</h2>
            {list.map((q) => {
              const v = answers[q.id];
              const has = isAnswered(q, v);
              const flag = flags[q.id];
              return (
                <div key={q.id} className={`resp ${flag ? `flag-${flag}` : ''}`}>
                  <div>
                    <div className="resp-q">{q.label}{q.custom && <span className="badge teal" style={{ marginLeft: 6 }}>added</span>}</div>
                    {edit && q.type !== 'file'
                      ? <div style={{ marginTop: 6 }}><QuestionInput q={q} value={v} onChange={(x) => setAnswer(q.id, x)} /></div>
                      : <div className={`resp-a ${has ? '' : 'empty'}`}>{has ? formatAnswer(q, v) : 'Not answered'}</div>}
                  </div>
                  {q.type !== 'file' && (
                    <div className="resp-tools">
                      {['vague', 'contradictory'].map((k) => <button key={k} className={`flag-btn ${k} ${flag === k ? 'on' : ''}`} aria-pressed={flag === k} onClick={() => setFlag(q.id, k)}>{FLAG_LABEL[k]}</button>)}
                      <button className="flag-btn" onClick={() => setOpenNote((o) => ({ ...o, [q.id]: !o[q.id] }))}>{notes[q.id] ? 'Note ✓' : 'Note'}</button>
                    </div>
                  )}
                  {!flag && (checks[q.id] || []).map((c, i) => (
                    <div key={i} className="auto-check">⚠ {c.text} <button className="link small" onClick={() => setFlag(q.id, c.kind)}>Flag as {FLAG_LABEL[c.kind].toLowerCase()}</button></div>
                  ))}
                  {(openNote[q.id] || notes[q.id]) && (
                    <div className="resp-note"><textarea rows={2} aria-label={`Note on ${q.label}`} placeholder="Your note (stays private; goes into the AI prompt)" value={notes[q.id] || ''} onChange={(e) => setNote(q.id, e.target.value)} /></div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
