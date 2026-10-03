// Backends that replay layout operations into a PDF (jsPDF) or a PowerPoint (pptxgenjs).
import { layoutSlide, chartOps, PAGE, P } from './layouts.js';
import { fmtUnit } from '../deckModel.js';

const PT = 72;

function latin1(s) {
  return String(s ?? '')
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/•/g, '-').replace(/→/g, '->').replace(/←/g, '<-').replace(/≈/g, '~').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/−/g, '-').replace(/×/g, 'x').replace(/÷/g, '/').replace(/[^\x00-\xFF]/g, '');
}
const rgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

// ---------------------------------------------------------------- PDF
function pdfOps(doc, ops) {
  ops.forEach((o) => {
    if (o.op === 'rect') {
      if (o.fill) doc.setFillColor(...rgb(o.fill));
      if (o.line) { doc.setDrawColor(...rgb(o.line)); doc.setLineWidth(0.6); }
      const style = o.fill && o.line ? 'FD' : o.fill ? 'F' : 'S';
      if (o.radius) doc.roundedRect(o.x * PT, o.y * PT, o.w * PT, o.h * PT, o.radius * PT, o.radius * PT, style);
      else doc.rect(o.x * PT, o.y * PT, o.w * PT, o.h * PT, style);
    } else if (o.op === 'line') {
      doc.setDrawColor(...rgb(o.color)); doc.setLineWidth(o.width);
      if (o.dash) doc.setLineDashPattern([4, 3], 0);
      doc.line(o.x1 * PT, o.y1 * PT, o.x2 * PT, o.y2 * PT);
      if (o.dash) doc.setLineDashPattern([], 0);
    } else if (o.op === 'circle') {
      doc.setFillColor(...rgb(o.fill)); doc.circle(o.cx * PT, o.cy * PT, o.r * PT, 'F');
    } else if (o.op === 'text') {
      const style = o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal';
      doc.setFont(o.serif ? 'times' : 'helvetica', style);
      doc.setFontSize(o.size);
      doc.setTextColor(...rgb(o.color));
      doc.setCharSpace(o.spacing ? o.spacing * 0.6 : 0);
      const lh = (o.size * o.lineHeight) / PT;
      const used = o.lines.length * lh;
      let y = o.y + (o.valign === 'middle' ? Math.max(0, (o.h - used) / 2) : 0) + (o.size * 0.82) / PT;
      o.lines.forEach((ln) => {
        const x = o.align === 'right' ? o.x + o.w : o.align === 'center' ? o.x + o.w / 2 : o.x;
        doc.text(latin1(ln), x * PT, y * PT, { align: o.align === 'right' ? 'right' : o.align === 'center' ? 'center' : 'left' });
        y += lh;
      });
      doc.setCharSpace(0);
    } else if (o.op === 'chart') {
      pdfOps(doc, chartOps(o.data, o));
    } else if (o.op === 'poly') {
      const pts = o.points;
      const deltas = pts.slice(1).map((pt, i) => [(pt[0] - pts[i][0]) * PT, (pt[1] - pts[i][1]) * PT]);
      doc.setFillColor(...rgb(o.fill));
      doc.lines(deltas, pts[0][0] * PT, pts[0][1] * PT, [1, 1], 'F', true);
    } else if (o.op === 'image') {
      try {
        const fmt = /^data:image\/png/i.test(o.src) ? 'PNG' : 'JPEG';
        doc.addImage(o.src, fmt, o.x * PT, o.y * PT, o.w * PT, o.h * PT);
      } catch { /* unsupported image: skip */ }
    }
  });
}

export async function buildPdf(deck, state) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGE.w * PT, PAGE.h * PT] });
  const total = deck.slides.length;
  deck.slides.forEach((s, i) => {
    if (i > 0) doc.addPage([PAGE.w * PT, PAGE.h * PT], 'landscape');
    pdfOps(doc, layoutSlide(s, deck, state, i + 1, total));
  });
  doc.setProperties({ title: deck.title, subject: deck.subtitle || '', creator: 'The BK Consulting Group' });
  return doc;
}

