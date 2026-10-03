// Offline questionnaire: an Excel workbook the client can fill in instead of answering online, and
// the reader that brings it back exactly (no AI needed) — on the client's side or in your workspace.
import { coerceAnswer } from './mapping.js';
import { isAnswered } from './questions.js';
import { allSections } from './master.js';

const MARK = 'bkcg-questionnaire';
const NAVY = 'FF17365D', TEAL_SOFT = 'FFDDF0EF', ANSWER = 'FFFFFBEA', INK3 = 'FF737B88';

function howTo(q) {
  if (q.type === 'choice') return `Pick one: ${q.options.join(' / ')}`;
  if (q.type === 'multi') return `Pick any, separated by commas: ${q.options.join(', ')}`;
  if (q.type === 'rank') return `Put in order, separated by commas (most important first): ${q.options.join(', ')}`;
  if (q.type === 'rating') return `1 to 5 (1 = ${q.low || 'low'}, 5 = ${q.high || 'high'})`;
  if (q.type === 'number') return `A number${q.unit ? ` (${q.unit})` : ''} — 1.2M, 450k and 18% all work`;
  if (q.type === 'long') return 'A few sentences';
  return 'Short answer';
}

const cellValue = (q, v) => {
  if (!isAnswered(q, v)) return null;
  if (Array.isArray(v)) return v.join(', ');
  return v;
};

export async function buildOfflineWorkbook({ questions, link, answers = {} }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'The BK Consulting Group';
  const ws = wb.addWorksheet('Questionnaire', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ key: 'id', width: 4 }, { key: 'type', width: 4 }, { key: 'section', width: 22 }, { key: 'q', width: 52 }, { key: 'how', width: 40 }, { key: 'a', width: 60 }];
  ws.getColumn(1).hidden = true; ws.getColumn(2).hidden = true;
  ws.mergeCells('C1:F1');
  ws.getCell('C1').value = `${link.company ? `${link.company} — ` : ''}pre-kickoff questionnaire`;
  ws.getCell('C1').font = { name: 'Georgia', size: 16, bold: true, color: { argb: NAVY } };
  ws.mergeCells('C2:F2');
  ws.getCell('C2').value = 'Type your answers in the yellow column. Rough numbers and short answers are fine. When you are done, save this file and upload it on the questionnaire page (or email it back). Attach documents to your email separately.';
  ws.getCell('C2').font = { size: 10, italic: true, color: { argb: INK3 } };
  ws.getCell('C2').alignment = { wrapText: true };
  ws.getRow(2).height = 30;
  const head = ws.getRow(4);
  ['ID', 'Type', 'Section', 'Question', 'How to answer', 'Your answer'].forEach((h, i) => { head.getCell(i + 1).value = h; });
  head.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle' }; });
  head.height = 22;

  let r = 5;
  allSections(questions).forEach((s) => {
    const qs = questions.filter((q) => q.section === s.id && q.type !== 'file');
    if (!qs.length) return;
    const sr = ws.getRow(r++);
    sr.getCell(3).value = s.title;
    for (let c = 3; c <= 6; c++) sr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } };
    sr.getCell(3).font = { bold: true, color: { argb: NAVY } };
    qs.forEach((q) => {
      const row = ws.getRow(r);
      row.getCell(1).value = q.id;
      row.getCell(2).value = q.type;
      row.getCell(4).value = q.label + (q.help ? `\n${q.help}` : '');
      row.getCell(5).value = howTo(q) + (q.example ? `\nExample: ${q.example}` : '');
      row.getCell(6).value = cellValue(q, answers[q.id]);
      row.getCell(4).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(5).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(5).font = { size: 9.5, color: { argb: INK3 } };
      const a = row.getCell(6);
      a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ANSWER } };
      a.alignment = { wrapText: true, vertical: 'top' };
      a.border = { top: { style: 'hair', color: { argb: 'FFDCDBD5' } }, bottom: { style: 'hair', color: { argb: 'FFDCDBD5' } }, left: { style: 'hair', color: { argb: 'FFDCDBD5' } }, right: { style: 'hair', color: { argb: 'FFDCDBD5' } } };
      const list = q.type === 'choice' ? q.options.map((o) => o.replace(/,/g, ' ')).join(',') : q.type === 'rating' ? '1,2,3,4,5' : '';
      if (list && list.length < 250) a.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${list.replace(/"/g, '')}"`], showErrorMessage: q.type === 'rating', errorTitle: 'Pick 1–5', error: 'Use a whole number from 1 to 5.' };
      row.height = q.type === 'long' ? 60 : Math.max(30, Math.ceil(String(q.label).length / 50) * 15);
      r++;
    });
  });

  const meta = wb.addWorksheet('meta', { state: 'veryHidden' });
  meta.getCell('A1').value = MARK;
  meta.getCell('A2').value = link.template || 'strategy';
  meta.getCell('A3').value = link.id || 'open';
  meta.getCell('A4').value = link.company || '';
  return wb;
}

export async function offlineWorkbookBlob(opts) {
  const wb = await buildOfflineWorkbook(opts);
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const cellText = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if (v.text) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
};

// Returns { template, linkId, company, answers, count } for one of our workbooks, or null for any other file.
export async function readOfflineWorkbook(file, questions) {
  if (!/\.xlsx$/i.test(file.name || '')) return null;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return null; }
  const meta = wb.getWorksheet('meta');
  const ws = wb.getWorksheet('Questionnaire');
  if (!meta || !ws || cellText(meta.getCell('A1').value) !== MARK) return null;
  const byId = Object.fromEntries((questions || []).map((q) => [q.id, q]));
  const answers = {};
  ws.eachRow((row, n) => {
    if (n < 5) return;
    const id = cellText(row.getCell(1).value);
    const raw = cellText(row.getCell(6).value);
    if (!id || !raw) return;
    const q = byId[id] || { id, type: cellText(row.getCell(2).value) || 'long' };
    const v = coerceAnswer(q, q.type === 'multi' || q.type === 'rank' ? raw.split(',') : raw);
    if (v !== undefined) answers[id] = v;
  });
  return { template: cellText(meta.getCell('A2').value) || 'strategy', linkId: cellText(meta.getCell('A3').value), company: cellText(meta.getCell('A4').value), answers, count: Object.keys(answers).length };
}

