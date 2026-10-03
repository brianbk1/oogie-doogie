import { useCallback, useEffect, useRef, useState } from 'react';
import BrandBar from './BrandBar.jsx';
import ResponsesView from './ResponsesView.jsx';
import DeckBuilder from './DeckBuilder.jsx';
import PlanBuilder from './PlanBuilder.jsx';
import MapFlow from './MapFlow.jsx';
import MasterQuestions from './MasterQuestions.jsx';
import { fmtSize } from './QuestionInput.jsx';
import { listClients, getClient, saveClient, deleteClient, newClientId, saveBlob, getBlob, backupZip, restoreZip } from '../lib/clients.js';
import { allQuestions, loadCustom, loadVersion, TEMPLATES, templateOf } from '../lib/master.js';
import { readResponseFile, answeredCount } from '../lib/responseFile.js';
import { extractText } from '../lib/mapping.js';
import { readOfflineWorkbook, offlineWorkbookBlob } from '../lib/offline.js';
import { makeLink, newLinkId } from '../lib/link.js';
import { loadSettings, saveSettings, copyText } from '../lib/ai.js';
import { downloadBlob, safeName } from '../lib/download.js';
import { SAMPLE_ANSWERS, SAMPLE_AI_REPLY, FINSYS_SAMPLE_ANSWERS, FINSYS_SAMPLE_AI_REPLY } from '../lib/sample.js';

const STATUS = { draft: ['Draft', ''], sent: ['Link sent', 'teal'], progress: ['In progress', 'warn'], received: ['Received', 'good'] };

