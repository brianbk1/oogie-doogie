// Deck + plan model for the kickoff app: charts from questionnaire answers, the AI prompt,
// parsing the AI's JSON reply, and a starter deck/plan built without AI.
import { LAYOUTS, filled } from './slides/layouts.js';
import { formatAnswer, formatNumber, isAnswered, parseNumber } from './questions.js';
import { allSections } from './master.js';

export const slideId = () => `s${Math.random().toString(36).slice(2, 9)}`;
export const rowId = () => `r${Math.random().toString(36).slice(2, 9)}`;
const str = (v, max = 400) => (v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max));
const num = (answers, id) => { const n = parseNumber(answers?.[id]); return Number.isFinite(n) ? n : NaN; };

// ---------------------------------------------------------------- Number formatting used by the slide engine
export function fmtUnit(v, unit) {
  if (!Number.isFinite(v)) return '—';
  if (unit === '$') return formatNumber(v, '$');
  if (unit === '%') return `${+v.toFixed(1)}%`;
  if (unit === 'x') return `${v.toFixed(1)}×`;
  if (unit === 'mo') return `${+v.toFixed(1)} mo`;
  if (unit === '/5') return `${+v.toFixed(1)}/5`;
  return Math.abs(v) < 10 ? String(+v.toFixed(1)) : Math.round(v).toLocaleString('en-US');
}

// ---------------------------------------------------------------- State the slide engine reads
// state = { answers, questions, facts, plan }
export function slideState(client) {
  return { answers: client?.answers || {}, questions: client?.questions || [], facts: factRows(client), plan: client?.plan || null };
}

export function factRows(client) {
  if (!client) return [];
  const sections = Object.fromEntries(allSections(client.questions || []).map((s) => [s.id, s.title]));
  return (client.questions || [])
    .filter((q) => (q.type === 'number' || q.type === 'rating') && isAnswered(q, client.answers?.[q.id]))
    .map((q) => ({ label: q.label, value: formatAnswer(q, client.answers[q.id]), section: sections[q.section] || '' }));
}

// ---------------------------------------------------------------- Chart library (computed from answers)
const SRC = 'Pre-kickoff questionnaire';
const RATING_AREAS = [
  ['market_position', 'Market position'], ['rate_pmf', 'Product-market fit'], ['rate_sales', 'Sales'],
  ['rate_marketing', 'Marketing'], ['rate_pricing', 'Pricing confidence'], ['rate_org', 'Leadership alignment'], ['plan_confidence', 'Confidence in plan'],
];

