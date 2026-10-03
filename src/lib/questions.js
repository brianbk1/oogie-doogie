// The master pre-kickoff questionnaire. Built-in questions live here; questions added from
// uploaded questionnaires are stored as "custom" questions (see master.js) and merged in.
//
// Question types:
//   short   one-line text            long    paragraph text
//   choice  pick one (options)       multi   pick any (options)
//   rating  1–5 (low/high labels)    number  number with a unit ($, %, months, days, people)
//   rank    order a list (options)   file    upload a document (kept in the response file)

export const SECTIONS = [
  { id: 'company', title: 'Company snapshot', intro: 'The basics, so the first meeting starts from the same picture.' },
  { id: 'goals', title: 'Goals for this engagement', intro: 'What you want out of this work, and what a good first 90 days looks like.' },
  { id: 'strategy', title: 'Current strategy and recent results', intro: 'Where you were trying to go, and what actually happened.' },
  { id: 'customers', title: 'Customers and market', intro: 'Who buys, why they buy, and who else they consider.' },
  { id: 'gtm', title: 'Go-to-market', intro: 'How you find, win and price customers today.' },
  { id: 'product', title: 'Product', intro: 'What you sell and where it falls short.' },
  { id: 'team', title: 'Team and organization', intro: 'Who leads what, and where the gaps are.' },
  { id: 'finance', title: 'Financial position', intro: 'Rough numbers are fine. Ranges beat blanks.' },
  { id: 'problems', title: 'Top 3 problems', intro: 'If we could only fix three things, which would they be?' },
  { id: 'past', title: 'What has been tried', intro: 'Past attempts save us from repeating them.' },
  { id: 'constraints', title: 'Constraints', intro: 'Budget, timing and politics we need to design around.' },
  { id: 'people', title: 'Decision makers and stakeholders', intro: 'Who decides, who influences, and who needs to be in the room.' },
  { id: 'files', title: 'Documents (optional)', intro: 'Anything you already have saves you typing. Files stay on your computer until you send your response file.' },
];

const RATING = { low: 'Weak', high: 'Strong' };

