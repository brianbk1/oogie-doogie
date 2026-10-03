// Admin-side storage: every client record lives in this browser's IndexedDB.
// Back up with "Download backup"; the client's own response file is also a backup of their answers.
import { idbGet, idbSet, idbDel, idbKeys } from './idb.js';
import { loadCustom, saveCustom } from './master.js';

const INDEX = 'clients:index';

export const newClientId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function listClients() {
  return (await idbGet(INDEX).catch(() => null)) || [];
}
export async function getClient(id) {
  return idbGet(`client:${id}`);
}
export async function saveClient(client) {
  const c = { ...client, updatedAt: new Date().toISOString() };
  await idbSet(`client:${c.id}`, c);
  const idx = (await listClients()).filter((x) => x.id !== c.id);
  idx.unshift({ id: c.id, company: c.company || c.answers?.company_name || 'Untitled client', status: c.status || 'draft', updatedAt: c.updatedAt, linkId: c.linkId || '' });
  await idbSet(INDEX, idx);
  return c;
}
export async function deleteClient(id) {
  await idbDel(`client:${id}`);
  const keys = await idbKeys();
  await Promise.all(keys.filter((k) => String(k).startsWith(`blob:${id}:`)).map((k) => idbDel(k)));
  await idbSet(INDEX, (await listClients()).filter((x) => x.id !== id));
}
export const blobKey = (clientId, path) => `blob:${clientId}:${path}`;
export const saveBlob = (clientId, path, blob) => idbSet(blobKey(clientId, path), blob);
export const getBlob = (clientId, path) => idbGet(blobKey(clientId, path));

export async function backupZip() {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const idx = await listClients();
  const clients = [];
  for (const row of idx) {
    const c = await getClient(row.id);
    if (!c) continue;
    clients.push(c);
    for (const list of Object.values(c.files || {})) for (const f of list) {
      const b = await getBlob(c.id, f.path).catch(() => null);
      if (b) zip.file(`blobs/${c.id}/${f.path}`, b);
    }
  }
  zip.file('backup.json', JSON.stringify({ format: 'bkcg-kickoff-backup', version: 1, savedAt: new Date().toISOString(), custom: loadCustom(), clients }, null, 1));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function restoreZip(file) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file('backup.json');
  if (!entry) throw new Error('That is not a backup file from this app.');
  const data = JSON.parse(await entry.async('string'));
  if (data.format !== 'bkcg-kickoff-backup') throw new Error('That is not a backup file from this app.');
  const existing = loadCustom();
  const ids = new Set(existing.map((q) => q.id));
  saveCustom([...existing, ...(data.custom || []).filter((q) => !ids.has(q.id))]);
  for (const c of data.clients || []) {
    await saveClient(c);
    for (const list of Object.values(c.files || {})) for (const f of list) {
      const z = zip.file(`blobs/${c.id}/${f.path}`);
      if (z) await saveBlob(c.id, f.path, new Blob([await z.async('arraybuffer')], { type: f.type || '' }));
    }
  }
  return (data.clients || []).length;
}
