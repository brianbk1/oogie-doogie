import { useMemo, useState } from 'react';
import { planWeeks, phaseOrder, sortedRows, exportPlanXlsx } from '../lib/planExport.js';
import { starterPlan, rowId } from '../lib/deckModel.js';

const PHASE_COLORS = ['#17365D', '#0E8A8C', '#6D9BC7', '#7FA9A8', '#8A6FB0', '#B07A3C'];

export default function PlanBuilder({ client, update, goToDeck }) {
  const plan = client.plan;
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState(null);

  if (!plan || !plan.rows?.length) {
    return (
      <div className="empty-state card">
        <h2>No project plan yet</h2>
        <p>The plan is built together with the deck: use “Build deck + plan” or “Draft with AI” on the Deck tab. Or start from a standard 12-week plan shaped by the client’s top problems.</p>
        <div className="row tight" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => update((c) => ({ ...c, plan: starterPlan(c) }))}>Start a 12-week plan</button>
          <button className="btn" onClick={goToDeck}>Go to Deck</button>
        </div>
      </div>
    );
  }

  const rows = plan.rows;
  const setRows = (fn) => update((c) => ({ ...c, plan: { ...c.plan, rows: fn(c.plan.rows) } }));
  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p, fromAi: false } : r)));
  const aiRows = rows.filter((r) => r.fromAi).length;

  async function exportXlsx() {
    setBusy(true); setMsg(null);
    try {
      await exportPlanXlsx(plan, { company: client.company || client.answers?.company_name || 'Client' });
      setMsg({ kind: 'tip', text: 'Excel downloaded. The Gantt is live: change Start wk or Weeks in Excel and the bars move.' });
    } catch (e) { setMsg({ kind: 'warn', text: `Excel export failed: ${e.message}` }); }
    setBusy(false);
  }

  return (
    <div className="deck">
      <div className="row tight">
        <button className="btn primary" onClick={exportXlsx} disabled={busy}>{busy ? 'Building…' : 'Download Excel'}</button>
        <button className="btn" onClick={() => setRows((rs) => [...rs, { id: rowId(), phase: rs[rs.length - 1]?.phase || 'Discover', workstream: '', task: 'New task', owner: '', start: 1, weeks: 1, deliverable: '', milestone: false, fromAi: false }])}>+ Add row</button>
        {aiRows > 0 && <button className="btn" onClick={() => update((c) => ({ ...c, plan: { ...c.plan, verified: true, rows: c.plan.rows.map((r) => ({ ...r, fromAi: false })) } }))}>Mark all {aiRows} AI rows verified</button>}
        <button className="btn ghost small" onClick={() => { setUndo(plan); update((c) => ({ ...c, plan: starterPlan(c) })); setMsg({ kind: 'tip', text: 'Replaced with the standard 12-week plan.' }); }}>Reset to standard plan</button>
        <span className="muted small">{rows.length} rows · {planWeeks(rows)} weeks · the deck’s timeline slide fills from this plan</span>
      </div>
      {msg && (
        <div className={`callout ${msg.kind} with-action`}>
          <div>{msg.text}</div>
          {undo && <button className="btn small" onClick={() => { update((c) => ({ ...c, plan: undo })); setUndo(null); setMsg({ kind: 'note', text: 'Restored the previous plan.' }); }}>Undo</button>}
        </div>
      )}
      <Gantt rows={rows} />
      <div className="plan-table-wrap">
        <table className="plan-table">
          <thead><tr><th style={{ width: 120 }}>Phase</th><th style={{ width: 120 }}>Workstream</th><th>Task</th><th style={{ width: 150 }}>Owner</th><th>Start wk</th><th>Weeks</th><th style={{ width: 180 }}>Deliverable</th><th>Milestone</th><th /></tr></thead>
          <tbody>
            {sortedRows(rows).map((r) => (
              <tr key={r.id}>
                <td><input aria-label="Phase" value={r.phase} onChange={(e) => patch(r.id, { phase: e.target.value })} /></td>
                <td><input aria-label="Workstream" value={r.workstream} onChange={(e) => patch(r.id, { workstream: e.target.value })} /></td>
                <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{r.fromAi && <span className="badge warn" title="Drafted by AI; edit or mark verified">AI</span>}<input aria-label="Task" value={r.task} onChange={(e) => patch(r.id, { task: e.target.value })} /></td>
                <td><input aria-label="Owner" value={r.owner} onChange={(e) => patch(r.id, { owner: e.target.value })} /></td>
                <td><input aria-label="Start week" type="number" min={1} max={52} value={r.start} onChange={(e) => patch(r.id, { start: Math.max(1, Math.min(52, Number(e.target.value) || 1)) })} /></td>
                <td><input aria-label="Weeks" type="number" min={1} max={52} value={r.weeks} onChange={(e) => patch(r.id, { weeks: Math.max(1, Math.min(52, Number(e.target.value) || 1)) })} /></td>
                <td><input aria-label="Deliverable" value={r.deliverable} onChange={(e) => patch(r.id, { deliverable: e.target.value })} /></td>
                <td style={{ textAlign: 'center' }}><input aria-label="Milestone" type="checkbox" style={{ width: 'auto' }} checked={!!r.milestone} onChange={(e) => patch(r.id, { milestone: e.target.checked })} /></td>
                <td><button className="icon-btn" aria-label="Delete row" onClick={() => { setUndo(plan); setRows((rs) => rs.filter((x) => x.id !== r.id)); setMsg({ kind: 'tip', text: 'Row deleted.' }); }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Gantt({ rows }) {
  const data = useMemo(() => sortedRows(rows), [rows]);
  const W = planWeeks(rows);
  const phases = phaseOrder(rows);
  const labelW = 300, wk = 46, rh = 26, top = 28;
  const width = labelW + W * wk + 10, height = top + data.length * rh + 10;
  return (
    <div className="gantt-wrap">
      <svg className="gantt-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Project timeline">
        {Array.from({ length: W }, (_, i) => (
          <g key={i}>
            <rect x={labelW + i * wk} y={top - 4} width={wk} height={data.length * rh + 4} fill={i % 2 ? 'rgba(127,127,127,0.06)' : 'transparent'} />
            <text x={labelW + i * wk + wk / 2} y={16} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" opacity="0.6">W{i + 1}</text>
          </g>
        ))}
        {data.map((r, i) => {
          const y = top + i * rh;
          const col = PHASE_COLORS[phases.indexOf(r.phase || 'Plan') % PHASE_COLORS.length];
          const x = labelW + (r.start - 1) * wk + 2, w = Math.max(6, r.weeks * wk - 4);
          const newPhase = i === 0 || data[i - 1].phase !== r.phase;
          return (
            <g key={r.id}>
              {newPhase && <line x1={0} x2={width} y1={y - 1} y2={y - 1} stroke="currentColor" opacity="0.15" />}
              <text x={6} y={y + rh * 0.62} fontSize="12" fill="currentColor" fontWeight={newPhase ? 700 : 400} opacity={newPhase ? 1 : 0.55}>{newPhase ? r.phase : ''}</text>
              <text x={110} y={y + rh * 0.62} fontSize="12" fill="currentColor">{(r.task || '').length > 30 ? `${r.task.slice(0, 29)}…` : r.task}</text>
              <rect x={x} y={y + 5} width={w} height={rh - 10} rx="4" fill={col} opacity={r.fromAi ? 0.75 : 1}>
                <title>{`${r.task} · ${r.owner || 'no owner'} · weeks ${r.start}–${r.start + r.weeks - 1}${r.deliverable ? ` · ${r.deliverable}` : ''}`}</title>
              </rect>
              {r.milestone && <polygon points={`${x + w},${y + 4} ${x + w + 8},${y + rh / 2} ${x + w},${y + rh - 4} ${x + w - 8},${y + rh / 2}`} fill="#C4820F" />}
            </g>
          );
        })}
      </svg>
      <div className="row tight small muted" style={{ marginTop: 8 }}>
        {phases.map((p, i) => <span key={p}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PHASE_COLORS[i % PHASE_COLORS.length], marginRight: 5 }} />{p}</span>)}
        <span><span style={{ color: '#C4820F' }}>◆</span> milestone</span>
      </div>
    </div>
  );
}
