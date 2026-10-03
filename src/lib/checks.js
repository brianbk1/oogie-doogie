// Automatic checks that suggest flags in the review view. They only suggest; you decide.
import { parseNumber, isAnswered } from './questions.js';

const VAGUE_WORDS = /\b(tbd|tba|not sure|unsure|don'?t know|no idea|n\/a|maybe|it depends|various|etc\.?|depends|unclear|tbc|we'll see)\b|\?\s*$/i;

export function autoChecks(questions, answers) {
  const out = {};
  const add = (id, kind, text) => { (out[id] = out[id] || []).push({ kind, text }); };
  const n = (id) => { const v = parseNumber(answers[id]); return Number.isFinite(v) ? v : NaN; };

  questions.forEach((q) => {
    const v = answers[q.id];
    if (!isAnswered(q, v)) return;
    if (q.type === 'long' || q.type === 'short') {
      const s = String(v).trim();
      if (VAGUE_WORDS.test(s) && s.length < 160) add(q.id, 'vague', 'Hedged or placeholder wording');
      else if (q.type === 'long' && s.split(/\s+/).length < 6) add(q.id, 'vague', 'Very short for an open question');
    }
    if (q.type === 'number' && !Number.isFinite(parseNumber(v))) add(q.id, 'vague', 'Not a number');
    if (q.unit === '%' && Number.isFinite(n(q.id)) && (n(q.id) < 0 || (n(q.id) > 100 && !['nrr', 'growth_rate'].includes(q.id)))) add(q.id, 'contradictory', 'Percentage outside 0–100');
  });

  const cash = n('cash'), burn = n('burn'), runway = n('runway');
  if (Number.isFinite(cash) && Number.isFinite(burn) && burn > 0 && Number.isFinite(runway)) {
    const calc = cash / burn;
    if (Math.abs(calc - runway) > Math.max(2, runway * 0.25)) add('runway', 'contradictory', `Cash ÷ burn = ${calc.toFixed(1)} months, not ${runway}`);
  }
  if (Number.isFinite(n('grr')) && Number.isFinite(n('nrr')) && n('nrr') < n('grr')) add('nrr', 'contradictory', 'Net retention below gross retention is impossible');
  const tgt = n('revenue_target'), fc = n('revenue_forecast'), conf = n('plan_confidence');
  if (Number.isFinite(tgt) && Number.isFinite(fc) && tgt > 0 && Number.isFinite(conf) && conf >= 4 && fc < tgt * 0.9) add('plan_confidence', 'contradictory', `Rated ${conf}/5 confident, but expects ${Math.round((1 - fc / tgt) * 100)}% below target`);
  const ranges = { 'Under $500K': [0, 5e5], '$500K–$2M': [5e5, 2e6], '$2M–$5M': [2e6, 5e6], '$5M–$10M': [5e6, 1e7], '$10M–$25M': [1e7, 2.5e7], '$25M–$50M': [2.5e7, 5e7], '$50M+': [5e7, Infinity] };
  const rr = ranges[answers.revenue_range];
  if (rr && Number.isFinite(fc) && (fc < rr[0] * 0.7 || fc > rr[1] * 1.3)) add('revenue_range', 'contradictory', `Range does not match the $${(fc / 1e6).toFixed(1)}M forecast`);
  const stageMax = { 'Pre-revenue': 1, 'Early (under $1M revenue)': 1.5e6 };
  if (stageMax[answers.stage] && Number.isFinite(fc) && fc > stageMax[answers.stage]) add('stage', 'contradictory', 'Stage does not match the revenue figures');
  if (Number.isFinite(n('burn')) && n('burn') === 0 && Number.isFinite(runway) && runway > 0 && runway < 60) add('burn', 'contradictory', 'Burn is 0 (profitable) but a runway was given');
  // Financial system template
  const cd = n('fs_close_days'), ct = n('fs_close_target');
  if (Number.isFinite(cd) && Number.isFinite(ct) && ct >= cd) add('fs_close_target', 'contradictory', `Target (${ct} days) is not faster than today (${cd} days)`);
  const ent = n('fs_entities'), users = n('fs_users');
  if (Number.isFinite(ent) && ent >= 3 && Number.isFinite(n('fs_pain_consol')) && n('fs_pain_consol') <= 2) add('fs_pain_consol', 'contradictory', `${ent} entities but consolidation rated painless`);
  if (/Under \$150K|\$150K–\$300K/.test(String(answers.budget || '')) && ((Number.isFinite(ent) && ent >= 3) || (Number.isFinite(users) && users >= 75))) add('budget', 'contradictory', 'Budget looks low for the number of entities and users — confirm what it covers');
  if (Number.isFinite(n('fs_entities')) && n('fs_entities') > 1 && answers.fs_coa === 'Clean and consistent across entities' && n('fs_pain_consol') >= 4) add('fs_coa', 'contradictory', 'Chart of accounts called consistent, yet consolidation is very painful');
  return out;
}