export function chartLibrary(answers = {}) {
  const out = [];
  const ratings = RATING_AREAS.filter(([id]) => Number.isFinite(num(answers, id)));
  if (ratings.length >= 3) out.push({ id: 'ratings', label: 'Self-assessment by area (1–5)', data: { title: 'How leadership rates each area (1 = weak, 5 = strong)', type: 'bar', labels: ratings.map(([, l]) => l), values: ratings.map(([id]) => num(answers, id)), unit: '/5', source: SRC } });

  const probs = [1, 2, 3].filter((i) => str(answers[`problem_${i}`]) && Number.isFinite(num(answers, `problem_${i}_sev`)));
  if (probs.length >= 2) out.push({ id: 'problems', label: 'Top problems by severity', data: { title: 'Severity of the top problems (1–5)', type: 'bar', labels: probs.map((i) => clip(answers[`problem_${i}`], 34)), values: probs.map((i) => num(answers, `problem_${i}_sev`)), unit: '/5', source: SRC } });

  if (Array.isArray(answers.goal_rank) && answers.goal_rank.length >= 3) {
    const r = answers.goal_rank.slice(0, 7);
    out.push({ id: 'priorities', label: 'Priorities, ranked', data: { title: 'Priority for the next 12 months (bar length = rank, longest = #1)', type: 'bar', labels: r.map((x, i) => `${i + 1}. ${x}`), values: r.map((_, i) => r.length - i), unit: '', source: SRC } });
  }

  const tgt = num(answers, 'revenue_target'), fc = num(answers, 'revenue_forecast');
  if (Number.isFinite(tgt) && Number.isFinite(fc)) out.push({ id: 'plan_gap', label: 'Revenue: target vs. expected', data: { title: 'This year’s revenue: target vs. now expected', type: 'bar', labels: ['Target', 'Now expected', 'Gap'], values: [tgt, fc, fc - tgt], unit: '$', source: SRC } });

  const cash = num(answers, 'cash'), burn = num(answers, 'burn');
  if (Number.isFinite(cash) && Number.isFinite(burn) && burn > 0) {
    const months = Math.min(24, Math.max(6, Math.ceil(cash / burn) + 2));
    const labels = [], values = [];
    for (let m = 0; m <= months; m++) { labels.push(m === 0 ? 'Today' : `M${m}`); values.push(Math.max(cash - burn * m, Math.min(0, cash - burn * m))); }
    out.push({ id: 'cash', label: 'Cash at current burn', data: { title: 'Cash if burn stays at today’s level', type: 'line', labels, values, unit: '$', reference: { value: burn * 6, label: 'Six-month buffer' }, note: 'Straight-line projection, no new revenue growth', source: SRC } });
  }

  const grr = num(answers, 'grr'), nrr = num(answers, 'nrr');
  if (Number.isFinite(grr) || Number.isFinite(nrr)) {
    const L = [], V = [];
    if (Number.isFinite(grr)) { L.push('Gross retention'); V.push(grr); }
    if (Number.isFinite(nrr)) { L.push('Net retention'); V.push(nrr); }
    out.push({ id: 'retention', label: 'Revenue retention', data: { title: 'Revenue retention, last 12 months', type: 'bar', labels: L, values: V, unit: '%', source: SRC } });
  }

  const acv = num(answers, 'acv'), cac = num(answers, 'cac');
  if (Number.isFinite(acv) && Number.isFinite(cac)) out.push({ id: 'unit_econ', label: 'First-year contract value vs. CAC', data: { title: 'What a new customer brings in vs. what it costs to win', type: 'bar', labels: ['First-year contract value', 'Acquisition cost (CAC)'], values: [acv, cac], unit: '$', source: SRC } });
  return out;
}

const clip = (s, n) => { const t = str(s); return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t; };

// A slide's chart is either a library id ("cash") or an inline chart object from the AI / editor.
export function resolveChart(spec, state) {
  if (!spec) return null;
  if (typeof spec === 'string') return chartLibrary(state?.answers).find((c) => c.id === spec)?.data || null;
  return cleanChart(spec);
}

export function cleanChart(c) {
  if (!c || typeof c !== 'object') return null;
  const labels = (Array.isArray(c.labels) ? c.labels : []).map((l) => str(l, 40)).slice(0, 24);
  const values = (Array.isArray(c.values) ? c.values : []).map((v) => parseNumber(v)).slice(0, labels.length);
  if (labels.length < 1 || values.length !== labels.length || values.some((v) => !Number.isFinite(v))) return null;
  const unit = ['$', '%', 'x', 'mo', '/5', ''].includes(c.unit) ? c.unit : '';
  const ref = c.reference && Number.isFinite(parseNumber(c.reference.value)) ? { value: parseNumber(c.reference.value), label: str(c.reference.label, 30) || 'Target' } : null;
  return { title: str(c.title, 90) || 'Chart', type: c.type === 'line' ? 'line' : 'bar', labels, values, unit, reference: ref, note: str(c.note, 90), source: str(c.source, 60) || SRC };
}

// ---------------------------------------------------------------- Normalizing slides from AI / JSON
// Read lazily: layouts.js and this file import each other.
const listOf = (layout) => LAYOUTS[layout].list;

