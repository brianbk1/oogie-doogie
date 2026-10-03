import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionInput, { fmtSize } from './QuestionInput.jsx';
import { allQuestions, allSections } from '../lib/master.js';
import { isAnswered } from '../lib/questions.js';
import { idbGet, idbSet, idbDel, lsGet, lsSet } from '../lib/idb.js';
import { buildResponseZip, readResponseFile, responseFileName, answeredCount } from '../lib/responseFile.js';
import { downloadBlob } from '../lib/download.js';
import BrandBar from './BrandBar.jsx';

const BIG_ATTACHMENTS = 20e6; // most email services cap attachments around 20–25 MB

export default function Questionnaire({ link }) {
  const questions = useMemo(() => allQuestions(link.custom), [link]);
  const sections = useMemo(() => allSections(questions), [questions]);
  const key = `bkcg-client-${link.id}`;
  const saved = useMemo(() => lsGet(key, null), [key]);
  const [answers, setAnswers] = useState(() => saved?.answers || (link.company ? { company_name: link.company } : {}));
  const [step, setStep] = useState(() => saved?.step || 0);
  const [savedAt, setSavedAt] = useState(saved?.savedAt || null);
  const [showEx, setShowEx] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const top = useRef(null);

  // Autosave on this device.
  useEffect(() => {
    const at = new Date().toISOString();
    if (lsSet(key, { answers, step, savedAt: at })) setSavedAt(at);
  }, [answers, step, key]);

  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); window.scrollTo(0, 0); }, [step]);

  const total = questions.filter((q) => q.type !== 'file').length;
  const done = answeredCount(questions.filter((q) => q.type !== 'file'), answers);
  const pct = Math.round((done / Math.max(1, total)) * 100);
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const lastStep = sections.length + 1;
  const company = String(answers.company_name || link.company || '').trim();
  const fileBytes = questions.filter((q) => q.type === 'file').flatMap((q) => answers[q.id] || []).reduce((s, f) => s + (f.size || 0), 0);

  async function addFiles(q, files) {
    const list = [...(answers[q.id] || [])];
    for (const f of files) {
      const k = `file:${link.id}:${q.id}:${Math.random().toString(36).slice(2, 10)}`;
      try { await idbSet(k, f); } catch (e) { setMsg({ kind: 'warn', text: `Could not keep “${f.name}” in this browser: ${e.message}. You can attach it to your email instead.` }); continue; }
      list.push({ name: f.name, size: f.size, type: f.type, key: k });
    }
    set(q.id, list);
  }
  async function removeFile(q, f) {
    await idbDel(f.key).catch(() => {});
    set(q.id, (answers[q.id] || []).filter((x) => x.key !== f.key));
  }

  async function download(complete) {
    setBusy(true); setMsg(null);
    try {
      const { blob } = await buildResponseZip({ link, questions, answers, complete, getBlob: (k) => idbGet(k).catch(() => null) });
      downloadBlob(blob, responseFileName(company, complete));
      setMsg(complete
        ? { kind: 'tip', text: 'Your response file is downloaded. Attach it to an email to your consultant (step 2 below).' }
        : { kind: 'tip', text: 'Progress file saved. To continue on another computer, open this same link there and choose “Resume from a saved file”.' });
    } catch (e) { setMsg({ kind: 'warn', text: `Could not build the file: ${e.message}` }); }
    setBusy(false);
  }

  async function resume(file) {
    setMsg(null);
    const r = await readResponseFile(file);
    if (!r) { setMsg({ kind: 'warn', text: 'That is not a saved questionnaire file. Choose the .zip you downloaded from this questionnaire.' }); return; }
    const next = { ...r.doc.answers };
    for (const q of questions.filter((x) => x.type === 'file')) {
      const list = [];
      for (const f of next[q.id] || []) {
        const blob = r.blobs[f.path];
        if (!blob) continue;
        const k = `file:${link.id}:${q.id}:${Math.random().toString(36).slice(2, 10)}`;
        await idbSet(k, blob).catch(() => {});
        list.push({ name: f.name, size: f.size, type: f.type, key: k });
      }
      next[q.id] = list;
    }
    setAnswers(next);
    setMsg({ kind: 'tip', text: `Picked up where you left off (${answeredCount(questions, next)} answers).` });
    const firstOpen = sections.findIndex((s) => questions.filter((q) => q.section === s.id && q.type !== 'file').some((q) => !isAnswered(q, next[q.id])));
    setStep(firstOpen >= 0 ? firstOpen + 1 : lastStep);
  }

  const section = step >= 1 && step <= sections.length ? sections[step - 1] : null;
  const mailto = link.email
    ? `mailto:${link.email}?subject=${encodeURIComponent(`Pre-kickoff questionnaire — ${company || 'our answers'}`)}&body=${encodeURIComponent(`Hi${link.consultant ? ' ' + link.consultant.split(' ')[0] : ''},\n\nOur pre-kickoff questionnaire is attached.\n\nThanks,\n${String(answers.respondent || link.contact || '').split(',')[0]}`)}`
    : '';

  return (
    <>
      <BrandBar subtitle="Pre-kickoff questionnaire" home="https://thebkcg.com">
        {step > 0 && savedAt && <span className="save-state"><span className="hide-sm">Saved on this device</span><span className="show-sm">Saved</span></span>}
      </BrandBar>
      <div className="q-shell" ref={top}>
        {step === 0 && (
          <div className="q-hero">
            <span className="badge teal" style={{ alignSelf: 'flex-start' }}>Before we kick off</span>
            <h1>{company ? `${company}: ` : ''}help us start the first meeting already up to speed</h1>
            <p className="lede">
              {link.contact ? `${link.contact.split(' ')[0]}, this` : 'This'} questionnaire covers the ground we would otherwise spend the first two meetings on. Rough numbers and short answers are fine; ranges beat blanks.
            </p>
            <div className="q-facts">
              <div className="q-fact"><strong>{sections.length} sections</strong><span>one per screen, with examples of good answers</span></div>
              <div className="q-fact"><strong>~30 minutes</strong><span>stop any time — it saves on this device</span></div>
              <div className="q-fact"><strong>Private</strong><span>answers stay on your computer until you send the file</span></div>
            </div>
            {link.due && <p className="muted" style={{ margin: 0 }}>Please send it back by <strong>{link.due}</strong>.</p>}
            {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
            <div className="row tight">
              <button className="btn primary" onClick={() => setStep(1)}>{saved?.step > 0 ? `Continue (${pct}% done)` : 'Start'}</button>
              <label className="btn">Resume from a saved file…<input type="file" accept=".zip,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) resume(f); }} /></label>
            </div>
          </div>
        )}

        {step > 0 && (
          <div className="q-progress">
            <div className="q-progress-bar"><span style={{ width: `${pct}%` }} /></div>
            <div className="q-progress-meta"><span>{section ? `Section ${step} of ${sections.length}` : 'Review and send'}</span><span>{done} of {total} answered</span></div>
            <div className="q-dots" role="navigation" aria-label="Sections">
              {sections.map((s, i) => {
                const qs = questions.filter((q) => q.section === s.id);
                const complete = qs.every((q) => q.type === 'file' || isAnswered(q, answers[q.id]));
                return <button key={s.id} className={`q-dot ${step === i + 1 ? 'on' : complete ? 'done' : ''}`} title={s.title} aria-label={`${s.title}${complete ? ' (complete)' : ''}`} onClick={() => setStep(i + 1)}>{i + 1}</button>;
              })}
              <button className={`q-dot ${step === lastStep ? 'on' : ''}`} title="Review and send" aria-label="Review and send" onClick={() => setStep(lastStep)}>✓</button>
            </div>
          </div>
        )}

        {section && (
          <>
            <div className="q-section-head">
              <div className="eyebrow">Section {step} · {section.title}</div>
              <h2>{section.title}</h2>
              {section.intro && <p>{section.intro}</p>}
            </div>
            <div className="q-list">
              {questions.filter((q) => q.section === section.id).map((q) => (
                <div key={q.id} className={`q-card ${isAnswered(q, answers[q.id]) ? 'answered' : ''}`}>
                  <label className="q-label" htmlFor={`q-${q.id}`}><span>{q.label}</span>{q.required && <span className="badge">Required</span>}</label>
                  {q.help && <p className="q-help">{q.help}</p>}
                  <QuestionInput q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)}
                    onAddFiles={(fs) => addFiles(q, fs)} onRemoveFile={(f) => removeFile(q, f)} />
                  {q.example && (showEx[q.id]
                    ? <div className="q-example"><strong>A good answer looks like:</strong> {q.example} <button className="link small" onClick={() => setShowEx((s) => ({ ...s, [q.id]: false }))}>Hide</button></div>
                    : <button className="link q-ex-toggle" onClick={() => setShowEx((s) => ({ ...s, [q.id]: true }))}>See an example of a good answer</button>)}
                </div>
              ))}
            </div>
          </>
        )}

        {step === lastStep && (
          <div className="send-box">
            <div className="q-section-head"><div className="eyebrow">Last step</div><h2>Review and send</h2><p>Anything blank is fine to leave — we will cover it at kickoff. Click a section to jump back.</p></div>
            <div className="review-grid">
              {sections.map((s, i) => {
                const qs = questions.filter((q) => q.section === s.id && q.type !== 'file');
                const n = answeredCount(qs, answers);
                const files = s.id === 'files' ? questions.filter((q) => q.section === 'files').flatMap((q) => answers[q.id] || []).length : null;
                return (
                  <div key={s.id} className="review-row">
                    <button className="link" style={{ textAlign: 'left' }} onClick={() => setStep(i + 1)}>{i + 1}. {s.title}</button>
                    {files !== null ? <span className="muted small">{files} file{files === 1 ? '' : 's'}</span> : <span className="meter"><span style={{ width: `${(n / Math.max(1, qs.length)) * 100}%` }} /></span>}
                    {files === null && <span className="small muted">{n}/{qs.length}</span>}
                  </div>
                );
              })}
            </div>
            {fileBytes > BIG_ATTACHMENTS && <div className="callout warn">Your attachments total {fmtSize(fileBytes)} — too big for most email. Remove the large files here and share them with a file-sharing link instead.</div>}
            {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
            <div className="card">
              <ol className="steps-ol">
                <li><strong>Download your response file.</strong> One .zip with your answers, a readable copy, and your documents.
                  <div style={{ margin: '8px 0 4px' }}><button className="btn primary" onClick={() => download(true)} disabled={busy}>{busy ? 'Building…' : 'Download my response file'}</button></div>
                </li>
                <li><strong>Email it to {link.consultant || 'your consultant'}</strong>{link.email ? <> at <a href={mailto}>{link.email}</a></> : ''} as an attachment.
                  {mailto && <div style={{ margin: '8px 0 4px' }}><a className="btn" href={mailto}>Open a new email</a> <span className="muted small">then attach the file</span></div>}
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {step > 0 && (
        <nav className="q-nav">
          <div className="q-nav-inner">
            <button className="btn" onClick={() => setStep(step - 1)}>Back</button>
            <button className="btn ghost small" onClick={() => download(false)} disabled={busy} title="Download a file you can resume from on any computer">Save progress file</button>
            <span className="grow" />
            {step < lastStep && <button className="btn primary" onClick={() => setStep(step + 1)}>{step === sections.length ? 'Review' : 'Next'}</button>}
          </div>
        </nav>
      )}
    </>
  );
}