export default function Admin() {
  const [clients, setClients] = useState([]);
  const [view, setView] = useState({ kind: 'home' });
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState('responses');
  const [toast, setToast] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef(null);

  const refresh = useCallback(async () => setClients(await listClients().catch(() => [])), []);
  useEffect(() => { refresh(); }, [refresh]);

  async function open(id, nextTab = 'responses', note = null) {
    const c = await getClient(id);
    if (!c) return;
    setClient(c); setTab(nextTab); setView({ kind: 'client' }); setToast(note ? { kind: 'tip', text: note } : null);
    window.scrollTo(0, 0);
  }

  // Edits from child views; saved to browser storage shortly after the last change.
  const update = useCallback((fn) => {
    setClient((c) => {
      const next = fn(c);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { saveClient(next).then(refresh).catch((e) => setToast({ kind: 'warn', text: `Could not save: ${e.message}` })); }, 500);
      return next;
    });
  }, [refresh]);

  async function importFiles(files, targetId = null) {
    setBusy(true); setToast(null);
    for (const file of files) {
      try {
        const r = await readResponseFile(file);
        if (r) { await importResponse(r, file.name, targetId); continue; }
        const wbk = await readOfflineWorkbook(file, [...allQuestions(null, 'strategy'), ...allQuestions(null, 'finsys')]).catch(() => null);
        if (wbk) { await importOffline(wbk, file.name, targetId); continue; }
        await startMapping(file, targetId);
      } catch (e) {
        setToast({ kind: 'warn', text: `${file.name}: ${e.message}` });
      }
    }
    setBusy(false);
  }

  async function startMapping(file, targetId) {
    const text = await extractText(file);
    if (!text.trim()) throw new Error('No text found in that file.');
    setView({ kind: 'map', pending: { fileName: file.name, text, targetId } });
  }

  // The client's filled-in Excel questionnaire: exact mapping, no AI.
  async function importOffline(wbk, fileName, targetId) {
    const all = await listClients();
    const match = targetId || all.find((c) => c.linkId && c.linkId === wbk.linkId)?.id;
    const existing = match ? await getClient(match) : null;
    const template = existing?.template || wbk.template || 'strategy';
    const base = existing || { id: newClientId(), createdAt: new Date().toISOString(), review: {}, files: {}, linkId: wbk.linkId, template };
    const saved = await saveClient({
      ...base, company: base.company || wbk.answers.company_name || wbk.company || 'Untitled client',
      questions: base.questions?.length ? base.questions : allQuestions(null, template),
      answers: { ...(base.answers || {}), ...wbk.answers }, status: 'received', receivedAt: new Date().toISOString(),
      sources: [...(base.sources || []), { file: fileName, at: new Date().toISOString(), mapped: wbk.count }],
    });
    await refresh();
    open(saved.id, 'responses', `${existing ? 'Updated' : 'Imported'} ${saved.company}: ${wbk.count} answers from the Excel questionnaire (${fileName}).`);
  }

  // A document the client attached as "answers in another format": map it onto this client.
  async function mapStoredFile(c, f) {
    setToast(null);
    try {
      const blob = await getBlob(c.id, f.path);
      if (!blob) throw new Error('File not found in this browser.');
      const file = new File([blob], f.name, { type: f.type || blob.type });
      const wbk = await readOfflineWorkbook(file, c.questions).catch(() => null);
      if (wbk) await importOffline(wbk, f.name, c.id);
      else await startMapping(file, c.id);
    } catch (e) { setToast({ kind: 'warn', text: `${f.name}: ${e.message}` }); }
  }

  async function importResponse({ doc, blobs }, fileName, targetId) {
    const all = await listClients();
    const match = targetId || all.find((c) => c.linkId && c.linkId === doc.linkId)?.id;
    const existing = match ? await getClient(match) : null;
    const base = existing || { id: newClientId(), createdAt: new Date().toISOString(), review: {}, linkId: doc.linkId };
    const files = {};
    const answers = { ...doc.answers };
    for (const q of doc.questions.filter((x) => x.type === 'file')) {
      files[q.id] = [];
      for (const f of answers[q.id] || []) {
        if (blobs[f.path]) { await saveBlob(base.id, f.path, blobs[f.path]); files[q.id].push(f); }
      }
      answers[q.id] = files[q.id];
    }
    const template = doc.template || base.template || 'strategy';
    const known = new Map(allQuestions(null, template).map((q) => [q.id, q]));
    const questions = doc.questions.map((q) => known.get(q.id) || { ...q, custom: true });
    const saved = await saveClient({
      ...base, template, company: doc.company || base.company || 'Untitled client', questions, answers, files,
      status: doc.complete ? 'received' : 'progress', receivedAt: doc.savedAt,
      sources: [...(base.sources || []), { file: fileName, at: new Date().toISOString() }],
    });
    await refresh();
    const other = (files.file_answers || [])[0];
    if (other) {
      await open(saved.id, 'responses');
      setToast({ kind: 'tip', text: `${existing ? 'Updated' : 'Imported'} ${saved.company}. They uploaded their answers as “${other.name}” instead of (or as well as) answering online.`, action: { label: 'Map those answers', fn: () => mapStoredFile(saved, other) } });
      return;
    }
    open(saved.id, 'responses', `${existing ? 'Updated' : 'Imported'} ${saved.company}: ${answeredCount(questions.filter((q) => q.type !== 'file'), answers)} answers${Object.values(files).flat().length ? ` and ${Object.values(files).flat().length} file${Object.values(files).flat().length === 1 ? '' : 's'}` : ''}${doc.complete ? '' : ' (client saved progress; not final)'}.`);
  }

  async function loadSample(template = 'strategy') {
    const fin = template === 'finsys';
    const answers = fin ? FINSYS_SAMPLE_ANSWERS : SAMPLE_ANSWERS;
    const questions = allQuestions(null, template);
    const c = await saveClient({ id: newClientId(), createdAt: new Date().toISOString(), template, company: answers.company_name, contact: fin ? 'Maria Chen' : 'Dana Ruiz', questions, answers: { ...answers }, files: {}, review: {}, status: 'received', receivedAt: new Date().toISOString(), sample: true });
    await refresh();
    open(c.id, 'responses', 'Sample client loaded (fake data). Check the suggested flags, then go to Deck: “Fill with the sample AI reply” → Build.');
  }

  const onDrop = (e) => { e.preventDefault(); setDrag(false); const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) importFiles(fs); };

  return (
    <>
      <BrandBar subtitle="Pre-kickoff workspace" />
      <div className="admin">
        <aside className="side">
          <button className="btn primary" onClick={() => setView({ kind: 'new' })}>+ New client link</button>
          <div className={`dropzone ${drag ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} style={{ padding: 14 }}>
            <strong className="small">{busy ? 'Reading…' : 'Import a completed questionnaire'}</strong>
            <span className="muted small">Response .zip from your link, or any Word, PDF, Excel or text file</span>
            <label className="btn small">Choose file…<input type="file" multiple hidden accept=".zip,.json,.docx,.pdf,.xlsx,.xlsm,.csv,.txt,.md,.html,.htm" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) importFiles(fs); }} /></label>
          </div>
          <h3>Clients</h3>
          {clients.length === 0 && <span className="muted small">None yet.</span>}
          {clients.map((c) => (
            <button key={c.id} className={`client-btn ${view.kind === 'client' && client?.id === c.id ? 'on' : ''}`} onClick={() => open(c.id)}>
              <strong>{c.company}</strong>
              <span>{STATUS[c.status]?.[0] || c.status} · {new Date(c.updatedAt).toLocaleDateString()}</span>
            </button>
          ))}
          <h3>Setup</h3>
          <button className="client-btn" onClick={() => setView({ kind: 'master' })}><strong>Master questionnaires</strong><span>{Object.keys(TEMPLATES).length} templates · {loadCustom().length} added questions</span></button>
          <button className="client-btn" onClick={() => setView({ kind: 'settings' })}><strong>Settings and backup</strong><span>Your details, AI key, backup</span></button>
          <button className="client-btn" onClick={() => loadSample('strategy')}><strong>Sample: business strategy</strong><span>Fake SaaS company</span></button>
          <button className="client-btn" onClick={() => loadSample('finsys')}><strong>Sample: financial system</strong><span>Fake mid-sized distributor</span></button>
        </aside>

        <main className="main">
          {toast && <div className={`callout ${toast.kind} with-action`}><div>{toast.text}</div><div className="row tight">{toast.action && <button className="btn small primary" onClick={toast.action.fn}>{toast.action.label}</button>}<button className="btn ghost small" aria-label="Dismiss" onClick={() => setToast(null)}>✕</button></div></div>}
          {view.kind === 'home' && <Home onNew={() => setView({ kind: 'new' })} onSample={() => loadSample('strategy')} />}
          {view.kind === 'new' && <NewClient onCreated={async (c) => { await refresh(); open(c.id, 'link'); }} onCancel={() => setView({ kind: 'home' })} />}
          {view.kind === 'map' && <MapFlow pending={view.pending} clients={clients} onCancel={() => setView({ kind: client ? 'client' : 'home' })} onDone={async (id, note) => { await refresh(); open(id, 'responses', note); }} />}
          {view.kind === 'master' && <MasterQuestions />}
          {view.kind === 'settings' && <Settings onRestored={refresh} />}
          {view.kind === 'client' && client && (
            <>
              <div className="main-head">
                <div>
                  <div className="muted small">{client.contact || client.answers?.respondent || ''}</div>
                  <h1>{client.company}</h1>
                </div>
                <span className={`badge ${STATUS[client.status]?.[1] || ''}`}>{STATUS[client.status]?.[0] || client.status}</span>
                <span className="badge">{templateOf(client.template).label}</span>
                <span className="topbar-spacer" />
                <label className="btn small">Import answers into this client…<input type="file" hidden accept=".zip,.json,.docx,.pdf,.xlsx,.xlsm,.csv,.txt,.md,.html,.htm" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) importFiles(fs, client.id); }} /></label>
              </div>
              <nav className="tabs" aria-label="Client">
                {[['responses', 'Responses'], ['deck', 'Deck'], ['plan', 'Project plan'], ['files', 'Files'], ['link', 'Link']].map(([k, l]) => (
                  <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setToast(null); }}>{l}</button>
                ))}
              </nav>
              {tab === 'responses' && (Object.keys(client.answers || {}).length
                ? <ResponsesView key={client.id} client={client} update={update} startInEdit={!!client.fillByHand} />
                : <div className="empty-state card"><h2>No answers yet</h2><p>When the client emails their response file (or their filled-in Excel or Word version), drop it on “Import”. It is matched to this client automatically. Or fill in the answers yourself, for example during a call.</p>
                  <button className="btn primary" onClick={() => update((c) => ({ ...c, fillByHand: true, answers: { company_name: c.company } }))}>Answer the questions yourself</button></div>)}
              {tab === 'deck' && <DeckBuilder client={client} update={update} sampleReply={client.sample ? (client.template === 'finsys' ? FINSYS_SAMPLE_AI_REPLY : SAMPLE_AI_REPLY) : ''} />}
              {tab === 'plan' && <PlanBuilder client={client} update={update} goToDeck={() => setTab('deck')} />}
              {tab === 'files' && <FilesTab client={client} onMap={(f) => mapStoredFile(client, f)} />}
              {tab === 'link' && <LinkTab client={client} update={update} />}
              <div style={{ marginTop: 30 }}>
                <DeleteClient onDelete={async () => { await deleteClient(client.id); setClient(null); setView({ kind: 'home' }); refresh(); }} />
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function Home({ onNew, onSample }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      <h1>Pre-kickoff workspace</h1>
      <ol className="steps-ol">
        <li><strong>Create a client link</strong> and email it. The client answers one section per screen; it saves on their device.</li>
        <li><strong>They send back a response file</strong> (a .zip with answers and documents). Drop it on “Import”. You can also import a questionnaire they completed in Word, PDF or Excel — an AI maps it to your questions, and anything new is added to your master questionnaire.</li>
        <li><strong>Review</strong>: flag vague or contradictory answers, add notes, copy a follow-up email.</li>
        <li><strong>Build the kickoff deck and project plan</strong> with any AI (copy prompt → paste reply) or the built-in AI, then export PowerPoint, PDF and Excel.</li>
      </ol>
      <div className="callout note">Client data stays in this browser (and in the files clients send you). Use Settings → Download backup now and then.</div>
      <div className="row tight"><button className="btn primary" onClick={onNew}>Create a client link</button><button className="btn" onClick={onSample}>Try it with a sample client</button></div>
    </div>
  );
}

function NewClient({ onCreated, onCancel }) {
  const [f, setF] = useState({ company: '', contact: '', due: '', template: 'strategy' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function create() {
    const s = loadSettings();
    const linkId = newLinkId();
    const linkCfg = { id: linkId, template: f.template, company: f.company.trim(), contact: f.contact.trim(), consultant: s.consultant, email: s.email, due: f.due.trim() };
    const c = await saveClient({ id: newClientId(), createdAt: new Date().toISOString(), template: f.template, company: f.company.trim() || 'Untitled client', contact: f.contact.trim(), linkId, linkCfg, status: 'sent', questions: allQuestions(null, f.template), answers: {}, files: {}, review: {} });
    onCreated(c);
  }
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <h1>New client link</h1>
      <div className="row">
        <label className="field"><span className="field-label">Client company</span><input value={f.company} onChange={set('company')} placeholder="Harborline Health Software" /></label>
        <label className="field"><span className="field-label">Contact name</span><input value={f.contact} onChange={set('contact')} placeholder="Dana Ruiz" /></label>
      </div>
      <div className="field"><span className="field-label">Questionnaire</span>
        <div className="choice-grid">
          {Object.values(TEMPLATES).map((t) => <button key={t.id} type="button" className={`choice ${f.template === t.id ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, template: t.id }))}>{t.label}</button>)}
        </div>
        <span className="field-hint">{templateOf(f.template).description} {allQuestions(null, f.template).filter((q) => q.type !== 'file').length} questions.</span>
      </div>
      <label className="field" style={{ maxWidth: 300 }}><span className="field-label">Please return by (optional)</span><input value={f.due} onChange={set('due')} placeholder="Friday, October 16" /></label>
      {!loadSettings().email && <div className="callout warn">Add your email under Settings so the client’s “Open a new email” button is addressed to you.</div>}
      <div className="row tight"><button className="btn primary" disabled={!f.company.trim()} onClick={create}>Create link</button><button className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function LinkTab({ client, update }) {
  const [msg, setMsg] = useState(null);
  const cfg = client.linkCfg;
  if (!cfg) return <div className="callout note">This client was imported from a file, so there is no questionnaire link. Create a new client link if you want them to fill in the questionnaire.</div>;
  const url = makeLink({ ...cfg, custom: loadCustom(cfg.template || 'strategy'), base: loadVersion(cfg.template || 'strategy')?.questions || null });
  const first = (cfg.contact || '').split(' ')[0];
  const s = loadSettings();
  const mail = `mailto:?subject=${encodeURIComponent(`Before we kick off — a short questionnaire for ${cfg.company}`)}&body=${encodeURIComponent(`Hi ${first || 'there'},\n\nAhead of our kickoff, please fill in this questionnaire. It takes about 30 minutes, saves as you go, and you can stop and come back on the same computer:\n\n${url}\n\nAt the end it gives you a file to email back to me.${cfg.due ? ` If you can, please send it by ${cfg.due}.` : ''}\n\nThanks,\n${s.consultant || ''}\nThe BK Consulting Group`)}`;
  return (
    <div className="deck" style={{ maxWidth: 820 }}>
      <p className="muted" style={{ margin: 0 }}>The link carries the client’s name and your current master questions (including any you have added). Nothing is stored on a server.</p>
      <div className="link-box">{url}</div>
      <div className="row tight">
        <button className="btn primary" onClick={async () => setMsg(await copyText(url) ? 'Link copied.' : 'Copy blocked — select the link above and copy it.')}>Copy link</button>
        <a className="btn" href={mail}>Draft email to client</a>
        <a className="btn ghost" href={url.replace(/^.*?#/, '#')} target="_blank" rel="noreferrer">Preview as client</a>
        <button className="btn ghost" onClick={async () => { const qs = client.questions?.length ? client.questions : allQuestions(null, cfg.template); downloadBlob(await offlineWorkbookBlob({ questions: qs, link: cfg, answers: client.answers || {} }), `${safeName(cfg.company || 'client')}-questionnaire.xlsx`); setMsg('Excel questionnaire downloaded — email it if the client prefers a document. When it comes back, drop it on Import: answers map exactly, no AI needed.'); }}>Download as Excel</button>
        <button className="btn ghost" onClick={() => update((c) => ({ ...c, status: 'sent' }))}>Mark as sent</button>
      </div>
      {msg && <div className="callout tip">{msg}</div>}
      <div className="callout note">Response files are matched to this client by the link’s ID ({cfg.id}). If you add master questions later, send a fresh copy of the link so the client sees them.</div>
    </div>
  );
}

function FilesTab({ client, onMap }) {
  const groups = Object.entries(client.files || {}).filter(([, l]) => l.length);
  if (!groups.length) return <div className="empty-state card"><h2>No files</h2><p>Documents the client attaches in the questionnaire (pitch deck, financials, board deck) appear here after you import their response file.</p></div>;
  const label = (id) => (client.questions || []).find((q) => q.id === id)?.label || id;
  return (
    <div className="deck" style={{ maxWidth: 820 }}>
      {groups.map(([qid, list]) => (
        <div key={qid} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong>{label(qid)}</strong>
          {list.map((f) => (
            <div key={f.path} className="file-row">
              <span>{f.name}</span><span className="muted small">{fmtSize(f.size)}</span>
              <button className="btn small" onClick={async () => { const b = await getBlob(client.id, f.path); if (b) downloadBlob(b, f.name); }}>Download</button>
              {/\.(docx|pdf|xlsx|xlsm|csv|txt|md|html?)$/i.test(f.name) && <button className="btn small" onClick={() => onMap(f)}>Map answers from this file</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DeleteClient({ onDelete }) {
  const [arm, setArm] = useState(false);
  return <button className="btn ghost small danger" onClick={() => { if (arm) onDelete(); else { setArm(true); setTimeout(() => setArm(false), 4000); } }}>{arm ? 'Click again to delete this client and its files from this browser' : 'Delete client'}</button>;
}

function Settings({ onRestored }) {
  const [s, setS] = useState(loadSettings);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => { const next = { ...s, [k]: e.target.value }; setS(next); saveSettings(next); };
  return (
    <div className="deck" style={{ maxWidth: 720 }}>
      <h1>Settings and backup</h1>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row">
          <label className="field"><span className="field-label">Your name (shown to clients)</span><input value={s.consultant} onChange={set('consultant')} /></label>
          <label className="field"><span className="field-label">Email clients send their file to</span><input type="email" value={s.email} onChange={set('email')} placeholder="you@thebkcg.com" /></label>
        </div>
        <label className="field"><span className="field-label">Admin key for “Draft with AI” (only if you set ADMIN_KEY in Vercel)</span><input type="password" value={s.adminKey} onChange={set('adminKey')} autoComplete="off" /></label>
        <span className="muted small">Saved in this browser. New links pick up your name and email; existing links keep what they had.</span>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <strong>Backup</strong>
        <span className="muted small">All clients, notes, decks, plans, files and added questions live in this browser only. Download a backup regularly, and restore it on another computer or after clearing browser data.</span>
        <div className="row tight">
          <button className="btn primary" onClick={async () => { downloadBlob(await backupZip(), `bkcg-kickoff-backup-${new Date().toISOString().slice(0, 10)}.zip`); setMsg({ kind: 'tip', text: 'Backup downloaded.' }); }}>Download backup</button>
          <label className="btn">Restore from backup…<input type="file" hidden accept=".zip" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const n = await restoreZip(f); setMsg({ kind: 'tip', text: `Restored ${n} clients.` }); onRestored(); } catch (err) { setMsg({ kind: 'warn', text: err.message }); } }} /></label>
        </div>
        {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
      </div>
    </div>
  );
}