export function normalizeSlide(x, { fromAi = false } = {}) {
  const layout = LAYOUTS[x.layout] ? x.layout : x.bullets ? 'bullets' : x.cards ? 'cards' : 'bullets';
  const L = listOf(layout);
  const s = {
    id: slideId(), kind: 'content', layout,
    eyebrow: str(x.eyebrow || x.section, 60), title: str(x.title || x.headline, 160), subtitle: str(x.subtitle, 120),
    takeaway: str(x.takeaway, 200), notes: String(x.notes || x.speakerNotes || x.speaker_notes || '').trim().slice(0, 3000),
    verified: false, fromAi,
  };
  let list = x[L.key];
  if (!Array.isArray(list)) list = Array.isArray(x.items) ? x.items : Array.isArray(x.bullets) ? x.bullets : [];
  s[L.key] = list.slice(0, L.max).map((it) => {
    if (L.strings) return str(typeof it === 'string' ? it : it?.text || it?.title, 400);
    const o = {};
    L.fields.forEach((f) => {
      let v = it?.[f.k];
      if (f.options) { v = str(v); if (!f.options.includes(v)) v = f.k === 'tone' ? 'neutral' : f.options[0]; }
      else v = str(v, f.area ? 600 : 220);
      o[f.k] = v;
    });
    if (layout === 'summary' && it?.from) o.from = str(it.from, 20);
    return o;
  });
  if (!s[L.key].length) s[L.key] = L.strings ? [''] : [];
  if (LAYOUTS[layout].chart) s.chart = typeof x.chart === 'string' ? x.chart : x.chart ? cleanChart(x.chart) : '';
  if (LAYOUTS[layout].chart2) s.chart2 = typeof x.chart2 === 'string' ? x.chart2 : x.chart2 ? cleanChart(x.chart2) : '';
  if (LAYOUTS[layout].spotlight) s.spotlight = { label: str(x.spotlight?.label, 60), value: str(x.spotlight?.value, 20), caption: str(x.spotlight?.caption, 80), text: str(x.spotlight?.text, 400) };
  if (LAYOUTS[layout].ask) s.ask = str(x.ask, 300);
  if (layout === 'compare') { s.fromLabel = str(x.fromLabel, 20); s.toLabel = str(x.toLabel, 20); }
  return s;
}

export function normalizePlan(p, { fromAi = false } = {}) {
  const rows = (Array.isArray(p?.rows) ? p.rows : Array.isArray(p) ? p : []).slice(0, 80).map((r) => ({
    id: rowId(), phase: str(r.phase, 60), workstream: str(r.workstream, 60), task: str(r.task || r.activity, 160),
    owner: str(r.owner, 60), start: clampInt(r.start ?? r.startWeek, 1, 52, 1), weeks: clampInt(r.weeks ?? r.duration, 1, 52, 1),
    deliverable: str(r.deliverable, 160), milestone: r.milestone === true || /^(true|yes|y|1)$/i.test(String(r.milestone || '')), fromAi,
  })).filter((r) => r.task || r.phase);
  return { rows, verified: false, fromAi };
}
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

