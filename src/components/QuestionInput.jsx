import { useEffect, useState } from 'react';
import { formatNumber, parseNumber } from '../lib/questions.js';

// One input for any question type. value/onChange use the stored answer format.
export default function QuestionInput({ q, value, onChange, onAddFiles, onRemoveFile }) {
  const id = `q-${q.id}`;
  switch (q.type) {
    case 'long':
      return <textarea id={id} rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'choice':
      return (
        <div className="choice-grid" role="radiogroup" aria-label={q.label}>
          {q.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} className={`choice ${value === o ? 'on' : ''}`} onClick={() => onChange(value === o ? '' : o)}>{o}</button>
          ))}
        </div>
      );
    case 'multi': {
      const set = Array.isArray(value) ? value : [];
      return (
        <div className="choice-grid" role="group" aria-label={q.label}>
          {q.options.map((o) => {
            const on = set.includes(o);
            return <button key={o} type="button" aria-pressed={on} className={`choice ${on ? 'on' : ''}`} onClick={() => onChange(on ? set.filter((x) => x !== o) : [...set, o])}>{o}</button>;
          })}
        </div>
      );
    }
    case 'rating':
      return (
        <div className="rating" role="radiogroup" aria-label={q.label}>
          <span className="rating-end l">{q.low || 'Low'}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={Number(value) === n} className={Number(value) === n ? 'on' : ''} onClick={() => onChange(Number(value) === n ? '' : n)}>{n}</button>
          ))}
          <span className="rating-end r">{q.high || 'High'}</span>
        </div>
      );
    case 'number':
      return <NumberInput id={id} q={q} value={value} onChange={onChange} />;
    case 'rank':
      return <RankInput q={q} value={value} onChange={onChange} />;
    case 'file':
      return (
        <div className="file-list">
          {(Array.isArray(value) ? value : []).map((f) => (
            <div key={f.key || f.name} className="file-row">
              <span>{f.name}</span><span className="muted small">{fmtSize(f.size)}</span>
              {onRemoveFile && <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => onRemoveFile(f)}>✕</button>}
            </div>
          ))}
          {onAddFiles && (
            <label className="btn small" style={{ alignSelf: 'flex-start' }}>
              Add file{(value || []).length ? 's' : ''}…
              <input type="file" multiple hidden onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) onAddFiles(fs); }} />
            </label>
          )}
        </div>
      );
    default:
      return <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function NumberInput({ id, q, value, onChange }) {
  const [text, setText] = useState(value === '' || value === undefined || value === null ? '' : String(value));
  useEffect(() => {
    const n = parseNumber(text);
    if (!(Number.isFinite(n) && n === Number(value)) && !(text === '' && (value === '' || value == null))) {
      setText(value === '' || value === undefined || value === null ? '' : String(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = parseNumber(text);
  const bad = text.trim() !== '' && !Number.isFinite(n);
  return (
    <div>
      <div className="num-wrap">
        {q.unit === '$' && <span className="unit">$</span>}
        <input id={id} inputMode="decimal" value={text} placeholder={q.unit === '$' ? 'e.g. 1.2M or 450k' : ''}
          onChange={(e) => { setText(e.target.value); const v = parseNumber(e.target.value); onChange(e.target.value.trim() === '' ? '' : Number.isFinite(v) ? v : e.target.value); }} />
        {q.unit && q.unit !== '$' && <span className="unit">{q.unit}</span>}
      </div>
      {bad ? <div className="field-hint" style={{ color: 'var(--warn)' }}>Enter a number — “1.2M”, “450k” and “18%” all work.</div>
        : Number.isFinite(n) && q.unit === '$' && Math.abs(n) >= 1e4 ? <div className="num-preview">{formatNumber(n, '$')}</div> : null}
    </div>
  );
}

function RankInput({ q, value, onChange }) {
  const opts = q.options || [];
  const list = Array.isArray(value) && value.length ? [...value, ...opts.filter((o) => !value.includes(o))] : opts;
  const touched = Array.isArray(value) && value.length > 0;
  const move = (i, d) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <ol className="rank-list">
        {list.map((o, i) => (
          <li key={o} className="rank-item">
            <span className="rank-num">{i + 1}</span><span>{o}</span>
            <button type="button" className="icon-btn" aria-label={`Move ${o} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="icon-btn" aria-label={`Move ${o} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
          </li>
        ))}
      </ol>
      <div className="row tight" style={{ marginTop: 8 }}>
        {!touched && <button type="button" className="btn small" onClick={() => onChange([...list])}>This order is right</button>}
        {touched && <span className="muted small">Ranked. <button type="button" className="link small" onClick={() => onChange([])}>Reset</button></span>}
      </div>
    </div>
  );
}

export function fmtSize(b) {
  if (!Number.isFinite(b)) return '';
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}
