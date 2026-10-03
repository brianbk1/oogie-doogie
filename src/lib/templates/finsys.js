// Questionnaire template: implementing a new financial system (ERP / general ledger) at a
// mid-sized company, framed as a strategy engagement — the system has to serve where the business
// is going, not just replace what finance uses today.
//
// Shared question ids (company_name, respondent, problem_1…, tried, decision_maker…) match the
// business-strategy template so the deck, flags and summaries work the same way.

const R = { low: 'Weak', high: 'Strong' };
const PAIN = { low: 'Smooth', high: 'Very painful' };

export const FINSYS_SECTIONS = [
  { id: 'company', title: 'Company snapshot', intro: 'The basics, so the first meeting starts from the same picture.' },
  { id: 'fs_why', title: 'Why a new system, and why now', intro: 'The business reasons behind the project. This is where the system choice connects to strategy.' },
  { id: 'fs_strategy', title: 'Where the business is going', intro: 'A finance system is a 7–10 year decision. It needs to fit the company you are becoming, not just the one you are today.' },
  { id: 'fs_systems', title: 'Today’s systems', intro: 'What you run now and how it all connects. Rough counts are fine.' },
  { id: 'fs_process', title: 'Finance processes', intro: 'How the core finance work gets done today, and where it hurts.' },
  { id: 'fs_reporting', title: 'Reporting and data', intro: 'What leaders can and cannot see today, and the state of the data we would move.' },
  { id: 'fs_entities', title: 'Entities, controls and compliance', intro: 'Structure and requirements that shape how the system must be set up.' },
  { id: 'fs_selection', title: 'Selection status', intro: 'Where you are in choosing software and a partner.' },
  { id: 'fs_people', title: 'Team, users and change', intro: 'Who will do the work, who will use the system, and how much change the organization can absorb.' },
  { id: 'fs_budget', title: 'Budget, timing and constraints', intro: 'The boundaries the plan has to fit inside.' },
  { id: 'people', title: 'Sponsors and stakeholders', intro: 'Who decides, who influences, and who needs to be in the room.' },
  { id: 'problems', title: 'Top 3 problems', intro: 'If the new system could only fix three things, which would they be?' },
  { id: 'past', title: 'What has been tried', intro: 'Earlier projects, workarounds and lessons learned.' },
  { id: 'files', title: 'Documents (optional)', intro: 'Anything you already have saves you typing. Files stay on your computer until you send your response file.' },
];