// ---------------------------------------------------------------- Paste guard + parsing the AI's reply
export const PROMPT_MARKERS = /PRE-KICKOFF BRIEF \(|SLIDES TO WRITE|OUTPUT FORMAT: one JSON object/;

export function looksLikeOurPrompt(text) {
  return PROMPT_MARKERS.test(text) && !/"slides"\s*:\s*\[\s*\{/.test(text.replace(/SLIDES TO WRITE[\s\S]*$/, ''));
}

export function extractJson(text) {
  const t = String(text || '').replace(/\r/g, '');
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : t;
  const a = body.indexOf('{'), b = body.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  const raw = body.slice(a, b + 1);
  try { return JSON.parse(raw); } catch { /* try light repair */ }
  try { return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")); } catch { return null; }
}

export function parseAiResult(text) {
  const j = extractJson(text);
  if (!j) return null;
  const d = j.deck || j;
  const slides = (Array.isArray(d.slides) ? d.slides : []).map((x) => normalizeSlide(x || {}, { fromAi: true })).filter((s) => s.title || filled(s[listOf(s.layout).key]).length);
  const plan = j.plan ? normalizePlan(j.plan, { fromAi: true }) : null;
  const health = ['Green', 'Yellow', 'Red'].find((h) => h.toLowerCase() === str(d.health).toLowerCase()) || '';
  return { title: str(d.title, 120), subtitle: str(d.subtitle, 160), health, slides, plan: plan && plan.rows.length ? plan : null };
}

// ---------------------------------------------------------------- The brief + prompt
export function computedChecks(answers) {
  const out = [];
  const cash = num(answers, 'cash'), burn = num(answers, 'burn'), runway = num(answers, 'runway');
  if (Number.isFinite(cash) && Number.isFinite(burn) && burn > 0) {
    const calc = cash / burn;
    out.push(`Runway implied by cash ÷ burn: ${calc.toFixed(1)} months${Number.isFinite(runway) ? ` (client stated ${runway} months${Math.abs(calc - runway) > Math.max(2, runway * 0.25) ? ' — DOES NOT MATCH' : ''})` : ''}`);
  }
  const tgt = num(answers, 'revenue_target'), fc = num(answers, 'revenue_forecast');
  if (Number.isFinite(tgt) && Number.isFinite(fc) && tgt) out.push(`Expected revenue vs target: ${formatNumber(fc, '$')} vs ${formatNumber(tgt, '$')} (${(((fc - tgt) / tgt) * 100).toFixed(0)}%)`);
  const acv = num(answers, 'acv'), cac = num(answers, 'cac'), gm = num(answers, 'gross_margin');
  if (Number.isFinite(acv) && Number.isFinite(cac) && acv > 0) {
    const pay = Number.isFinite(gm) && gm > 0 ? cac / ((acv / 12) * (gm / 100)) : cac / (acv / 12);
    out.push(`CAC payback: ~${pay.toFixed(0)} months${Number.isFinite(gm) ? ' (gross-margin adjusted)' : ''}; first-year contract value ÷ CAC = ${(acv / cac).toFixed(1)}x`);
  }
  const grr = num(answers, 'grr'), nrr = num(answers, 'nrr');
  if (Number.isFinite(grr) && Number.isFinite(nrr) && nrr < grr) out.push(`Net retention (${nrr}%) is below gross retention (${grr}%) — that is impossible by definition; one of the two is wrong`);
  const share = num(answers, 'top_customer_share');
  if (Number.isFinite(share) && share >= 20) out.push(`Customer concentration: largest customer is ${share}% of revenue`);
  return out;
}

export function buildBrief(client) {
  const { answers = {}, questions = [], review = {} } = client;
  const L = [];
  const company = str(answers.company_name || client.company) || 'the client';
  L.push(`PRE-KICKOFF BRIEF (from ${company}'s questionnaire${client.receivedAt ? `, received ${client.receivedAt.slice(0, 10)}` : ''})`);
  allSections(questions).forEach((s) => {
    const qs = questions.filter((q) => q.section === s.id);
    const lines = qs.filter((q) => isAnswered(q, answers[q.id])).map((q) => {
      const flag = review.flags?.[q.id];
      const note = str(review.notes?.[q.id], 600);
      return `- ${q.label}: ${formatAnswer(q, answers[q.id])}${flag ? `  [CONSULTANT FLAG: ${flag}]` : ''}${note ? `  [CONSULTANT NOTE: ${note}]` : ''}`;
    });
    if (!lines.length) return;
    L.push(`\n## ${s.title}`);
    L.push(...lines);
  });
  const blank = questions.filter((q) => q.type !== 'file' && !isAnswered(q, answers[q.id]));
  if (blank.length) L.push(`\n## Not answered\n${blank.map((q) => q.label).join('; ')}`);
  const checks = computedChecks(answers);
  if (checks.length) L.push(`\n## Computed checks\n${checks.map((c) => `- ${c}`).join('\n')}`);
  if (str(review.overall)) L.push(`\n## Consultant's overall notes\n${String(review.overall).trim().slice(0, 3000)}`);
  return L.join('\n');
}

export function buildPrompt(client) {
  const charts = chartLibrary(client.answers);
  const consultant = 'The BK Consulting Group';
  return `You are a senior strategy consultant at ${consultant} preparing a KICKOFF deck and a project plan for a new business-strategy engagement. Use only the brief below.

${buildBrief(client)}

RULES
- Every slide title states a conclusion, not a topic ("Bookings are 30% below plan and pipeline cannot close the gap", not "Sales overview"). Max 14 words.
- Visual-first: numbers, charts and short phrases. No slide may read like a paragraph. Respect the word limits.
- Use only facts and numbers from the brief, or simple calculations from them. Where answers are vague, missing or flagged, say so on the slide ("to confirm at kickoff") instead of guessing.
- Speaker notes (notes) carry the detail: 3–6 sentences per slide, including what to ask the client.
- Tone values: "good", "bad", "warn" or "neutral". Severity scores are "1"–"5" as strings.

SLIDES TO WRITE (in this order)
1. layout "summary" — executive summary of what we heard. items: up to 6 {"answer": "≤12 words", "value": "short number", "tone": "...", "label": "≤3 words"}.
2. layout "bignumbers" — current state: 3 items {"icon": one of up|down|cash|people|target|alert|chart|check|calendar|clock|flag|shield, "value": "≤2 words", "label": "≤8 words", "sub": "≤8 words", "tone": "..."}.
3. layout "hero" — current state, the one chart that matters most: "chart" + stats: up to 3 {"value", "label" ≤8 words, "tone"}.
4. layout "ranked" — key problems ranked, most severe first: items up to 5 {"title": "≤10 words", "detail": "≤18 words evidence", "score": "1"–"5", "tone"}.
5. layout "cards" — opportunities: 3–4 cards {"title": "≤8 words", "body": "≤30 words, the evidence", "tone"}.
6. layout "decisions" — proposed focus areas: exactly 3 items {"title": "≤8 words", "body": "≤30 words: what we will do, who, by when", "why": "≤12 words: the data point"}.
7. layout "compare" — today vs. proposed: up to 4 rows {"icon", "from": "≤8 words", "to": "≤8 words", "why": "≤10 words"}.
8. layout "cards" — risks to the engagement and the business: 3–4 cards with tone "bad" or "warn".
9. layout "timeline" — next steps: leave "items" empty so it fills from the plan; give a strong title and a takeaway.
Every slide: {"layout", "section": "≤3 words", "title", "takeaway": "≤20 words", "notes"}.

CHARTS ("chart" on the hero slide) — use one of these ids, computed from the client's answers:
${charts.length ? charts.map((c) => `- "${c.id}": ${c.label}`).join('\n') : '- (none available)'}
or an inline chart: {"type": "bar"|"line", "title": "...", "labels": [...], "values": [numbers], "unit": "$"|"%"|"x"|"mo"|"/5"|"", "source": "..."}.

PROJECT PLAN — about 12 weeks (6–16 if the brief justifies it). Phases such as Discover, Diagnose, Design, Plan & mobilize; workstreams follow the focus areas. 12–25 rows. Owners are real names or roles from the brief, or "BKCG". Mark 3–5 milestones.

OUTPUT FORMAT: one JSON object in a \`\`\`json block, nothing else:
{"deck": {"title": "≤8 words", "subtitle": "≤12 words", "health": "Green"|"Yellow"|"Red", "slides": [ ... ]},
 "plan": {"rows": [{"phase": "", "workstream": "", "task": "≤10 words", "owner": "", "start": 1, "weeks": 2, "deliverable": "≤8 words", "milestone": false}]}}`;
}

// ---------------------------------------------------------------- Starter deck + plan (no AI)
export function starterPlan(client) {
  const a = client.answers || {};
  const ceo = str(a.respondent).split(',')[0] || 'CEO';
  const dm = str(a.decision_maker) || ceo;
  const probs = [1, 2, 3].map((i) => str(a[`problem_${i}`])).filter(Boolean);
  const ws = probs.length ? probs.map((p) => clip(p, 40)) : ['Growth', 'Go-to-market', 'Operations'];
  const R = (phase, workstream, task, owner, start, weeks, deliverable, milestone = false) => ({ phase, workstream, task, owner, start, weeks, deliverable, milestone });
  const rows = [
    R('Discover', 'Engagement', 'Kickoff and goals alignment', `BKCG, ${ceo}`, 1, 1, 'Agreed goals and scope', true),
    R('Discover', 'Engagement', 'Leadership and board interviews', 'BKCG', 1, 2, 'Interview synthesis'),
    R('Discover', 'Data', 'Data request: financials, pipeline, retention', 'Client finance lead', 1, 2, 'Data pack'),
    R('Discover', 'Customers', 'Customer and lost-deal interviews (8–10)', 'BKCG', 2, 2, 'Customer insights'),
    ...ws.map((w, i) => R('Diagnose', w, `Root-cause analysis: ${w}`, 'BKCG', 3 + (i % 2), 3, 'Findings and evidence')),
    R('Diagnose', 'Engagement', 'Diagnostic readout', `BKCG, ${dm}`, 6, 1, 'Diagnostic readout deck', true),
    R('Design', 'Strategy', 'Strategic options and trade-offs', 'BKCG', 7, 2, 'Options memo'),
    R('Design', 'Finance', 'Financial model for top options', 'BKCG, finance lead', 7, 2, 'Scenario model'),
    R('Design', 'Engagement', 'Leadership strategy workshop', `BKCG, ${dm}`, 9, 1, 'Chosen direction', true),
    R('Plan & mobilize', 'Execution', '90-day action plan with owners', 'BKCG, leadership team', 10, 2, '90-day plan'),
    R('Plan & mobilize', 'Execution', 'KPI dashboard and operating cadence', 'BKCG', 10, 2, 'Monthly scorecard'),
    R('Plan & mobilize', 'Engagement', 'Final recommendation and approval', `${dm}`, 12, 1, 'Approved plan', true),
  ];
  return normalizePlan({ rows });
}

export function starterDeck(client) {
  const a = client.answers || {};
  const company = str(a.company_name || client.company) || 'Client';
  const S = (layout, x) => ({ ...normalizeSlide({ layout, ...x }), auto: true });
  const slides = [];
  const tgt = num(a, 'revenue_target'), fc = num(a, 'revenue_forecast');
  const gap = Number.isFinite(tgt) && Number.isFinite(fc) && tgt ? ((fc - tgt) / tgt) * 100 : NaN;
  const cash = num(a, 'cash'), burn = num(a, 'burn');
  const runway = Number.isFinite(cash) && Number.isFinite(burn) && burn > 0 ? cash / burn : num(a, 'runway');
  const grr = num(a, 'grr'), nrr = num(a, 'nrr');

  slides.push(S('summary', { section: 'Executive summary', title: `${company} needs focus more than new ideas`, items: [] }));

  const big = [];
  if (Number.isFinite(fc)) big.push({ icon: gap < -5 ? 'down' : 'up', value: formatNumber(fc, '$'), label: 'Revenue now expected this year', sub: Number.isFinite(gap) ? `${gap >= 0 ? '+' : ''}${gap.toFixed(0)}% vs. ${formatNumber(tgt, '$')} target` : '', tone: gap < -10 ? 'bad' : gap < 0 ? 'warn' : 'good' });
  if (Number.isFinite(runway)) big.push({ icon: 'clock', value: `${runway.toFixed(0)} mo`, label: 'Runway at current burn', sub: Number.isFinite(cash) && Number.isFinite(burn) ? `${formatNumber(cash, '$')} cash · ${formatNumber(burn, '$')}/mo burn` : '', tone: runway < 12 ? 'bad' : runway < 18 ? 'warn' : 'good' });
  if (Number.isFinite(grr)) big.push({ icon: 'people', value: `${grr}%`, label: 'Gross revenue retention', sub: Number.isFinite(nrr) ? `Net retention ${nrr}%` : '', tone: grr < 85 ? 'bad' : grr < 90 ? 'warn' : 'good' });
  const curTitle = [
    Number.isFinite(gap) ? `Revenue is tracking ${Math.abs(gap).toFixed(0)}% ${gap < 0 ? 'below' : 'above'} plan` : '',
    Number.isFinite(runway) ? `with ${runway.toFixed(0)} months of runway` : '',
  ].filter(Boolean).join(' ') || 'Where the business stands today';
  slides.push(S('bignumbers', { section: 'Current state', title: curTitle, items: big.slice(0, 3), takeaway: Number.isFinite(runway) && runway < 18 ? 'The plan has to work inside the current runway.' : '' }));

  const lib = chartLibrary(a);
  const ratingChart = lib.find((c) => c.id === 'ratings');
  if (ratingChart) {
    const pairs = ratingChart.data.labels.map((l, i) => [l, ratingChart.data.values[i]]).sort((x, y) => x[1] - y[1]);
    const lo = pairs[0], hi = pairs[pairs.length - 1];
    slides.push(S('hero', { section: 'Self-assessment', title: `Leadership rates ${lo[0].toLowerCase()} weakest (${lo[1]}/5) and ${hi[0].toLowerCase()} strongest`, chart: 'ratings', stats: [{ value: `${lo[1]}/5`, label: `${lo[0]}: lowest-rated area`, tone: 'bad' }, { value: `${hi[1]}/5`, label: `${hi[0]}: highest-rated area`, tone: 'good' }] }));
  }

  const probs = [1, 2, 3].map((i) => ({ title: clip(a[`problem_${i}`], 80), score: String(num(a, `problem_${i}_sev`) || ''), detail: '' })).filter((p) => p.title);
  probs.sort((x, y) => (Number(y.score) || 0) - (Number(x.score) || 0));
  if (probs.length) slides.push(S('ranked', { section: 'Key problems', title: `${probs.length === 1 ? 'One problem' : `${probs.length} problems`} to solve, led by: ${clip(probs[0].title, 60).replace(/\.$/, '')}`, items: probs, takeaway: 'Confirm the ranking with the leadership team at kickoff.' }));

  const opps = [];
  if (Number.isFinite(num(a, 'rate_pricing')) && num(a, 'rate_pricing') <= 2) opps.push({ title: 'Pricing has never been tested', body: clip(a.pricing || 'Pricing confidence rated low.', 160), tone: 'good' });
  if (Number.isFinite(grr) && Number.isFinite(nrr) && grr >= 88 && nrr - grr < 10) opps.push({ title: 'Customers stay but do not expand', body: `Gross retention ${grr}% vs. net ${nrr}%: room for add-ons and tiering.`, tone: 'good' });
  if (Number.isFinite(num(a, 'win_rate')) && num(a, 'win_rate') >= 25) opps.push({ title: 'The team wins when it gets at bats', body: `Win rate ${num(a, 'win_rate')}% on qualified deals: the constraint is pipeline, not closing.`, tone: 'good' });
  if (str(a.ideal_customer)) opps.push({ title: 'A clear best-fit customer to focus on', body: clip(a.ideal_customer, 160), tone: 'good' });
  slides.push(S('cards', { section: 'Opportunities', title: opps.length ? `${opps.length} opportunities stand out from the answers` : 'Opportunities to test in discovery', cards: opps.length ? opps.slice(0, 4) : [{ title: 'To be developed', body: 'Draft with AI or write the opportunities you see in the answers.', tone: 'neutral' }] }));

  slides.push(S('decisions', { section: 'Focus areas', title: 'We propose three focus areas for the first 90 days', items: (probs.length ? probs : [{ title: 'Focus area' }]).slice(0, 3).map((p) => ({ title: clip(p.title, 60), body: 'Diagnose root causes in weeks 3–6, choose a direction by week 9, and launch a 90-day plan.', why: p.score ? `Rated ${p.score}/5 severity by leadership` : '' })) }));

  const risks = [];
  if (Number.isFinite(runway) && runway < 15) risks.push({ title: `Only ${runway.toFixed(0)} months of runway`, body: 'Recommendations must pay back inside the runway or come with a financing plan.', tone: 'bad' });
  const share = num(a, 'top_customer_share');
  if (Number.isFinite(share) && share >= 20) risks.push({ title: `${share}% of revenue in one customer`, body: 'Losing or repricing this account would change the plan.', tone: 'warn' });
  if (str(a.politics)) risks.push({ title: 'Leadership alignment', body: clip(a.politics, 160), tone: 'warn' });
  if (str(a.timing)) risks.push({ title: 'Timing pressure', body: clip(a.timing, 160), tone: 'warn' });
  slides.push(S('cards', { section: 'Risks', title: risks.length ? `${risks.length} risks could derail the work if not managed early` : 'Risks to manage', cards: risks.length ? risks.slice(0, 4) : [{ title: 'To be developed', body: 'Add the risks you see.', tone: 'warn' }] }));

  slides.push(S('timeline', { section: 'Next steps', title: 'A 12-week path from kickoff to an approved plan', items: [], takeaway: 'Decision at week 9, approved plan by week 12.' }));

  return {
    title: `${company}: kickoff strategy review`, subtitle: 'What we heard and where we propose to focus',
    company, audience: 'Leadership team', presenters: 'The BK Consulting Group', date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    confidential: true, health: '', sourceNote: 'Based on the pre-kickoff questionnaire. Numbers are as reported by the client and not yet verified.',
    fileStem: `${company}-kickoff-deck`,
    slides: [{ id: slideId(), kind: 'title' }, ...slides, { id: slideId(), kind: 'facts' }],
  };
}
