import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { RiskGauge } from "../components/ResultCard";
import { getRun, type RunRecord } from "../api/client";

function RiskBadge({ level }: { level: RunRecord["risk_level"] }) {
  const cls =
    level === "low" ? "badge-low" : level === "medium" ? "badge-medium" : "badge-high";
  return <span className={cls}>{level}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
    </div>
  );
}

export function RunDetailsPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runId) { setError("Run ID missing."); setLoading(false); return; }
    async function load() {
      setLoading(true);
      setError("");
      try {
        setRun(await getRun(runId!));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load run.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [runId]);

  const isFrcm = run?.explain.model === "dynamic-frcm-simple";
  const maxContrib = run?.explain.top_factors.length
    ? Math.max(...run.explain.top_factors.map((f) => f.contribution))
    : 1;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400/70">Run Details</p>
          <h1 className="mt-0.5 text-2xl font-bold text-white">#{runId}</h1>
        </div>
        <Link
          className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          to="/history"
        >
          ← Back
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
          {error}
        </p>
      )}

      {run && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Left: gauge + core info */}
          <div className="panel space-y-5 animate-fade-in">
            <RiskGauge score={run.risk_score} level={run.risk_level} />

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <Stat label="Risk level" value={run.risk_level.toUpperCase()} />
              <Stat label="Score" value={run.risk_score.toFixed(4)} />
              <Stat
                label="Created"
                value={new Date(run.created_at).toLocaleString()}
              />
              {isFrcm && run.lat != null && run.lon != null && (
                <Stat
                  label="Location"
                  value={`${run.lat.toFixed(4)}, ${run.lon.toFixed(4)}`}
                />
              )}
              {!isFrcm && run.dataset_id && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Dataset ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-300">{run.dataset_id}</p>
                </div>
              )}
            </div>

            <RiskBadge level={run.risk_level} />
          </div>

          {/* Right: model details */}
          <div className="panel space-y-4 animate-fade-in stagger-1">
            {isFrcm ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  FRCM forecast
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Min TTF</p>
                    <p className="mt-2 text-3xl font-bold text-white">
                      {run.explain.min_ttf_hours?.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-500">hours</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Mean TTF</p>
                    <p className="mt-2 text-3xl font-bold text-white">
                      {run.explain.mean_ttf_hours?.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-500">hours</p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-2">
                  <Stat label="Model" value="dynamic-frcm-simple" />
                  <Stat label="Source" value="MET Norway Locationforecast 2.0" />
                  <Stat
                    label="Data points"
                    value={`${run.explain.record_count ?? "—"} weather records`}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Contributing factors
                </p>
                <div className="space-y-3">
                  {run.explain.top_factors.map((factor, i) => (
                    <div key={factor.column} className={`animate-fade-up stagger-${Math.min(i + 1, 4)}`}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-medium capitalize text-slate-200">
                          {factor.column.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-slate-500">w={factor.weight.toFixed(2)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                          style={{
                            width: `${(factor.contribution / maxContrib) * 100}%`,
                            transition: `width 1s cubic-bezier(0.34, 1.2, 0.64, 1) ${i * 0.12}s`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        contribution {factor.contribution.toFixed(4)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
