// Questionnaire links. Everything a client's questionnaire needs (company, contact, your custom
// questions) is packed into the part of the URL after "#", which browsers never send to a server.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export function newLinkId() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

// cfg: { id, company, contact, consultant, email, due, custom: [questions] }
export function makeLink(cfg, origin = window.location.origin + window.location.pathname) {
  const payload = { v: 1, id: cfg.id, co: cfg.company || '', to: cfg.contact || '', by: cfg.consultant || '', em: cfg.email || '', due: cfg.due || '', x: cfg.custom || [] };
  return `${origin.replace(/\/$/, '')}/#/q/${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function readLink(hash) {
  const m = String(hash || '').match(/#\/q\/([^?&]+)/);
  if (!m) return null;
  try {
    const p = JSON.parse(decompressFromEncodedURIComponent(m[1]) || 'null');
    if (!p || p.v !== 1) return null;
    return { id: String(p.id || 'open'), company: p.co || '', contact: p.to || '', consultant: p.by || '', email: p.em || '', due: p.due || '', custom: Array.isArray(p.x) ? p.x : [] };
  } catch { return null; }
}
