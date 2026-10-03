// Questionnaire templates. Each client link uses one template; questions you add (by hand or from
// uploaded questionnaires) are added to the master of that template.
import { SECTIONS, BUILT_IN_QUESTIONS } from './questions.js';
import { FINSYS_SECTIONS, FINSYS_QUESTIONS } from './templates/finsys.js';

export const DEFAULT_TEMPLATE = 'strategy';

export const TEMPLATES = {
  strategy: {
    id: 'strategy', label: 'Business strategy',
    description: 'Growth, go-to-market, product, team and finances — the general strategy kickoff.',
    engagement: 'business-strategy engagement',
    sections: SECTIONS, questions: BUILT_IN_QUESTIONS,
  },
  finsys: {
    id: 'finsys', label: 'Financial system implementation',
    description: 'Mid-sized company selecting and implementing a new ERP / financial system, tied to where the business is going.',
    engagement: 'financial system (ERP) selection and implementation engagement, led as a business-strategy project',
    sections: FINSYS_SECTIONS, questions: FINSYS_QUESTIONS,
  },
};

export const templateOf = (id) => TEMPLATES[id] || TEMPLATES[DEFAULT_TEMPLATE];

// Every section definition across templates, by id (first definition wins).
export const SECTION_REGISTRY = (() => {
  const m = new Map();
  Object.values(TEMPLATES).forEach((t) => t.sections.forEach((s) => { if (!m.has(s.id)) m.set(s.id, s); }));
  return m;
})();
