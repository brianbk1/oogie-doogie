export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeName = (t, fallback = 'file') => (t || fallback).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || fallback;
