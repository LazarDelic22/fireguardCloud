import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { RiskGauge } from "../components/ResultCard";
import { RiskBadge } from "../components/RiskBadge";
import { getRun, type RunRecord } from "../api/client";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-100">{value}</p>
    </div>
  );
}

export function RunDetailsPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runId) {
      setError("Run ID missing.");
      setLoading(false);
      return;
    }
    const currentRunId = runId;

    async function load() {
      setLoading(true);
      setError("");
      try {
        setRun(await getRun(currentRunId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load run.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [runId]);

  const isFrcm = run?.explain.model === "dynamic-frcm-simple";
  const maxContrib = run?.explain.top_factors.length
    ? Math.max(...run.explain.top_factors.map((factor) => factor.contribution))
    : 1;
  const maxPreviewTtf = run?.explain.ttf_preview?.length
    ? Math.max(...run.explain.ttf_preview.map((point) => point.ttf))
    : 1;

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Run details</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Run #{runId}</h1>
        </div>
        <Link className="button-ghost px-4 py-2 text-sm" to="/history">
          Back to history
        </Link>
      </section>

      {loading && (
        <div className="panel flex items-center gap-2 text-sm text-slate-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading run details...
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
          {error}
        </p>
      )}

      {run && (
        <>
          <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="panel space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Summary</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">{isFrcm ? "Live location run" : "CSV scenario run"}</h2>
                </div>
                <RiskBadge level={run.risk_level} />
              </div>

              <RiskGauge score={run.risk_score} level={run.risk_level} />

              <div className="grid gap-3 md:grid-cols-2">
                <Stat label="Risk score" value={run.risk_score.toFixed(4)} />
                <Stat label="Created" value={new Date(run.created_at).toLocaleString()} />
                <Stat label="Run source" value={run.source === "scheduled" ? "Watchlist scheduler" : "Manual request"} />
                {run.lat != null && run.lon != null ? (
                  <Stat label="Coordinates" value={`${run.lat.toFixed(4)}, ${run.lon.toFixed(4)}`} />
                ) : (
                  <Stat label="Dataset" value={run.dataset_id ?? "Unavailable"} />
                )}
              </div>
            </div>

            <div className="panel space-y-5">
              {isFrcm ? (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Forecast model</p>
                    <h2 className="mt-1 text-2xl font-bold text-white">Flashover timing</h2>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Min TTF</p>
                      <p className="mt-2 text-4xl font-bold text-white">
                        {run.explain.min_ttf_hours?.toFixed(1)}
                        <span className="ml-1 text-sm font-medium text-slate-500">h</span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Mean TTF</p>
                      <p className="mt-2 text-4xl font-bold text-white">
                        {run.explain.mean_ttf_hours?.toFixed(1)}
                        <span className="ml-1 text-sm font-medium text-slate-500">h</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">TTF preview</p>
                    <div className="mt-4 flex items-end gap-2">
                      {run.explain.ttf_preview?.map((point) => (
                        <div key={point.timestamp} className="flex flex-1 flex-col items-center gap-2">
                          <div className="flex h-36 w-full items-end rounded-t-xl bg-white/[0.04] p-1">
                            <div
                              className="w-full rounded-lg bg-gradient-to-t from-orange-500 to-amber-300"
                              style={{ height: `${Math.max(12, (point.ttf / maxPreviewTtf) * 100)}%` }}
                            />
                          </div>
                          <p className="font-mono text-[10px] text-slate-500">{point.ttf.toFixed(1)}h</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Factor view</p>
                    <h2 className="mt-1 text-2xl font-bold text-white">Weighted contributions</h2>
                  </div>

                  <div className="space-y-3">
                    {run.explain.top_factors.map((factor) => (
                      <div key={factor.column} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-medium capitalize text-slate-100">
                            {factor.column.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-slate-500">weight {factor.weight.toFixed(2)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300"
                            style={{ width: `${(factor.contribution / maxContrib) * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          contribution {factor.contribution.toFixed(4)} · normalized mean {factor.normalized_mean.toFixed(4)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Stat label="Model" value={isFrcm ? "dynamic-frcm-simple" : "weighted CSV engine"} />
            <Stat label="Records" value={`${run.explain.record_count} input records`} />
            <Stat label="Persistence" value="Stored in backend history for later review" />
          </section>
        </>
      )}
    </div>
  );
}
