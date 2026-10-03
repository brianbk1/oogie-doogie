// Vercel serverless function: optional "Draft with AI" for the kickoff app.
// Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables to turn it on.
// Optional: ADMIN_KEY — if set, the app must send the same key (you enter it once in Settings),
// so nobody else can spend your API credits through your public site.
// Optional: ANTHROPIC_MODEL to override the model.
// Without a key, use "Copy prompt" with ChatGPT, Claude or Copilot and paste the reply back instead.

const SYSTEMS = {
  deck: `You are a senior strategy consultant at The BK Consulting Group. You turn a client's pre-kickoff questionnaire into a kickoff deck and a project plan.
Rules: use only facts from the brief or simple calculations from them; every slide title states a conclusion; visual-first, short phrases, respect word limits; flag vague, missing or contradictory answers on the slide instead of guessing; put detail in speaker notes.
Output only the JSON object in the exact format requested, inside a \`\`\`json block. No preamble.`,
  map: `You map a client's completed questionnaire (any format) onto a known list of questions.
Rules: never invent answers; keep the client's wording for text answers; convert numbers and scales as instructed; anything answered that is not on the list becomes a new question.
Output only the JSON object in the exact format requested, inside a \`\`\`json block. No preamble.`,
};
const MAX_TOKENS = { deck: 12000, map: 8000 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'Built-in AI is not set up on this site (no ANTHROPIC_API_KEY). Use “Copy prompt” with any AI tool and paste the reply back instead.' });
  const admin = process.env.ADMIN_KEY;
  if (admin && req.headers['x-admin-key'] !== admin) return res.status(401).json({ error: 'Admin key missing or wrong. Enter it under Settings in the app.' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const task = body.task === 'map' ? 'map' : 'deck';
  const prompt = String(body.prompt || '').slice(0, 150000);
  if (!prompt) return res.status(400).json({ error: 'Nothing to send.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: MAX_TOKENS[task],
        system: SYSTEMS[task],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'The AI could not respond.' });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return res.status(200).json({ text, truncated: data.stop_reason === 'max_tokens' });
  } catch {
    return res.status(502).json({ error: 'The AI could not be reached.' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
