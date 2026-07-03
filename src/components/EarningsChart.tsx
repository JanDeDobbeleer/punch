import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react';

import type { ChartData } from '../lib/earnings';
import { fmtShortDate, parseISO } from '../lib/dates';
import { fmtEUR } from '../lib/format';

const PAD_X = 4;
const PAD_TOP = 10;
const CHART_H = 110;
const LABEL_H = 20;
const TOTAL_H = PAD_TOP + CHART_H + LABEL_H;

interface Props {
  data: ChartData;
}

const EarningsChart: FC<Props> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setSvgWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { xPoints, xLabels, series, granularity } = data;
  const n = xPoints.length;

  if (n === 0 || series.length === 0) return null;

  const usableW = svgWidth - PAD_X * 2;
  const xPos = (i: number): number =>
    PAD_X + (n <= 1 ? usableW / 2 : (i * usableW) / (n - 1));

  const maxEarn = series.reduce((max, s) => Math.max(max, ...s.values), 0);
  const yPos = (earn: number): number =>
    PAD_TOP + CHART_H - (maxEarn > 0 ? (earn / maxEarn) * CHART_H : 0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xPos(i) - relX);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    setHoveredIdx(best);
  };

  const hx = hoveredIdx !== null ? xPos(hoveredIdx) : 0;
  const tooltipOnRight = hx < svgWidth * 0.55;

  const shouldShowLabel = (i: number): boolean => {
    if (granularity === 'month') return true;
    const day = Number(xLabels[i]);
    return day === 1 || day === 8 || day === 15 || day === 22 || day === 29;
  };

  const tooltipDateLabel = hoveredIdx !== null
    ? (granularity === 'day'
        ? fmtShortDate(parseISO(xPoints[hoveredIdx]))
        : xLabels[hoveredIdx])
    : '';

  const tooltipPos: CSSProperties = tooltipOnRight
    ? { left: hx + 12 }
    : { right: svgWidth - hx + 12 };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={svgWidth}
        height={TOTAL_H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
      >
        {/* Horizontal grid lines */}
        {([0.25, 0.5, 0.75] as const).map(pct => (
          <line
            key={pct}
            x1={PAD_X} y1={PAD_TOP + CHART_H * (1 - pct)}
            x2={svgWidth - PAD_X} y2={PAD_TOP + CHART_H * (1 - pct)}
            stroke="#f0f1f4" strokeWidth="1"
          />
        ))}

        {/* Baseline */}
        <line
          x1={PAD_X} y1={PAD_TOP + CHART_H}
          x2={svgWidth - PAD_X} y2={PAD_TOP + CHART_H}
          stroke="#e9ebef" strokeWidth="1"
        />

        {/* Hover vertical indicator */}
        {hoveredIdx !== null && (
          <line
            x1={hx} y1={PAD_TOP}
            x2={hx} y2={PAD_TOP + CHART_H}
            stroke="#d7dadf" strokeWidth="1" strokeDasharray="3 2"
          />
        )}

        {/* Area fills — subtle, drawn before lines so lines sit on top */}
        {n > 1 && series.map(s => {
          const pts = s.values.map((earn, i) => `${xPos(i)},${yPos(earn)}`).join(' L ');
          return (
            <path
              key={s.id}
              d={`M ${xPos(0)},${PAD_TOP + CHART_H} L ${pts} L ${xPos(n - 1)},${PAD_TOP + CHART_H} Z`}
              fill={s.color}
              fillOpacity={0.07}
            />
          );
        })}

        {/* Lines per series */}
        {n > 1 && series.map(s => (
          <polyline
            key={s.id}
            points={s.values.map((earn, i) => `${xPos(i)},${yPos(earn)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={hoveredIdx !== null ? 0.65 : 1}
          />
        ))}

        {/* Dots: always when n===1, on hover otherwise */}
        {(n === 1 || hoveredIdx !== null) && series.map(s => {
          const idx = hoveredIdx ?? 0;
          return (
            <circle
              key={s.id}
              cx={xPos(idx)}
              cy={yPos(s.values[idx])}
              r={n === 1 ? 5 : 4}
              fill={s.color}
              stroke="#fff"
              strokeWidth="2"
            />
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((label, i) =>
          shouldShowLabel(i) && (
            <text
              key={i}
              x={xPos(i)}
              y={PAD_TOP + CHART_H + 14}
              textAnchor="middle"
              fontSize="10"
              fill={hoveredIdx === i ? '#626873' : '#9ca3af'}
            >
              {label}
            </text>
          ),
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredIdx !== null && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            ...tooltipPos,
            background: '#1a1c20',
            color: '#fff',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: '128px',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '5px', color: '#d1d5db', fontSize: '11px' }}>
            {tooltipDateLabel}
          </div>
          {series.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
              <span style={{ color: '#9ca3af', flex: 1 }}>{s.name}</span>
              <span style={{
                fontFamily: "'Geist Mono',monospace",
                paddingLeft: '8px',
                color: s.values[hoveredIdx] > 0 ? '#fff' : '#6b7280',
              }}>
                {fmtEUR(s.values[hoveredIdx])}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Legend — only shown when there are multiple series */}
      {series.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '10px' }}>
          {series.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#626873' }}>
              <div style={{ width: '18px', height: '2.5px', borderRadius: '2px', background: s.color }} />
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EarningsChart;
