// Builds the sample deck (PPTX + PDF) and project plan (XLSX) from the fake client in src/lib/sample.js.
// Run: npm run sample   → files land in ./sample-output
import { mkdirSync, writeFileSync } from 'node:fs';
import { SAMPLE_ANSWERS, SAMPLE_AI_REPLY } from '../src/lib/sample.js';
import { allQuestions } from '../src/lib/master.js';
import { starterDeck, starterPlan, parseAiResult, slideState, buildPrompt, looksLikeOurPrompt } from '../src/lib/deckModel.js';
import { buildPptx, buildPdf } from '../src/lib/slides/backends.js';
import { buildPlanWorkbook } from '../src/lib/planExport.js';

const out = new URL('../sample-output/', import.meta.url);
mkdirSync(out, { recursive: true });
const client = { company: SAMPLE_ANSWERS.company_name, questions: allQuestions([]), answers: SAMPLE_ANSWERS, review: { flags: { runway: 'contradictory' }, notes: { runway: 'Cash ÷ burn gives ~13 months. Confirm with Kim.' } } };

// 1) Starter deck (no AI)
const starter = starterDeck(client);
client.plan = starterPlan(client);

// 2) AI reply → deck + plan (the same path as pasting a reply into the app)
const prompt = buildPrompt(client);
if (!looksLikeOurPrompt(prompt)) throw new Error('paste guard should reject the prompt');
if (looksLikeOurPrompt(SAMPLE_AI_REPLY)) throw new Error('paste guard rejected a real reply');
const ai = parseAiResult(SAMPLE_AI_REPLY);
if (!ai || ai.slides.length < 8 || !ai.plan) throw new Error('could not parse the sample AI reply');
const deck = { ...starter, title: ai.title, subtitle: ai.subtitle, health: ai.health, slides: [starter.slides[0], ...ai.slides, starter.slides[starter.slides.length - 1]] };
const aiClient = { ...client, plan: ai.plan };

for (const [name, d, c] of [['sample-deck', deck, aiClient], ['starter-deck', starter, client]]) {
  const st = slideState(c);
  writeFileSync(new URL(`${name}.pptx`, out), await buildPptx(d, st, 'nodebuffer'));
  writeFileSync(new URL(`${name}.pdf`, out), Buffer.from((await buildPdf(d, st)).output('arraybuffer')));
}
const wb = await buildPlanWorkbook(ai.plan, { company: client.company });
await wb.xlsx.writeFile(new URL('sample-plan.xlsx', out).pathname);
writeFileSync(new URL('sample-prompt.txt', out), prompt);
console.log(`OK: ${deck.slides.length}-slide deck, ${ai.plan.rows.length}-row plan, prompt ${prompt.length} chars → sample-output/`);