export const BUILT_IN_QUESTIONS = [
  // ---- Company snapshot
  { id: 'company_name', section: 'company', type: 'short', label: 'Company name', required: true },
  { id: 'respondent', section: 'company', type: 'short', label: 'Your name and role', example: 'Dana Ruiz, CEO and co-founder' },
  { id: 'one_liner', section: 'company', type: 'short', label: 'What the company does, in one sentence', example: 'We sell scheduling software to multi-location dental groups, priced per location.' },
  { id: 'stage', section: 'company', type: 'choice', label: 'Stage', options: ['Pre-revenue', 'Early (under $1M revenue)', 'Growth ($1M–$10M)', 'Scale ($10M–$50M)', 'Mature ($50M+)'] },
  { id: 'revenue_range', section: 'company', type: 'choice', label: 'Annual revenue (last 12 months)', options: ['Under $500K', '$500K–$2M', '$2M–$5M', '$5M–$10M', '$10M–$25M', '$25M–$50M', '$50M+'] },
  { id: 'team_size', section: 'company', type: 'number', unit: 'people', label: 'Team size (full-time equivalents)' },
  { id: 'business_model', section: 'company', type: 'multi', label: 'Business model (pick all that apply)', options: ['SaaS subscription', 'Usage-based', 'Services / consulting', 'Marketplace', 'Hardware', 'Licensing', 'Transactional / e-commerce'] },

  // ---- Goals
  { id: 'why_now', section: 'goals', type: 'long', label: 'Why are you bringing in outside help now?', example: 'Growth stalled at ~$6M for three quarters. The board wants a plan by the March meeting, and we disagree internally about whether the issue is product or sales.' },
  { id: 'success_90', section: 'goals', type: 'long', label: 'What does success look like 90 days from now?', help: 'Be concrete: a decision made, a number moved, a plan approved.', example: 'Board approves a focused 2027 plan; we have picked one segment to lead with; pipeline coverage is back above 3x.' },
  { id: 'goal_rank', section: 'goals', type: 'rank', label: 'Rank these priorities for the next 12 months (most important first)', options: ['Grow revenue', 'Improve profitability', 'Raise capital', 'Fix go-to-market', 'Improve product-market fit', 'Build the team / org', 'Prepare for an exit'] },
  { id: 'plan_confidence', section: 'goals', type: 'rating', label: 'How confident are you in hitting this year’s plan?', low: 'Not at all', high: 'Very' },

  // ---- Strategy and results
  { id: 'current_strategy', section: 'strategy', type: 'long', label: 'Describe your current strategy in two or three sentences', example: 'Win mid-size dental groups (5–40 locations) through a direct inside-sales team, then expand into billing add-ons.' },
  { id: 'revenue_target', section: 'strategy', type: 'number', unit: '$', label: 'This year’s revenue target' },
  { id: 'revenue_forecast', section: 'strategy', type: 'number', unit: '$', label: 'Where you now expect to land this year' },
  { id: 'growth_rate', section: 'strategy', type: 'number', unit: '%', label: 'Revenue growth over the last 12 months (%)' },
  { id: 'results_detail', section: 'strategy', type: 'long', label: 'What went better and worse than planned over the last year?', example: 'Better: retention (GRR 92%). Worse: new bookings missed by 30%, mostly because two enterprise deals slipped and outbound produced little.' },

  // ---- Customers and market
  { id: 'ideal_customer', section: 'customers', type: 'long', label: 'Who is your best customer?', help: 'Size, industry, buyer title, the trigger that makes them buy.', example: 'Dental groups with 10–30 locations, bought by the COO after a failed front-desk staffing quarter.' },
  { id: 'customer_count', section: 'customers', type: 'number', unit: 'customers', label: 'Number of paying customers' },
  { id: 'top_customer_share', section: 'customers', type: 'number', unit: '%', label: 'Share of revenue from your largest customer (%)' },
  { id: 'grr', section: 'customers', type: 'number', unit: '%', label: 'Gross revenue retention, last 12 months (%)', help: 'Revenue kept from customers you had a year ago, before upsell. Estimate if you need to.' },
  { id: 'nrr', section: 'customers', type: 'number', unit: '%', label: 'Net revenue retention, last 12 months (%)' },
  { id: 'competitors', section: 'customers', type: 'short', label: 'Main competitors or alternatives', example: 'Weave, Dentrix built-in scheduling, spreadsheets' },
  { id: 'win_loss', section: 'customers', type: 'long', label: 'Why do you win, and why do you lose?' },
  { id: 'market_position', section: 'customers', type: 'rating', label: 'How strong is your position in your market?', ...RATING },

  // ---- Go-to-market
  { id: 'channels', section: 'gtm', type: 'multi', label: 'Where do new customers come from?', options: ['Inbound / content', 'Paid ads', 'Outbound sales', 'Partners / resellers', 'Referrals', 'Events', 'Product-led / free trial'] },
  { id: 'sales_motion', section: 'gtm', type: 'choice', label: 'Main sales motion', options: ['Self-serve', 'Inside sales', 'Field sales', 'Partner-led', 'Founder-led'] },
  { id: 'acv', section: 'gtm', type: 'number', unit: '$', label: 'Average first-year contract value' },
  { id: 'sales_cycle', section: 'gtm', type: 'number', unit: 'days', label: 'Typical sales cycle (days)' },
  { id: 'win_rate', section: 'gtm', type: 'number', unit: '%', label: 'Win rate on qualified opportunities (%)' },
  { id: 'cac', section: 'gtm', type: 'number', unit: '$', label: 'Customer acquisition cost (fully loaded)' },
  { id: 'pricing', section: 'gtm', type: 'long', label: 'How do you price, and when did it last change?', example: '$350 per location per month, annual contracts. Unchanged since 2023; discounts average 18%.' },
  { id: 'rate_sales', section: 'gtm', type: 'rating', label: 'Rate your sales effectiveness', ...RATING },
  { id: 'rate_marketing', section: 'gtm', type: 'rating', label: 'Rate your marketing effectiveness', ...RATING },
  { id: 'rate_pricing', section: 'gtm', type: 'rating', label: 'How confident are you in your pricing?', low: 'Guessing', high: 'Tested' },

  // ---- Product
  { id: 'product_summary', section: 'product', type: 'long', label: 'What do you sell today, and what is on the roadmap?' },
  { id: 'rate_pmf', section: 'product', type: 'rating', label: 'How strong is product-market fit?', ...RATING },
  { id: 'product_gap', section: 'product', type: 'long', label: 'The biggest gap customers complain about', example: 'No two-way texting; prospects ask for it in about half of demos.' },

  // ---- Team
  { id: 'leadership', section: 'team', type: 'long', label: 'Leadership team (names, roles, time in seat)', example: 'Dana Ruiz CEO (6 yrs); Sam Patel CTO (6 yrs); VP Sales open since June; Kim Lee Finance (contract, 2 days/wk).' },
  { id: 'open_roles', section: 'team', type: 'short', label: 'Critical open roles' },
  { id: 'rate_org', section: 'team', type: 'rating', label: 'How healthy is the leadership team’s alignment?', low: 'Pulling apart', high: 'Aligned' },

  // ---- Finance
  { id: 'cash', section: 'finance', type: 'number', unit: '$', label: 'Cash on hand today' },
  { id: 'burn', section: 'finance', type: 'number', unit: '$', label: 'Average monthly net burn (enter 0 if profitable)' },
  { id: 'runway', section: 'finance', type: 'number', unit: 'months', label: 'Runway (months)' },
  { id: 'gross_margin', section: 'finance', type: 'number', unit: '%', label: 'Gross margin (%)' },
  { id: 'funding', section: 'finance', type: 'long', label: 'Funding history and plans', example: 'Seed $3M (2021), Series A $9M (2023). Considering a bridge in Q2 if bookings do not recover.' },
  { id: 'metrics_tracked', section: 'finance', type: 'long', label: 'Which metrics does the leadership team review every month?' },

  // ---- Problems
  { id: 'problem_1', section: 'problems', type: 'short', label: 'Problem #1', example: 'New bookings are 30% below plan and pipeline is thin.' },
  { id: 'problem_1_sev', section: 'problems', type: 'rating', label: 'How much does problem #1 hurt?', low: 'Annoying', high: 'Existential' },
  { id: 'problem_2', section: 'problems', type: 'short', label: 'Problem #2' },
  { id: 'problem_2_sev', section: 'problems', type: 'rating', label: 'How much does problem #2 hurt?', low: 'Annoying', high: 'Existential' },
  { id: 'problem_3', section: 'problems', type: 'short', label: 'Problem #3' },
  { id: 'problem_3_sev', section: 'problems', type: 'rating', label: 'How much does problem #3 hurt?', low: 'Annoying', high: 'Existential' },

  // ---- Past attempts
  { id: 'tried', section: 'past', type: 'long', label: 'What have you already tried that did not work?', example: 'Hired an outbound agency for 6 months ($90K): 4 meetings, no deals. Launched a starter tier in 2024; it cannibalized mid-tier deals.' },
  { id: 'why_failed', section: 'past', type: 'long', label: 'Why do you think those attempts fell short?' },

  // ---- Constraints
  { id: 'budget', section: 'constraints', type: 'choice', label: 'Budget available for initiatives coming out of this work (next 6 months)', options: ['Under $50K', '$50K–$150K', '$150K–$500K', '$500K+', 'Not decided'] },
  { id: 'timing', section: 'constraints', type: 'long', label: 'Timing constraints (board meetings, fundraising, seasonality, deadlines)' },
  { id: 'politics', section: 'constraints', type: 'long', label: 'Sensitivities we should know about', help: 'Disagreements, people who feel threatened by this work, topics to handle carefully. This stays between us.' },
  { id: 'non_negotiables', section: 'constraints', type: 'long', label: 'Anything that is off the table?' },

  // ---- People
  { id: 'decision_maker', section: 'people', type: 'short', label: 'Who makes the final call on recommendations?' },
  { id: 'stakeholders', section: 'people', type: 'long', label: 'Other stakeholders and their stake', example: 'Sam (CTO): owns roadmap, skeptical of a pricing change. Board chair Ellen Wu: pushing for profitability by 2027.' },
  { id: 'kickoff_attendees', section: 'people', type: 'short', label: 'Who must be at the kickoff?' },
  { id: 'board_involvement', section: 'people', type: 'choice', label: 'How involved is your board in this work?', options: ['Not involved', 'Informed', 'Will review the plan', 'Sponsoring it'] },

  // ---- Files
  { id: 'file_pitch', section: 'files', type: 'file', label: 'Pitch or company overview deck' },
  { id: 'file_financials', section: 'files', type: 'file', label: 'Financials (P&L, budget, model)' },
  { id: 'file_board', section: 'files', type: 'file', label: 'Latest board deck' },
  { id: 'file_other', section: 'files', type: 'file', label: 'Anything else useful' },
];

