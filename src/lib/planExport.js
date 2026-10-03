// Project plan → Excel (.xlsx) with a live Gantt: the week cells are colored by conditional
// formatting, so editing Start or Weeks in Excel moves the bars.
const NAVY = 'FF17365D', TEAL = 'FF0E8A8C', AMBER = 'FFC4820F', LINE = 'FFDCDBD5', INK3 = 'FF737B88';

export function planWeeks(rows) {
  return Math.max(8, ...rows.map((r) => (Number(r.start) || 1) + (Number(r.weeks) || 1) - 1));
}

export function phaseOrder(rows) {
  const order = [];
  rows.forEach((r) => { const p = r.phase || 'Plan'; if (!order.includes(p)) order.push(p); });
  return order;
}

export function sortedRows(rows) {
  const order = phaseOrder(rows);
  return [...rows].sort((a, b) => order.indexOf(a.phase || 'Plan') - order.indexOf(b.phase || 'Plan') || (a.start - b.start) || 0);
}

export async function buildPlanWorkbook(plan, { company = 'Client', title } = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'The BK Consulting Group';
  wb.created = new Date();
  const rows = sortedRows(plan.rows || []);
  const W = planWeeks(rows);
  const ws = wb.addWorksheet('Project plan', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 1 } });

  const fixed = [
    { key: 'phase', header: 'Phase', width: 16 },
    { key: 'workstream', header: 'Workstream', width: 16 },
    { key: 'task', header: 'Task', width: 44 },
    { key: 'owner', header: 'Owner', width: 22 },
    { key: 'start', header: 'Start wk', width: 9 },
    { key: 'weeks', header: 'Weeks', width: 8 },
    { key: 'end', header: 'End wk', width: 8 },
    { key: 'deliverable', header: 'Deliverable', width: 28 },
    { key: 'milestone', header: 'Milestone', width: 10 },
  ];
  const G0 = fixed.length + 1; // first Gantt column
  ws.columns = [...fixed.map((c) => ({ key: c.key, width: c.width })), ...Array.from({ length: W }, () => ({ width: 4.2 }))];
  const lastCol = fixed.length + W;
  const colL = (n) => ws.getColumn(n).letter;

  ws.mergeCells(1, 1, 1, Math.min(lastCol, 9));
  const t = ws.getCell(1, 1);
  t.value = title || `${company} — engagement plan`;
  t.font = { name: 'Georgia', size: 16, bold: true, color: { argb: NAVY } };
  ws.mergeCells(2, 1, 2, Math.min(lastCol, 9));
  const st = ws.getCell(2, 1);
  st.value = `The BK Consulting Group · ${W}-week plan · exported ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · edit Start wk or Weeks and the bars move`;
  st.font = { size: 10, italic: true, color: { argb: INK3 } };
  ws.getRow(1).height = 24;

  const H = 4;
  const header = ws.getRow(H);
  fixed.forEach((c, i) => { header.getCell(i + 1).value = c.header; });
  for (let w = 1; w <= W; w++) {
    const cell = header.getCell(fixed.length + w);
    cell.value = w;
    cell.numFmt = '"W"0';
    cell.alignment = { horizontal: 'center' };
  }
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true };
  });
  header.height = 22;

  let r = H + 1;
  let lastPhase = null;
  rows.forEach((row) => {
    const x = ws.getRow(r);
    x.getCell(1).value = row.phase || '';
    x.getCell(2).value = row.workstream || '';
    x.getCell(3).value = row.task || '';
    x.getCell(4).value = row.owner || '';
    x.getCell(5).value = Number(row.start) || 1;
    x.getCell(6).value = Number(row.weeks) || 1;
    x.getCell(7).value = { formula: `E${r}+F${r}-1`, result: (Number(row.start) || 1) + (Number(row.weeks) || 1) - 1 };
    x.getCell(8).value = row.deliverable || '';
    x.getCell(9).value = row.milestone ? 'Yes' : 'No';
    [5, 6, 7, 9].forEach((c) => { x.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
    [1, 2, 3, 4, 8].forEach((c) => { x.getCell(c).alignment = { vertical: 'middle', wrapText: true }; });
    if (row.phase !== lastPhase) {
      x.getCell(1).font = { bold: true, color: { argb: NAVY } };
      for (let c = 1; c <= lastCol; c++) x.getCell(c).border = { top: { style: 'thin', color: { argb: 'FF9AA6B2' } } };
    } else x.getCell(1).font = { color: { argb: INK3 } };
    lastPhase = row.phase;
    for (let c = 1; c <= lastCol; c++) {
      const cell = x.getCell(c);
      cell.border = { ...(cell.border || {}), bottom: { style: 'hair', color: { argb: LINE } }, ...(c >= G0 ? { left: { style: 'hair', color: { argb: LINE } } } : {}) };
    }
    if (row.milestone) x.getCell(3).font = { bold: true };
    r++;
  });
  const last = Math.max(H + 1, r - 1);
  ws.autoFilter = { from: { row: H, column: 1 }, to: { row: H, column: fixed.length } };
  ws.dataValidations.add(`I${H + 1}:I${last + 20}`, { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] });

  // Live Gantt: bar where Start ≤ week ≤ End; diamond-colored cell on a milestone's last week.
  const g = `${colL(G0)}${H + 1}:${colL(lastCol)}${last}`;
  const wkRef = `${colL(G0)}$${H}`;
  ws.addConditionalFormatting({ ref: g, rules: [
    { type: 'expression', priority: 1, formulae: [`AND($I${H + 1}="Yes",${wkRef}=$G${H + 1})`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: AMBER } } } },
    { type: 'expression', priority: 2, formulae: [`AND(${wkRef}>=$E${H + 1},${wkRef}<=$G${H + 1})`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: TEAL } } } },
  ] });

  // Static fill too, so viewers that ignore conditional formatting still show bars.
  rows.forEach((row, i) => {
    const s = Number(row.start) || 1, e = s + (Number(row.weeks) || 1) - 1;
    for (let w = s; w <= e && w <= W; w++) {
      const cell = ws.getRow(H + 1 + i).getCell(fixed.length + w);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.milestone && w === e ? AMBER : TEAL } };
    }
  });

  const legendRow = last + 2;
  ws.getCell(legendRow, 3).value = 'Legend: teal = work underway · amber = milestone (last week of the task)';
  ws.getCell(legendRow, 3).font = { size: 9, italic: true, color: { argb: INK3 } };

  // Milestones sheet
  const ms = wb.addWorksheet('Milestones', { views: [{ showGridLines: false }] });
  ms.columns = [{ header: 'Week', key: 'week', width: 8 }, { header: 'Milestone', key: 'task', width: 44 }, { header: 'Deliverable', key: 'deliverable', width: 30 }, { header: 'Owner', key: 'owner', width: 24 }, { header: 'Phase', key: 'phase', width: 16 }];
  rows.filter((x) => x.milestone).sort((a, b) => (a.start + a.weeks) - (b.start + b.weeks)).forEach((x) => ms.addRow({ week: (Number(x.start) || 1) + (Number(x.weeks) || 1) - 1, task: x.task, deliverable: x.deliverable, owner: x.owner, phase: x.phase }));
  ms.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; });
  ms.getColumn(1).numFmt = '"W"0';

  // Owners sheet: who does what, when
  const os = wb.addWorksheet('By owner', { views: [{ showGridLines: false }] });
  os.columns = [{ header: 'Owner', key: 'owner', width: 26 }, { header: 'Task', key: 'task', width: 44 }, { header: 'Start wk', key: 'start', width: 9 }, { header: 'End wk', key: 'end', width: 9 }, { header: 'Deliverable', key: 'deliverable', width: 30 }];
  const byOwner = [];
  rows.forEach((x) => String(x.owner || 'Unassigned').split(/,\s*/).forEach((o) => byOwner.push({ owner: o.trim() || 'Unassigned', task: x.task, start: x.start, end: (Number(x.start) || 1) + (Number(x.weeks) || 1) - 1, deliverable: x.deliverable })));
  byOwner.sort((a, b) => a.owner.localeCompare(b.owner) || a.start - b.start).forEach((x) => os.addRow(x));
  os.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; });
  return wb;
}

export async function exportPlanXlsx(plan, opts) {
  const wb = await buildPlanWorkbook(plan, opts);
  const buf = await wb.xlsx.writeBuffer();
  const { downloadBlob, safeName } = await import('./download.js');
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName(`${opts?.company || 'client'}-project-plan`)}.xlsx`);
}