export const FINSYS_QUESTIONS = [
  // ---- Company snapshot
  { id: 'company_name', section: 'company', type: 'short', label: 'Company name', required: true },
  { id: 'respondent', section: 'company', type: 'short', label: 'Your name and role', example: 'Maria Chen, CFO' },
  { id: 'one_liner', section: 'company', type: 'short', label: 'What the company does, in one sentence', example: 'We distribute industrial MRO supplies to manufacturers in the Mid-Atlantic from four warehouses.' },
  { id: 'fs_industry', section: 'company', type: 'choice', label: 'Industry', options: ['Distribution / wholesale', 'Manufacturing', 'Professional services', 'Software / SaaS', 'Healthcare', 'Retail / e-commerce', 'Construction / real estate', 'Nonprofit / education', 'Other'] },
  { id: 'fs_revenue', section: 'company', type: 'choice', label: 'Annual revenue', options: ['Under $25M', '$25M–$50M', '$50M–$100M', '$100M–$250M', '$250M–$500M', '$500M+'] },
  { id: 'team_size', section: 'company', type: 'number', unit: 'people', label: 'Total employees' },
  { id: 'fs_ownership', section: 'company', type: 'choice', label: 'Ownership', options: ['Founder / family owned', 'Private equity backed', 'Venture backed', 'Public', 'Employee owned', 'Nonprofit'] },
  { id: 'fs_locations', section: 'company', type: 'number', unit: '', label: 'Number of operating locations (offices, plants, warehouses)' },

  // ---- Why now
  { id: 'fs_triggers', section: 'fs_why', type: 'multi', label: 'What is driving this project? (pick all that apply)', options: ['Outgrown the current system', 'Current system losing vendor support', 'Acquisition or new entities', 'Audit findings / weak controls', 'Preparing for a sale, PE exit or IPO', 'Leadership lacks timely reporting', 'Too much manual work / spreadsheets', 'New CFO or finance leadership', 'Growth into new markets or currencies'] },
  { id: 'why_now', section: 'fs_why', type: 'long', label: 'In your own words, why now?', example: 'We closed two acquisitions this year and now consolidate four companies in Excel. Close takes 15 days and our lender wants monthly covenants within 20. QuickBooks support for our version ends in 2027.' },
  { id: 'success_90', section: 'fs_why', type: 'long', label: 'What does success look like 90 days into this engagement?', help: 'Think about decisions made, not software installed.', example: 'A signed-off design for chart of accounts and entity structure, a vendor and partner selected, and a go-live date the board has approved.' },
  { id: 'fs_success_golive', section: 'fs_why', type: 'long', label: 'And one year after go-live — what will be different?', example: 'Close in 6 days, consolidated reporting without Excel, controllers spending time on analysis instead of tie-outs, and room to add two more acquisitions without adding finance headcount.' },
  { id: 'fs_priority_rank', section: 'fs_why', type: 'rank', label: 'Rank what the new system must improve most (most important first)', options: ['Faster month-end close', 'Better management reporting', 'Budgeting and forecasting', 'Automation of AP / AR', 'Multi-entity consolidation', 'Controls and audit readiness', 'Scale for growth and M&A', 'Lower total cost of systems'] },

  // ---- Strategy fit
  { id: 'current_strategy', section: 'fs_strategy', type: 'long', label: 'What is the business strategy for the next 3 years?', example: 'Double revenue to $300M, mostly through acquiring regional distributors, while adding a private-label product line and an e-commerce channel.' },
  { id: 'fs_growth_moves', section: 'fs_strategy', type: 'multi', label: 'Which of these are likely in the next 3 years?', options: ['Acquisitions', 'New legal entities', 'International expansion / new currencies', 'New business lines or revenue models', 'Subscription or recurring revenue', 'E-commerce channel', 'Divestiture', 'Sale of the company / recapitalization'] },
  { id: 'fs_cant_do', section: 'fs_strategy', type: 'long', label: 'What can the business not do today because of its systems?', help: 'Decisions you cannot make, deals you cannot price, things you cannot report.', example: 'We cannot see margin by customer or product line after freight and rebates, so sales discounts blindly. We could not give the bank a consolidated cash forecast without two weeks of work.' },
  { id: 'fs_strategy_clarity', section: 'fs_strategy', type: 'rating', label: 'How clear and agreed is that strategy across the leadership team?', low: 'Still debated', high: 'Clear and agreed' },
  { id: 'fs_operating_model', section: 'fs_strategy', type: 'choice', label: 'After acquisitions, how will acquired companies run?', options: ['Fully integrated into one way of working', 'Shared back office, local operations', 'Largely independent, reporting up', 'Not decided yet', 'Not applicable'] },

  // ---- Systems
  { id: 'fs_current_gl', section: 'fs_systems', type: 'short', label: 'Current accounting / ERP system (and version)', example: 'QuickBooks Enterprise 2021 at HQ; Sage 100 at the two acquired companies' },
  { id: 'fs_gl_years', section: 'fs_systems', type: 'number', unit: '', label: 'How many years has it been in place?' },
  { id: 'fs_other_systems', section: 'fs_systems', type: 'multi', label: 'Other systems finance depends on', options: ['CRM', 'Payroll / HRIS', 'Billing / invoicing', 'Inventory / warehouse', 'Procurement / purchasing', 'Expense management', 'Banking / treasury', 'BI / reporting tool', 'E-commerce platform', 'Budgeting / FP&A tool'] },
  { id: 'fs_integrations', section: 'fs_systems', type: 'number', unit: '', label: 'Roughly how many integrations or regular file imports feed the general ledger?' },
  { id: 'fs_spreadsheets', section: 'fs_systems', type: 'number', unit: '', label: 'How many spreadsheets are critical to closing the books or reporting?', help: 'The ones that would hurt if the person who owns them left.' },
  { id: 'fs_system_satisfaction', section: 'fs_systems', type: 'rating', label: 'Overall, how well does today’s system serve finance?', ...R },
  { id: 'fs_contract_end', section: 'fs_systems', type: 'short', label: 'Any license renewals or end-of-support dates coming up?', example: 'Sage 100 support ends June 2027; QuickBooks renewal every January.' },
  { id: 'fs_it_support', section: 'fs_systems', type: 'choice', label: 'Who supports your systems today?', options: ['Internal IT team', 'Outsourced IT / MSP', 'Finance supports its own systems', 'Mix', 'No one in particular'] },

  // ---- Processes
  { id: 'fs_close_days', section: 'fs_process', type: 'number', unit: 'days', label: 'Business days to close the month' },
  { id: 'fs_close_target', section: 'fs_process', type: 'number', unit: 'days', label: 'Close target you would like to hit' },
  { id: 'fs_manual_jes', section: 'fs_process', type: 'number', unit: '', label: 'Manual journal entries per month (estimate)' },
  { id: 'fs_ap_volume', section: 'fs_process', type: 'number', unit: '', label: 'Vendor invoices processed per month' },
  { id: 'fs_ar_volume', section: 'fs_process', type: 'number', unit: '', label: 'Customer invoices issued per month' },
  { id: 'fs_pain_close', section: 'fs_process', type: 'rating', label: 'How painful is month-end close?', ...PAIN },
  { id: 'fs_pain_ap', section: 'fs_process', type: 'rating', label: 'How painful is accounts payable?', ...PAIN },
  { id: 'fs_pain_ar', section: 'fs_process', type: 'rating', label: 'How painful is billing and collections?', ...PAIN },
  { id: 'fs_pain_consol', section: 'fs_process', type: 'rating', label: 'How painful is consolidation and intercompany?', ...PAIN },
  { id: 'fs_pain_fpa', section: 'fs_process', type: 'rating', label: 'How painful is budgeting and forecasting?', ...PAIN },
  { id: 'fs_manual_worst', section: 'fs_process', type: 'long', label: 'Describe the single most manual, error-prone process', example: 'Intercompany: three controllers email balances, I reconcile in Excel, and we book top-side entries. It takes four days and we find errors most months.' },

  // ---- Reporting and data
  { id: 'fs_report_gaps', section: 'fs_reporting', type: 'long', label: 'Which reports or numbers do leaders need but cannot get today?', example: 'Gross margin by customer and product line, weekly cash, and budget vs. actual by location before the 20th.' },
  { id: 'metrics_tracked', section: 'fs_reporting', type: 'long', label: 'Which metrics does the leadership team review every month?' },
  { id: 'fs_data_quality', section: 'fs_reporting', type: 'rating', label: 'How much do people trust the numbers that come out of finance?', low: 'Constant debate', high: 'Fully trusted' },
  { id: 'fs_coa', section: 'fs_reporting', type: 'choice', label: 'State of the chart of accounts', options: ['Clean and consistent across entities', 'Workable but cluttered', 'Different in each entity', 'Needs a full redesign', 'Not sure'] },
  { id: 'fs_history', section: 'fs_reporting', type: 'choice', label: 'How much history needs to move to the new system?', options: ['Opening balances only', '1 year of detail', '2–3 years of detail', 'More than 3 years', 'Not decided'] },
  { id: 'fs_revrec', section: 'fs_reporting', type: 'choice', label: 'How complex is revenue recognition?', options: ['Simple: invoice = revenue', 'Some deferrals / milestones', 'Subscriptions or multi-element contracts', 'Project / percent-of-completion', 'Not sure'] },

  // ---- Entities and compliance
  { id: 'fs_entities', section: 'fs_entities', type: 'number', unit: '', label: 'Number of legal entities' },
  { id: 'fs_currencies', section: 'fs_entities', type: 'number', unit: '', label: 'Number of currencies you transact in' },
  { id: 'fs_audit', section: 'fs_entities', type: 'choice', label: 'Financial statements are…', options: ['Audited annually', 'Reviewed', 'Compiled', 'Internal only'] },
  { id: 'fs_audit_findings', section: 'fs_entities', type: 'long', label: 'Recent audit findings, control gaps or adjustments', help: 'Management letter comments, material weaknesses, late adjustments. This stays between us.' },
  { id: 'fs_compliance', section: 'fs_entities', type: 'multi', label: 'Requirements the system must support', options: ['US GAAP', 'IFRS', 'SOX or SOX-like controls', 'Multi-state sales tax', 'Lender covenant reporting', 'Grant / fund accounting', 'Industry-specific regulation', 'Data privacy (GDPR etc.)'] },

  // ---- Selection status
  { id: 'fs_selection_stage', section: 'fs_selection', type: 'choice', label: 'Where are you in choosing a system?', options: ['Just exploring', 'Writing requirements', 'Talking to vendors', 'Shortlist of 2–3', 'Vendor selected, not signed', 'Contract signed', 'Implementation under way'] },
  { id: 'fs_vendors', section: 'fs_selection', type: 'short', label: 'Systems you are considering or have seen demos of', example: 'NetSuite, Microsoft Dynamics 365 Business Central, Sage Intacct' },
  { id: 'fs_partner', section: 'fs_selection', type: 'choice', label: 'Implementation partner', options: ['Not started looking', 'Talking to partners', 'Partner selected', 'Vendor will implement directly', 'Planning to self-implement'] },
  { id: 'fs_criteria_rank', section: 'fs_selection', type: 'rank', label: 'Rank your selection criteria (most important first)', options: ['Fit with our processes', 'Total cost over 5 years', 'Ease of use', 'Speed to implement', 'Reporting and analytics', 'Integration with our other systems', 'Scales with acquisitions', 'Vendor and partner strength'] },
  { id: 'fs_requirements', section: 'fs_selection', type: 'choice', label: 'Do you have written requirements?', options: ['No', 'A rough list', 'A detailed requirements document', 'A formal RFP'] },

  // ---- People and change
  { id: 'fs_finance_team', section: 'fs_people', type: 'number', unit: 'people', label: 'Finance and accounting team size' },
  { id: 'fs_users', section: 'fs_people', type: 'number', unit: 'people', label: 'People who will use the new system (incl. approvers outside finance)' },
  { id: 'fs_project_lead', section: 'fs_people', type: 'choice', label: 'How much time can your internal project lead give?', options: ['Under 25%', '25–50%', '50–75%', 'Full time', 'No lead named yet'] },
  { id: 'fs_change_capacity', section: 'fs_people', type: 'rating', label: 'How much change can the organization absorb this year?', low: 'Already stretched', high: 'Ready for it' },
  { id: 'fs_past_implementations', section: 'fs_people', type: 'long', label: 'Has the team been through a system implementation before? How did it go?', example: 'Our controller led the Sage rollout at her last company. Our CRM rollout in 2024 ran six months late because sales never had time for testing.' },
  { id: 'fs_key_person_risk', section: 'fs_people', type: 'long', label: 'Who holds critical knowledge that only lives in their head?' },

  // ---- Budget and timing
  { id: 'budget', section: 'fs_budget', type: 'choice', label: 'Budget set aside for software plus implementation (first year)', options: ['Under $150K', '$150K–$300K', '$300K–$600K', '$600K–$1M', '$1M+', 'Not decided'] },
  { id: 'fs_golive', section: 'fs_budget', type: 'short', label: 'Target go-live date, and why that date', example: 'January 1, 2028 — start of our fiscal year, so we do not migrate mid-year.' },
  { id: 'timing', section: 'fs_budget', type: 'long', label: 'Blackout periods and hard deadlines', help: 'Year-end, audit fieldwork, peak season, acquisition closings, board meetings.', example: 'No go-live in Q4 (peak season). Audit fieldwork in March. Lender requires covenant reporting by the 20th.' },
  { id: 'non_negotiables', section: 'fs_budget', type: 'long', label: 'Anything that is off the table?', example: 'We will not replace the warehouse system this year. No layoffs in finance as a result of this project.' },

  // ---- People
  { id: 'decision_maker', section: 'people', type: 'short', label: 'Who makes the final decision on the system and budget?' },
  { id: 'fs_sponsor', section: 'people', type: 'short', label: 'Executive sponsor (if different)' },
  { id: 'stakeholders', section: 'people', type: 'long', label: 'Other stakeholders and their stake', example: 'COO: owns warehouses and inventory, worried about disruption. IT director: owns integrations, prefers Microsoft. PE operating partner: wants faster reporting.' },
  { id: 'politics', section: 'people', type: 'long', label: 'Sensitivities we should know about', help: 'Disagreements, people who feel threatened, history. This stays between us.' },
  { id: 'kickoff_attendees', section: 'people', type: 'short', label: 'Who must be at the kickoff?' },

  // ---- Problems
  { id: 'problem_1', section: 'problems', type: 'short', label: 'Problem #1', example: 'Close takes 15 days and consolidation is done in Excel' },
  { id: 'problem_1_sev', section: 'problems', type: 'rating', label: 'How much does problem #1 hurt?', low: 'Annoying', high: 'Critical' },
  { id: 'problem_2', section: 'problems', type: 'short', label: 'Problem #2' },
  { id: 'problem_2_sev', section: 'problems', type: 'rating', label: 'How much does problem #2 hurt?', low: 'Annoying', high: 'Critical' },
  { id: 'problem_3', section: 'problems', type: 'short', label: 'Problem #3' },
  { id: 'problem_3_sev', section: 'problems', type: 'rating', label: 'How much does problem #3 hurt?', low: 'Annoying', high: 'Critical' },

  // ---- Past
  { id: 'tried', section: 'past', type: 'long', label: 'What have you already tried (workarounds, add-ons, earlier selection efforts)?', example: 'Bought a consolidation add-on in 2025; it needed clean data we did not have, so we stopped. Ran a NetSuite selection in 2024 that stalled when the CFO left.' },
  { id: 'why_failed', section: 'past', type: 'long', label: 'What got in the way?' },
  { id: 'fs_biggest_fear', section: 'past', type: 'long', label: 'What worries you most about this project?', example: 'That we go live and cannot invoice for two weeks, or that we rebuild our old processes in an expensive new system.' },

  // ---- Files
  { id: 'file_answers', section: 'files', type: 'file', label: 'Your answers in another format (optional)', help: 'Filled in our questions in Word, Excel or a PDF instead? Attach it here — no need to retype anything.' },
  { id: 'file_coa', section: 'files', type: 'file', label: 'Chart of accounts (each entity)' },
  { id: 'file_financials', section: 'files', type: 'file', label: 'Recent financial statements and management reports' },
  { id: 'file_systems', section: 'files', type: 'file', label: 'Systems diagram, requirements or RFP' },
  { id: 'file_other', section: 'files', type: 'file', label: 'Vendor proposals, close checklist, org chart, anything else' },
];