export const TYPE_LABELS = {
  short: 'Short text', long: 'Long text', choice: 'Multiple choice (one)', multi: 'Multiple choice (any)',
  rating: '1–5 rating', number: 'Number', rank: 'Rank these', file: 'File upload',
};

export const UNITS = ['', '$', '%', 'months', 'days', 'people', 'customers'];

export function isAnswered(q, v) {
  if (v === undefined || v === null) return false;
  if (q.type === 'file') return Array.isArray(v) && v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (q.type === 'number' || q.type === 'rating') return v !== '' && Number.isFinite(Number(v));
  return String(v).trim() !== '';
}

// Human-readable value for briefs, review and the readable copy in the response file.
export function formatAnswer(q, v) {
  if (!isAnswered(q, v)) return '';
  if (q.type === 'file') return v.map((f) => f.name).join(', ');
  if (q.type === 'rank') return v.map((x, i) => `${i + 1}. ${x}`).join('  ');
  if (q.type === 'multi') return v.join(', ');
  if (q.type === 'rating') return `${v} / 5`;
  if (q.type === 'number') return formatNumber(Number(v), q.unit);
  return String(v);
}

export function formatNumber(n, unit) {
  if (!Number.isFinite(n)) return '';
  if (unit === '$') {
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e6) return `${s}$${+(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
    if (a >= 1e4) return `${s}$${+(a / 1e3).toFixed(0)}K`;
    return `${s}$${a.toLocaleString('en-US')}`;
  }
  if (unit === '%') return `${+n.toFixed(1)}%`;
  if (unit) return `${n.toLocaleString('en-US')} ${unit}`;
  return n.toLocaleString('en-US');
}

// "1.2M", "$450k", "18%", "1,250" → number (NaN if it is not a number).
export function parseNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/[$,%\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const m = s.match(/^(-?\d*\.?\d+)([kmb])?$/i);
  if (!m) return NaN;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Number(m[1]) * mult;
}
