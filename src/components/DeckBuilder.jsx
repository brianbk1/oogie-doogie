import { useMemo, useState } from 'react';
import SlideSvg from './SlideSvg.jsx';
import { LAYOUTS } from '../lib/slides/layouts.js';
import {
  chartLibrary, slideState, buildPrompt, parseAiResult, looksLikeOurPrompt, starterDeck, starterPlan, slideId, cleanChart,
} from '../lib/deckModel.js';
import { callAi, copyText } from '../lib/ai.js';

// Reused from mgr-acct-class: same three-step AI flow (copy prompt → paste reply → build),
// same filmstrip + SVG preview + per-layout editor. Adapted to questionnaire answers.

function readImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read that image.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image the browser can read.'));
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ src: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height });
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const TOPIC_TITLE = /^(executive summary|current state|key problems|problems|opportunities|focus areas|risks|next steps|overview|agenda|background|summary|new slide)$/i;

export default function DeckBuilder({ client, update, sampleReply = '' }) {
  const deck = client.deck;
  const state = useMemo(() => slideState(client), [client]);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [paste, setPaste] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [arm, setArm] = useState('');
  const [undo, setUndo] = useState(null);

  const charts = useMemo(() => chartLibrary(client.answers), [client.answers]);
  const prompt = useMemo(() => buildPrompt(client), [client]);
  const metrics = useMemo(() => state.facts.map((f, i) => ({ id: `f${i}`, label: f.label.replace(/\s*\(.*?\)\s*$/, '').replace(/\?$/, ''), value: f.value, sub: f.section })), [state.facts]);

  const confirmArm = (key, fn) => {
    if (arm !== key) { setArm(key); setTimeout(() => setArm((a) => (a === key ? '' : a)), 4000); return; }
    setArm(''); fn();
  };

  function startFromAnswers() {
    setUndo({ deck: client.deck || null, plan: client.plan || null });
    const d = starterDeck(client);
    update((c) => ({ ...c, deck: d, plan: c.plan && c.plan.rows?.length ? c.plan : starterPlan(c) }));
    setSel(null);
    setMsg({ kind: 'tip', text: 'Starter deck built from the answers (and a starter plan if there was none). Headlines are drafts — rewrite them as your conclusions, or use the AI steps above.' });
  }

  if (!deck) {
    return (
      <div className="deck">
        <AiSteps {...{ prompt, paste, setPaste, busy, showPrompt, setShowPrompt, onCopy: copyPrompt, onBuild: () => build(paste, 'from your AI’s reply') && setPaste(''), onDraft: draftWithAi, deck: null, sampleReply }} />
        {showPrompt && <textarea className="prompt-box" readOnly value={prompt} rows={12} onFocus={(e) => e.target.select()} />}
        {msg && <Msg msg={msg} />}
        <div className="empty-state card">
          <h2>No deck yet</h2>
          <p>Use the AI steps above, or start from a deck built directly from the answers (no AI) and edit it.</p>
          <button className="btn primary" onClick={startFromAnswers}>Start from the answers</button>
        </div>
      </div>
    );
  }

  const setDeck = (fn) => update((c) => ({ ...c, deck: fn(c.deck) }));
  const patchDeck = (p) => setDeck((d) => ({ ...d, ...p }));
  const patchSlide = (id, p) => setDeck((d) => ({ ...d, slides: d.slides.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const selected = deck.slides.find((x) => x.id === sel) || deck.slides[1] || deck.slides[0];
  const idx = deck.slides.indexOf(selected);
  const content = deck.slides.filter((x) => x.kind === 'content');
  const unverified = content.filter((x) => !x.verified).length;
  const aiUnverified = content.filter((x) => x.fromAi && !x.verified).length;
  const topicTitles = content.filter((x) => words(x.title) < 5 || TOPIC_TITLE.test(String(x.title).trim())).length;

  function move(id, dir) {
    setDeck((d) => {
      const arr = [...d.slides];
      const i = arr.findIndex((x) => x.id === id), j = i + dir;
      if (arr[i]?.kind !== 'content' || arr[j]?.kind !== 'content') return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, slides: arr };
    });
  }
  function addSlide(layout = 'cards') {
    const L = LAYOUTS[layout];
    const s = { id: slideId(), kind: 'content', layout, eyebrow: '', title: 'New slide', subtitle: '', takeaway: '', notes: '', verified: false, chart: '' };
    s[L.list.key] = layout === 'summary' || layout === 'timeline' ? [] : L.list.strings ? [''] : [{ ...L.list.add }];
    if (L.spotlight) s.spotlight = {};
    setDeck((d) => {
      const arr = [...d.slides];
      const end = arr.findIndex((x) => x.kind === 'facts');
      arr.splice(layout === 'summary' ? 1 : end >= 0 ? end : arr.length, 0, s);
      return { ...d, slides: arr };
    });
    setSel(s.id);
  }
  function duplicate(s) {
    const copy = { ...JSON.parse(JSON.stringify(s)), id: slideId(), verified: false };
    setDeck((d) => { const arr = [...d.slides]; arr.splice(arr.findIndex((x) => x.id === s.id) + 1, 0, copy); return { ...d, slides: arr }; });
    setSel(copy.id);
  }
  function changeLayout(s, layout) {
    const L = LAYOUTS[layout];
    const p = { layout };
    if (!Array.isArray(s[L.list.key])) p[L.list.key] = layout === 'summary' || layout === 'timeline' ? [] : L.list.strings ? [''] : [{ ...L.list.add }];
    if (L.spotlight && !s.spotlight) p.spotlight = {};
    patchSlide(s.id, p);
  }

  // One-click Build from an AI reply, with Undo.
  function build(text, source) {
    if (looksLikeOurPrompt(text)) {
      setMsg({ kind: 'warn', text: 'That looks like the prompt from step 1, not the AI’s answer. Paste the prompt into ChatGPT, Claude or Copilot first, then paste the AI’s reply here.' });
      return false;
    }
    const parsed = parseAiResult(text);
    if (!parsed || !parsed.slides.length) {
      setMsg({ kind: 'warn', text: 'No slides found in that text. Paste the AI’s whole answer, including the ```json block. If the reply was cut off, ask the AI to “continue” and paste both parts.' });
      return false;
    }
    setUndo({ deck: client.deck || null, plan: client.plan || null });
    update((c) => {
      const base = c.deck || starterDeck(c);
      const title = base.slides.find((x) => x.kind === 'title') || { id: slideId(), kind: 'title' };
      const facts = base.slides.find((x) => x.kind === 'facts');
      return {
        ...c,
        deck: { ...base, title: parsed.title || base.title, subtitle: parsed.subtitle || base.subtitle, health: parsed.health || base.health, slides: [title, ...parsed.slides, ...(facts ? [facts] : [])] },
        plan: parsed.plan || c.plan || starterPlan(c),
      };
    });
    setSel(parsed.slides[0].id);
    setMsg({ kind: 'tip', text: `Built ${parsed.slides.length} slides${parsed.plan ? ` and a ${parsed.plan.rows.length}-row project plan` : ''} ${source}. AI slides are tagged “AI” until you mark them verified.` });
    return true;
  }
  async function copyPrompt() {
    if (await copyText(prompt)) setMsg({ kind: 'tip', text: 'Copied. Paste it into ChatGPT, Claude or Copilot, then paste the whole reply into box 2 and click Build.' });
    else { setShowPrompt(true); setMsg({ kind: 'note', text: 'Your browser blocked copying. The prompt is shown below — click in it, select all, and copy.' }); }
  }
  async function draftWithAi() {
    setBusy('ai'); setMsg({ kind: 'note', text: 'Drafting… this usually takes 1–3 minutes.' });
    try { build(await callAi('deck', prompt), 'by the built-in AI'); } catch (e) { setMsg({ kind: 'warn', text: e.message }); }
    setBusy('');
  }
  async function download(kind) {
    setBusy(kind); setMsg(null);
    try {
      const ex = await import('../lib/slides/backends.js');
      if (kind === 'pptx') await ex.exportPptx(deck, state); else await ex.exportPdf(deck, state);
      setMsg({ kind: 'tip', text: `${kind === 'pptx' ? 'PowerPoint' : 'PDF'} downloaded.${unverified ? ` ${unverified} slide${unverified > 1 ? 's are' : ' is'} not marked verified yet.` : ''}` });
    } catch (e) {
      setMsg({ kind: 'warn', text: `Download failed: ${e.message || e}` });
    }
    setBusy('');
  }

  return (
    <div className="deck">
      <AiSteps {...{ prompt, paste, setPaste, busy, showPrompt, setShowPrompt, onCopy: copyPrompt, onBuild: () => build(paste, 'from your AI’s reply') && setPaste(''), onDraft: draftWithAi, deck, sampleReply }}>
        <ul className="deck-checks">
          <li className={aiUnverified === 0 ? 'ok' : ''}><span className="gate-dot">{aiUnverified === 0 ? '✓' : ''}</span>{content.length - unverified} of {content.length} slides verified{aiUnverified ? ` · ${aiUnverified} AI slides to check` : ''}</li>
          <li className={topicTitles === 0 ? 'ok' : ''}><span className="gate-dot">{topicTitles === 0 ? '✓' : ''}</span>{topicTitles ? `${topicTitles} headline${topicTitles > 1 ? 's read' : ' reads'} like a topic — state the conclusion` : 'Every headline states a conclusion'}</li>
        </ul>
        <div className="row tight">
          <button className="btn small primary" onClick={() => download('pptx')} disabled={!!busy}>{busy === 'pptx' ? 'Building…' : 'Download PowerPoint'}</button>
          <button className="btn small" onClick={() => download('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Building…' : 'Download PDF'}</button>
        </div>
      </AiSteps>

      {showPrompt && <textarea className="prompt-box" readOnly value={prompt} rows={12} onFocus={(e) => e.target.select()} />}
      {msg && <Msg msg={msg} undo={undo && msg.kind === 'tip' ? () => { update((c) => ({ ...c, deck: undo.deck, plan: undo.plan })); setUndo(null); setSel(null); setMsg({ kind: 'note', text: 'Restored your previous deck and plan.' }); } : null} />}

      <div className="deck-body">
        <aside className="filmstrip" aria-label="Slides">
          {deck.slides.map((s, i) => (
            <button key={s.id} className={`film ${selected?.id === s.id ? 'on' : ''}`} onClick={() => setSel(s.id)}>
              <span className="film-num">{i + 1}</span>
              <span className="film-img"><SlideSvg slide={s} deck={deck} state={state} n={i + 1} total={deck.slides.length} /></span>
              {s.kind === 'content' && (s.verified ? <span className="badge good">✓</span> : s.fromAi ? <span className="badge warn">AI</span> : null)}
            </button>
          ))}
          <div className="add-slide">
            <select id="add-layout" defaultValue="" onChange={(e) => { if (e.target.value) { addSlide(e.target.value); e.target.value = ''; } }}>
              <option value="">+ Add slide…</option>
              {Object.entries(LAYOUTS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
            </select>
          </div>
          <button className="link small" style={{ textAlign: 'left' }} onClick={() => confirmArm('restart', startFromAnswers)}>{arm === 'restart' ? 'Click again to replace all slides' : 'Rebuild from the answers (no AI)'}</button>
        </aside>

        <div className="slide-work">
          <div className="slide-stage">
            <SlideSvg slide={selected} deck={deck} state={state} n={idx + 1} total={deck.slides.length} />
          </div>
          {selected.kind === 'title' && <TitleEditor deck={deck} patchDeck={patchDeck} onError={(t) => setMsg({ kind: 'warn', text: t })} />}
          {selected.kind === 'facts' && (
            <div className="slide-editor">
              <p className="muted small" style={{ margin: 0 }}>Appendix: lists every numeric answer from the questionnaire ({state.facts.length}; the first 14 fit on the slide). Delete it if you do not want it.</p>
              <div className="row tight">
                <button className="btn ghost small" onClick={() => confirmArm(`del-${selected.id}`, () => { setDeck((d) => ({ ...d, slides: d.slides.filter((x) => x.id !== selected.id) })); setSel(null); })}>{arm === `del-${selected.id}` ? 'Click again to delete' : 'Delete appendix'}</button>
              </div>
            </div>
          )}
          {selected.kind === 'content' && (
            <SlideEditor
              slide={selected} charts={charts} metrics={metrics} onError={(t) => setMsg({ kind: 'warn', text: t })} patch={(p) => patchSlide(selected.id, p)}
              onMove={(d) => move(selected.id, d)} onDuplicate={() => duplicate(selected)}
              onDelete={() => confirmArm(`del-${selected.id}`, () => { setDeck((d) => ({ ...d, slides: d.slides.filter((x) => x.id !== selected.id) })); setSel(null); })}
              deleteArmed={arm === `del-${selected.id}`} onLayout={(l) => changeLayout(selected, l)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Msg({ msg, undo }) {
  return (
    <div className={`callout ${msg.kind} with-action`}>
      <div>{msg.text}</div>
      {undo && <button className="btn small" onClick={undo}>Undo</button>}
    </div>
  );
}

function AiSteps({ paste, setPaste, busy, setShowPrompt, showPrompt, onCopy, onBuild, onDraft, children, deck, sampleReply }) {
  return (
    <section className="deck-ai">
      <div className="deck-ai-step">
        <span className="step-badge">1</span>
        <div>
          <strong>Copy the prompt into any AI</strong>
          <p className="muted small">Bundles the answers, your notes and flags, and asks for the deck and plan as JSON.</p>
          <div className="row tight">
            <button className="btn small primary" onClick={onCopy}>Copy prompt</button>
            <button className="link small" onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? 'Hide' : 'Show'} prompt</button>
          </div>
        </div>
      </div>
      <div className="deck-ai-step">
        <span className="step-badge">2</span>
        <div>
          <strong>Paste the AI’s reply and build</strong>
          <textarea id="deck-paste" rows={3} value={paste} placeholder="Paste the whole reply, including the ```json block" onChange={(e) => setPaste(e.target.value)} />
          <div className="row tight">
            <button className="btn small primary" onClick={onBuild} disabled={!paste.trim()}>Build deck + plan</button>
            <span className="muted small">or</span>
            <button className="btn small" onClick={onDraft} disabled={!!busy}>{busy === 'ai' ? 'Drafting…' : 'Draft with AI'}</button>
          </div>
          {sampleReply && <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setPaste(sampleReply)}>Fill with the sample AI reply (demo)</button>}
        </div>
      </div>
      <div className="deck-ai-step">
        <span className="step-badge">3</span>
        <div>
          <strong>Check, edit, export</strong>
          {children || <p className="muted small">{deck ? '' : 'Once built, every slide is editable. AI slides stay tagged until you verify them.'}</p>}
        </div>
      </div>
    </section>
  );
}

function TitleEditor({ deck, patchDeck, onError }) {
  const F = (k, label, ph) => (
    <label className="field"><span className="field-label">{label}</span>
      <input id={`deck-${k}`} value={deck[k] || ''} placeholder={ph} onChange={(e) => patchDeck({ [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="slide-editor">
      <div className="row">{F('title', 'Deck title')}{F('subtitle', 'Subtitle')}</div>
      <div className="row three">
        {F('company', 'Client')}
        {F('audience', 'Audience', 'Leadership team')}
        <label className="field"><span className="field-label">Overall read</span>
          <select id="deck-health" value={deck.health || ''} onChange={(e) => patchDeck({ health: e.target.value })}>
            <option value="">Not shown</option><option>Green</option><option>Yellow</option><option>Red</option>
          </select>
        </label>
      </div>
      <div className="row">{F('presenters', 'Presented by')}{F('date', 'Date')}</div>
      <div className="row">{F('sourceNote', 'Source line')}{F('takeawayLabel', 'Label on the takeaway bar', 'So what')}</div>
      <ImagePicker label="Cover image or client logo (optional — shown on the right of the title slide)" src={deck.image} onPick={(img) => patchDeck({ image: img.src, imageW: img.w, imageH: img.h })} onClear={() => patchDeck({ image: '', imageW: 0, imageH: 0 })} onError={onError} />
      <label className="inline-check field"><input type="checkbox" checked={!!deck.confidential} onChange={(e) => patchDeck({ confidential: e.target.checked })} /> Mark slides “Confidential”</label>
    </div>
  );
}

function ChartPicker({ id, value, charts, onChange, emptyLabel }) {
  const custom = value && typeof value === 'object';
  const c = custom ? value : null;
  const setC = (p) => onChange({ type: 'bar', title: '', labels: [], values: [], unit: '', source: 'Pre-kickoff questionnaire', ...c, ...p });
  return (
    <div className="field">
      <select id={id} value={custom ? '__custom' : value || ''} onChange={(e) => {
        const v = e.target.value;
        if (v === '__custom') setC({ title: 'New chart', labels: ['A', 'B'], values: [1, 2] });
        else onChange(v);
      }}>
        <option value="">{emptyLabel}</option>
        {charts.length > 0 && <optgroup label="From the answers">{charts.map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}</optgroup>}
        <option value="__custom">Custom chart (type your own numbers)…</option>
      </select>
      {c && (
        <div className="chart-edit" style={{ marginTop: 6 }}>
          <select aria-label="Chart type" value={c.type} onChange={(e) => setC({ type: e.target.value })}><option value="bar">Bar</option><option value="line">Line</option></select>
          <input aria-label="Chart title" value={c.title} placeholder="Chart title" onChange={(e) => setC({ title: e.target.value })} />
          <select aria-label="Unit" value={c.unit || ''} onChange={(e) => setC({ unit: e.target.value })}><option value="">number</option><option value="$">$</option><option value="%">%</option><option value="x">×</option><option value="mo">months</option><option value="/5">1–5 score</option></select>
          <input className="wide" aria-label="Labels" value={(c.labels || []).join(', ')} placeholder="Labels, comma-separated" onChange={(e) => setC({ labels: e.target.value.split(',').map((s) => s.trim()) })} />
          <input className="wide" aria-label="Values" value={(c.values || []).join(', ')} placeholder="Values, comma-separated (same count as labels)" onChange={(e) => setC({ values: e.target.value.split(',').map((s) => s.trim()) })} />
          {!cleanChart(c) && <span className="too-long-note wide">Enter one number for each label.</span>}
        </div>
      )}
    </div>
  );
}

function SlideEditor({ slide, charts, metrics, onError, patch, onMove, onDuplicate, onDelete, deleteArmed, onLayout }) {
  const L = LAYOUTS[slide.layout] || LAYOUTS.bullets;
  const list = slide[L.list.key] || [];
  const setList = (next) => patch({ [L.list.key]: next });
  const sp = slide.spotlight || {};
  const auto = slide.layout === 'summary' || slide.layout === 'timeline';

  return (
    <div className="slide-editor">
      <div className="row tight editor-tools">
        <select id={`layout-${slide.id}`} value={slide.layout} onChange={(e) => onLayout(e.target.value)} aria-label="Layout">
          {Object.entries(LAYOUTS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
        </select>
        <button className="btn small" onClick={() => onMove(-1)} aria-label="Move slide earlier">↑</button>
        <button className="btn small" onClick={() => onMove(1)} aria-label="Move slide later">↓</button>
        <button className="btn ghost small" onClick={onDuplicate}>Duplicate</button>
        <button className="btn ghost small" onClick={onDelete}>{deleteArmed ? 'Click again to delete' : 'Delete'}</button>
        <label className={`verify ${slide.verified ? 'on' : ''}`}>
          <input type="checkbox" checked={!!slide.verified} onChange={(e) => patch({ verified: e.target.checked })} />
          {slide.fromAi && !slide.verified ? 'AI draft — mark verified' : 'Verified'}
        </label>
      </div>

      <div className="row">
        <label className="field"><span className="field-label">Section label</span>
          <input id={`eyebrow-${slide.id}`} value={slide.eyebrow || ''} placeholder="e.g. Current state" onChange={(e) => patch({ eyebrow: e.target.value })} />
        </label>
        <label className="field"><span className="field-label">Subtitle (optional)</span>
          <input id={`subtitle-${slide.id}`} value={slide.subtitle || ''} onChange={(e) => patch({ subtitle: e.target.value })} />
        </label>
      </div>
      <label className="field"><span className="field-label">Headline — state the conclusion, not the topic</span>
        <input id={`title-${slide.id}`} className={words(slide.title) < 5 || TOPIC_TITLE.test(String(slide.title).trim()) ? 'too-long' : ''} value={slide.title || ''} placeholder="e.g. Revenue will miss plan by 18% and runway is shorter than stated" onChange={(e) => patch({ title: e.target.value })} />
      </label>

      {L.chart && <div className="field"><span className="field-label">Chart</span><ChartPicker id={`chart-${slide.id}`} value={slide.chart} charts={charts} emptyLabel={slide.layout === 'hero' ? 'Choose a chart…' : 'No chart'} onChange={(v) => patch({ chart: v })} /></div>}
      {L.chart2 && <div className="field"><span className="field-label">Second chart</span><ChartPicker id={`chart2-${slide.id}`} value={slide.chart2} charts={charts} emptyLabel="Choose a chart…" onChange={(v) => patch({ chart2: v })} /></div>}
      {L.image && <ImagePicker label="Image" src={slide.image} onPick={(img) => patch({ image: img.src, imageW: img.w, imageH: img.h })} onClear={() => patch({ image: '', imageW: 0, imageH: 0 })} onError={onError} />}

      <div className="list-edit">
        <span className="field-label">{L.list.strings ? `${L.list.label}s` : L.label}</span>
        {auto && <p className="hint-box">{slide.layout === 'summary' ? 'Tiles fill in automatically from the slides that follow (their headline and first number). Add a row only to override a tile.' : 'Rows fill in automatically from the project plan’s phases. Add rows only to override.'}</p>}
        {list.map((item, i) => (
          <div key={i} className={`list-item ${L.list.strings ? 'single' : ''}`}>
            {L.list.strings ? (
              <textarea id={`${L.list.key}-${slide.id}-${i}`} rows={slide.layout === 'narrative' ? 3 : 2} value={item} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} />
            ) : (
              <div className="item-fields">
                {L.list.fields.some((f) => f.k === 'value') && metrics.length > 0 && (
                  <label className="field wide"><span className="field-hint">Insert a number from the answers</span>
                    <select id={`metric-${slide.id}-${i}`} value="" onChange={(e) => { const m = metrics.find((x) => x.id === e.target.value); if (m) setList(list.map((x, j) => (j === i ? applyMetric(slide.layout, x, m) : x))); }}>
                      <option value="">Choose an answer… (fills the number and its label)</option>
                      {metrics.map((m) => <option key={m.id} value={m.id}>{m.label}: {m.value}</option>)}
                    </select>
                  </label>
                )}
                {L.list.fields.map((f) => (
                  <label key={f.k} className={`field ${f.area ? 'wide' : ''}`}><span className="field-hint">{f.label}</span>
                    {f.options ? (
                      <select id={`${f.k}-${slide.id}-${i}`} value={item[f.k] ?? ''} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, [f.k]: e.target.value } : x)))}>
                        {f.options.map((o) => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}
                      </select>
                    ) : f.area ? (
                      <textarea id={`${f.k}-${slide.id}-${i}`} rows={2} value={item[f.k] || ''} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, [f.k]: e.target.value } : x)))} />
                    ) : (
                      <input id={`${f.k}-${slide.id}-${i}`} className={f.words && words(item[f.k]) > f.words ? 'too-long' : ''} value={item[f.k] || ''} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, [f.k]: e.target.value } : x)))} />
                    )}
                    {f.words > 2 && words(item[f.k]) > f.words && <span className="too-long-note">{words(item[f.k])} words — keep it under {f.words}; put detail in speaker notes</span>}
                  </label>
                ))}
              </div>
            )}
            <button className="icon-btn" aria-label="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {list.length < L.list.max && (
          <button className="btn ghost small" onClick={() => setList([...list, L.list.strings ? '' : { ...L.list.add }])}>+ Add {L.list.strings ? L.list.label.toLowerCase() : auto ? 'override row' : 'row'}</button>
        )}
      </div>

      {L.spotlight && (
        <div className="list-edit">
          <span className="field-label">Spotlight number</span>
          <div className="item-fields">
            {[['label', 'Label'], ['value', 'Big number'], ['caption', 'Caption'], ['text', 'Explanation']].map(([k, label]) => (
              <label key={k} className={`field ${k === 'text' ? 'wide' : ''}`}><span className="field-hint">{label}</span>
                {k === 'text'
                  ? <textarea id={`sp-${k}-${slide.id}`} rows={2} value={sp[k] || ''} onChange={(e) => patch({ spotlight: { ...sp, [k]: e.target.value } })} />
                  : <input id={`sp-${k}-${slide.id}`} value={sp[k] || ''} onChange={(e) => patch({ spotlight: { ...sp, [k]: e.target.value } })} />}
              </label>
            ))}
          </div>
        </div>
      )}
      {L.ask && (
        <label className="field"><span className="field-label">The ask (highlighted)</span>
          <textarea id={`ask-${slide.id}`} rows={2} value={slide.ask || ''} onChange={(e) => patch({ ask: e.target.value })} />
        </label>
      )}
      {slide.layout === 'compare' && (
        <div className="row">
          <label className="field"><span className="field-label">Left column label</span><input value={slide.fromLabel || ''} placeholder="Today" onChange={(e) => patch({ fromLabel: e.target.value })} /></label>
          <label className="field"><span className="field-label">Right column label</span><input value={slide.toLabel || ''} placeholder="Proposed" onChange={(e) => patch({ toLabel: e.target.value })} /></label>
        </div>
      )}
      {slide.layout === 'scorecard' && (
        <label className="field"><span className="field-label">Footnote (optional)</span>
          <input id={`foot-${slide.id}`} value={slide.footnote || ''} onChange={(e) => patch({ footnote: e.target.value })} />
        </label>
      )}
      {slide.layout !== 'narrative' && (
        <label className="field"><span className="field-label">Takeaway (one sentence, shown in the bar at the bottom)</span>
          <input id={`takeaway-${slide.id}`} value={slide.takeaway || ''} onChange={(e) => patch({ takeaway: e.target.value })} />
        </label>
      )}
      <label className="field"><span className="field-label">Speaker notes (exported to PowerPoint)</span>
        <textarea id={`notes-${slide.id}`} rows={3} value={slide.notes || ''} onChange={(e) => patch({ notes: e.target.value })} />
      </label>
    </div>
  );
}

function applyMetric(layout, item, m) {
  const next = { ...item, value: m.value };
  if (layout === 'bignumbers') return { ...next, label: m.label, sub: m.sub };
  if (layout === 'chart') return { ...next, label: m.label, note: m.sub };
  if (layout === 'kpis') return { ...next, label: m.label, sub: m.sub };
  return { ...next, label: m.label };
}

function ImagePicker({ label, src, onPick, onClear, onError }) {
  return (
    <div className="image-pick">
      <span className="field-label">{label}</span>
      <div className="row tight">
        {src && <img src={src} alt="" className="image-thumb" />}
        <label className="btn small">
          {src ? 'Replace image' : 'Upload image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            try { onPick(await readImage(f)); } catch (err) { onError(err.message); }
          }} />
        </label>
        {src && <button className="btn ghost small" onClick={onClear}>Remove</button>}
      </div>
    </div>
  );
}