// ---------------------------------------------------------------- PPTX
function pptxOps(pres, slide, ops) {
  ops.forEach((o) => {
    if (o.op === 'rect') {
      const opts = { x: o.x, y: o.y, w: o.w, h: o.h, fill: o.fill ? { color: o.fill } : { type: 'none' }, line: o.line ? { color: o.line, width: 0.75 } : { type: 'none' } };
      if (o.radius) slide.addShape(pres.ShapeType.roundRect, { ...opts, rectRadius: o.radius });
      else slide.addShape(pres.ShapeType.rect, opts);
    } else if (o.op === 'line') {
      const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2);
      slide.addShape(pres.ShapeType.line, {
        x, y, w: Math.max(0.001, Math.abs(o.x2 - o.x1)), h: Math.max(0.001, Math.abs(o.y2 - o.y1)),
        flipV: (o.x2 - o.x1) * (o.y2 - o.y1) < 0,
        line: { color: o.color, width: o.width, dashType: o.dash ? 'dash' : 'solid' },
      });
    } else if (o.op === 'circle') {
      slide.addShape(pres.ShapeType.ellipse, { x: o.cx - o.r, y: o.cy - o.r, w: o.r * 2, h: o.r * 2, fill: { color: o.fill }, line: { type: 'none' } });
    } else if (o.op === 'text') {
      slide.addText(o.text, {
        x: o.x, y: o.y, w: o.w, h: Math.max(o.h, (o.lines.length * o.size * o.lineHeight) / PT),
        fontSize: o.size, bold: o.bold, italic: o.italic, color: o.color,
        fontFace: o.serif ? 'Georgia' : 'Calibri', align: o.align, valign: o.valign === 'middle' ? 'middle' : 'top',
        margin: 0, lineSpacingMultiple: o.lineHeight * 0.92, charSpacing: o.spacing || undefined, paraSpaceAfter: 0,
      });
    } else if (o.op === 'chart') {
      nativeChart(pres, slide, o.data, o);
    } else if (o.op === 'poly') {
      const xs = o.points.map((p) => p[0]), ys = o.points.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(0.01, Math.max(...xs) - x), h = Math.max(0.01, Math.max(...ys) - y);
      slide.addShape(pres.ShapeType.custGeom, {
        x, y, w, h, fill: { color: o.fill }, line: { type: 'none' },
        points: [...o.points.map(([px, py]) => ({ x: px - x, y: py - y })), { close: true }],
      });
    } else if (o.op === 'image') {
      slide.addImage({ data: o.src, x: o.x, y: o.y, w: o.w, h: o.h });
    }
  });
}

function nativeChart(pres, slide, data, box) {
  slide.addShape(pres.ShapeType.rect, { x: box.x, y: box.y, w: box.w, h: box.h, fill: { color: P.card }, line: { color: P.line, width: 0.75 } });
  const numFmt = data.unit === '$' ? '$#,##0' : data.unit === '%' ? '0.0"%"' : data.unit === 'x' ? '0.0"x"' : '#,##0';
  const opts = {
    x: box.x + 0.15, y: box.y + 0.1, w: box.w - 0.3, h: box.h - 0.5,
    chartColors: [P.green], showTitle: true, title: data.title, titleFontSize: 12, titleColor: P.ink, titleFontFace: 'Calibri',
    catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, catAxisLabelColor: P.ink2, valAxisLabelColor: P.ink2,
    valAxisLabelFormatCode: numFmt, dataLabelFormatCode: numFmt,
    valGridLine: { color: 'E3E8E5', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false,
  };
  const values = data.values.map((v) => (Number.isFinite(v) ? v : 0));
  if (data.unit === '/5') Object.assign(opts, { valAxisMinVal: 0, valAxisMaxVal: 5, valAxisMajorUnit: 1, valAxisLabelFormatCode: '0', dataLabelFormatCode: '0"/5"' });
  if (data.type === 'bar') {
    const horiz = data.labels.length > 5;
    Object.assign(opts, { barDir: horiz ? 'bar' : 'col', showValue: data.labels.length <= 10, dataLabelFontSize: 9, dataLabelColor: P.ink, barGapWidthPct: 60 });
    if (horiz) opts.catAxisOrientation = 'maxMin';
    slide.addChart(pres.ChartType.bar, [{ name: data.title, labels: data.labels, values }], opts);
  } else {
    const series = [{ name: data.title, labels: data.labels, values }];
    if (data.reference) series.push({ name: data.reference.label, labels: data.labels, values: data.labels.map(() => data.reference.value) });
    Object.assign(opts, { chartColors: [P.green, P.amber], lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 6, showLegend: !!data.reference, legendPos: 'b', legendFontSize: 9 });
    slide.addChart(pres.ChartType.line, series, opts);
  }
  const cap = [data.reference ? `${data.reference.label}: ${fmtUnit(data.reference.value, data.unit)}` : '', data.note, `Source: ${data.source}`].filter(Boolean).join('   ·   ');
  slide.addText(cap, { x: box.x + 0.25, y: box.y + box.h - 0.36, w: box.w - 0.5, h: 0.24, fontSize: 8, italic: true, color: P.ink3, fontFace: 'Calibri', margin: 0 });
}

export async function buildPptx(deck, state, outputType = 'blob') {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'BKCG_WIDE', width: PAGE.w, height: PAGE.h });
  pres.layout = 'BKCG_WIDE';
  pres.title = deck.title;
  pres.company = deck.company || "";
  pres.author = "The BK Consulting Group";
  const total = deck.slides.length;
  deck.slides.forEach((s, i) => {
    const slide = pres.addSlide();
    pptxOps(pres, slide, layoutSlide(s, deck, state, i + 1, total));
    if (s.notes) slide.addNotes(s.notes);
  });
  return pres.write({ outputType });
}

// ---------------------------------------------------------------- Download helpers
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const safeName = (t) => (t || 'presentation').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'presentation';

export async function exportPptx(deck, state) {
  downloadBlob(await buildPptx(deck, state, 'blob'), `${safeName(deck.fileStem || deck.title)}.pptx`);
}
export async function exportPdf(deck, state) {
  const doc = await buildPdf(deck, state);
  downloadBlob(doc.output('blob'), `${safeName(deck.fileStem || deck.title)}.pdf`);
}
