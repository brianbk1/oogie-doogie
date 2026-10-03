import { lsGet, lsSet } from './idb.js';

const KEY = 'bkcg-settings';
export const loadSettings = () => ({ consultant: 'Brian Biddulph-Krentar', email: '', adminKey: '', ...lsGet(KEY, {}) });
export const saveSettings = (s) => lsSet(KEY, s);

// Calls the Vercel function /api/ai. Throws with a readable message when it is not set up.
export async function callAi(task, prompt) {
  const { adminKey } = loadSettings();
  let res;
  try {
    res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(adminKey ? { 'x-admin-key': adminKey } : {}) }, body: JSON.stringify({ task, prompt }) });
  } catch {
    throw new Error('Could not reach the built-in AI. Use “Copy prompt” with any AI tool instead.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) throw new Error('The built-in AI only runs on the deployed Vercel site. Use “Copy prompt” with any AI tool instead.');
  if (!res.ok) throw new Error(data.error || `The built-in AI failed (${res.status}).`);
  if (data.truncated) throw new Error('The AI reply was cut off before it finished. Try again, or use “Copy prompt” with another AI tool.');
  return data.text || '';
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
