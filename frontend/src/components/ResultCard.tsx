import { useEffect, useState } from "react";
import type { RunRecord } from "../api/client";

const GAUGE_R = 90;
const GAUGE_LEN = Math.PI * GAUGE_R; // ≈ 282.74

function gaugeColor(level: RunRecord["risk_level"]): string {
  if (level === "low") return "#34d399";
  if (level === "medium") return "#fbbf24";
  return "#f87171";
}

type GaugeProps = {
  score: number;
  level: RunRecord["risk_level"];
  size?: "default" | "sm";
};

export function RiskGauge({ score, level, size = "default" }: GaugeProps) {
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    setAnimScore(0);
    const t = setTimeout(() => setAnimScore(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  const dashOffset = GAUGE_LEN * (1 - animScore);
  const color = gaugeColor(level);
  const isSm = size === "sm";

  return (
    <svg
      viewBox="0 0 200 120"
      className={isSm ? "w-full max-w-[160px]" : "w-full max-w-[240px] mx-auto"}
      aria-label={`Risk gauge: ${(score * 100).toFixed(0)}%`}
    >
      {/* Glow filter */}
      <defs>
        <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <path
        d="M 10,110 A 90,90 0 0,1 190,110"
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={isSm ? "10" : "13"}
        strokeLinecap="round"
      />

      {/* Fill */}
      <path
        d="M 10,110 A 90,90 0 0,1 190,110"
        fill="none"
        stroke={color}
        strokeWidth={isSm ? "10" : "13"}
        strokeLinecap="round"
        strokeDasharray={GAUGE_LEN}
        strokeDashoffset={dashOffset}
        filter="url(#gauge-glow)"
        style={{
          transition: "stroke-dashoffset 1.3s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.5s ease",
        }}
      />

      {/* Score */}
      {!isSm && (
        <>
          <text
            x="100"
            y="80"
            textAnchor="middle"
            fill="white"
            fontSize="32"
            fontWeight="700"
            fontFamily="Space Grotesk, sans-serif"
          >
            {score.toFixed(2)}
          </text>
          <text
            x="100"
            y="100"
            textAnchor="middle"
            fill={color}
            fontSize="9.5"
            fontWeight="700"
            letterSpacing="3"
            fontFamily="Manrope, sans-serif"
          >
            {level.toUpperCase()}
          </text>
        </>
      )}

      {isSm && (
        <text
          x="100"
          y="88"
          textAnchor="middle"
          fill="white"
          fontSize="22"
          fontWeight="700"
          fontFamily="Space Grotesk, sans-serif"
        >
          {score.toFixed(2)}
        </text>
      )}
    </svg>
  );
}

type ResultCardProps = {
  run: RunRecord;
};

export function ResultCard({ run }: ResultCardProps) {
  const isFrcm = run.explain.model === "dynamic-frcm-simple";
  const maxContrib = run.explain.top_factors.length
    ? Math.max(...run.explain.top_factors.map((f) => f.contribution))
    : 1;

  return (
    <section className="panel flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Result</p>
        {run.lat != null && run.lon != null && (
          <span className="text-xs text-slate-500">
            {run.lat.toFixed(4)}, {run.lon.toFixed(4)}
          </span>
        )}
        {run.dataset_id && (
          <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
            {run.dataset_id.slice(0, 12)}…
          </span>
        )}
      </div>

      {/* Gauge */}
      <RiskGauge score={run.risk_score} level={run.risk_level} />

      {/* FRCM TTF stats */}
      {isFrcm && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in stagger-1">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Min TTF</p>
            <p className="mt-1.5 text-2xl font-bold text-white">
              {run.explain.min_ttf_hours?.toFixed(1)}
              <span className="ml-1 text-xs font-normal text-slate-400">h</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Mean TTF</p>
            <p className="mt-1.5 text-2xl font-bold text-white">
              {run.explain.mean_ttf_hours?.toFixed(1)}
              <span className="ml-1 text-xs font-normal text-slate-400">h</span>
            </p>
          </div>
        </div>
      )}

      {/* CSV factors */}
      {!isFrcm && run.explain.top_factors.length > 0 && (
        <div className="space-y-3 animate-fade-in stagger-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Top factors</p>
          {run.explain.top_factors.map((factor, i) => (
            <div key={factor.column} className={`animate-fade-up stagger-${Math.min(i + 1, 4)}`}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium capitalize text-slate-200">
                  {factor.column.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-slate-500">w={factor.weight.toFixed(2)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                  style={{
                    width: `${(factor.contribution / maxContrib) * 100}%`,
                    transition: `width 1s cubic-bezier(0.34, 1.2, 0.64, 1) ${i * 0.1}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 mt-auto">
        Run #{run.run_id} · {new Date(run.created_at).toLocaleString()}
      </p>
    </section>
  );
}
