import { useMemo } from 'react';
import { layoutSlide, chartOps, PAGE } from '../lib/slides/layouts.js';

// Renders a slide's layout operations as SVG — the same operations the PDF and PowerPoint use.
export default function SlideSvg({ slide, deck, state, n, total }) {
  const ops = useMemo(() => layoutSlide(slide, deck, state, n, total), [slide, deck, state, n, total]);
  return (
    <svg className="slide-svg" viewBox={`0 0 ${PAGE.w} ${PAGE.h}`} role="img" aria-label={`Slide ${n}: ${slide.title || deck.title}`}>
      {renderOps(ops, 'o')}
    </svg>
  );
}

function renderOps(ops, prefix) {
  return ops.map((o, i) => {
    const key = `${prefix}${i}`;
    if (o.op === 'rect') return <rect key={key} x={o.x} y={o.y} width={o.w} height={o.h} rx={o.radius || 0} fill={o.fill ? `#${o.fill}` : 'none'} stroke={o.line ? `#${o.line}` : 'none'} strokeWidth={o.line ? 0.6 / 72 : 0} />;
    if (o.op === 'line') return <line key={key} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke={`#${o.color}`} strokeWidth={o.width / 72} strokeDasharray={o.dash ? `${4 / 72} ${3 / 72}` : undefined} />;
    if (o.op === 'circle') return <circle key={key} cx={o.cx} cy={o.cy} r={o.r} fill={`#${o.fill}`} />;
    if (o.op === 'chart') return <g key={key}>{renderOps(chartOps(o.data, o), `${key}c`)}</g>;
    if (o.op === 'poly') return <polygon key={key} points={o.points.map((pt) => pt.join(',')).join(' ')} fill={`#${o.fill}`} />;
    if (o.op === 'image') return <image key={key} href={o.src} x={o.x} y={o.y} width={o.w} height={o.h} preserveAspectRatio="xMidYMid meet" />;
    if (o.op === 'text') {
      const lh = (o.size * o.lineHeight) / 72;
      const used = o.lines.length * lh;
      const y0 = o.y + (o.valign === 'middle' ? Math.max(0, (o.h - used) / 2) : 0) + (o.size * 0.82) / 72;
      const x = o.align === 'right' ? o.x + o.w : o.align === 'center' ? o.x + o.w / 2 : o.x;
      return (
        <text key={key} x={x} y={y0} fill={`#${o.color}`} fontSize={o.size / 72}
          fontFamily={o.serif ? 'Georgia, "Times New Roman", serif' : 'Arial, Helvetica, sans-serif'}
          fontWeight={o.bold ? 700 : 400} fontStyle={o.italic ? 'italic' : 'normal'}
          letterSpacing={o.spacing ? (o.spacing * 0.6) / 72 : undefined}
          textAnchor={o.align === 'right' ? 'end' : o.align === 'center' ? 'middle' : 'start'}>
          {o.lines.map((ln, j) => <tspan key={j} x={x} y={y0 + j * lh}>{ln}</tspan>)}
        </text>
      );
    }
    return null;
  });
}
