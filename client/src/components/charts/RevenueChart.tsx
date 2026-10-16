import { useMemo, useState } from "react";
import { formatNaira, formatNairaCompact } from "../../lib/money";

interface Point {
  label: string;
  revenue: number;
  transactions: number;
}

/**
 * Single-series revenue bars. One hue (brand), thin bars with 4px rounded
 * tops anchored to the baseline, recessive gridlines, hover tooltip per bar,
 * and a visually hidden table for screen readers.
 */
export function RevenueChart({ data, formatLabel }: { data: Point[]; formatLabel: (label: string) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const { max, ticks } = useMemo(() => {
    const raw = Math.max(1, ...data.map((d) => d.revenue));
    const step = niceStep(raw / 4);
    const top = Math.ceil(raw / step) * step;
    return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
  }, [data]);

  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  const labelEvery = Math.ceil(data.length / 8);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue trend">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-border-subtle)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-fg-4)" className="tabular">
              {formatNairaCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + slot * i + (slot - barW) / 2;
          const h = Math.max(d.revenue > 0 ? 2 : 0, pad.top + innerH - y(d.revenue));
          const r = Math.min(4, barW / 2, h);
          const top = pad.top + innerH - h;
          return (
            <g key={d.label}>
              {h > 0 && (
                <path
                  d={`M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z`}
                  fill={hover === null || hover === i ? "var(--color-brand-500)" : "var(--color-brand-200)"}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-fg-4)">
                  {formatLabel(d.label)}
                </text>
              )}
              {/* Hit target taller and wider than the mark. */}
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={-1}
              />
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="var(--color-border)" strokeWidth={1} />
      </svg>

      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border-subtle bg-canvas px-3 py-2 text-sm shadow-md"
          style={{ left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%` }}
        >
          <p className="font-medium text-fg-3">{formatLabel(active.label)}</p>
          <p className="tabular text-md font-semibold text-fg">{formatNaira(active.revenue)}</p>
          <p className="text-fg-3">
            {active.transactions} sale{active.transactions === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Revenue by period</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Revenue</th>
            <th>Sales</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{formatLabel(d.label)}</td>
              <td>{formatNaira(d.revenue)}</td>
              <td>{d.transactions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
