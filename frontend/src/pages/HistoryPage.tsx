import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listRuns, type RunRecord } from "../api/client";
import { RiskBadge } from "../components/RiskBadge";

type SourceFilter = "all" | "manual" | "scheduled";
type RiskFilter = "all" | "low" | "medium" | "high";

function RunType({ run }: { run: RunRecord }) {
  if (run.lat != null && run.lon != null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
        <span className="text-orange-400">📍</span>
        <span className="font-mono text-slate-400">
          {run.lat.toFixed(2)}, {run.lon.toFixed(2)}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <span className="text-sky-400">📄</span>
      <span className="font-mono text-slate-500">{run.dataset_id?.slice(0, 10)}…</span>
    </span>
  );
}

export function HistoryPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        setRuns(await listRuns());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filteredRuns = runs.filter((run) => {
    const sourceMatches = sourceFilter === "all" || run.source === sourceFilter;
    const riskMatches = riskFilter === "all" || run.risk_level === riskFilter;
    return sourceMatches && riskMatches;
  });

  const scheduledCount = runs.filter((run) => run.source === "scheduled").length;
  const manualCount = runs.filter((run) => run.source !== "scheduled").length;

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">History</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Run Archive</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Review your manual analyses and the shared watchlist traffic in one place.
          </p>
        </div>
        <div className="panel">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Manual runs</p>
          <p className="mt-2 text-3xl font-bold text-white">{manualCount}</p>
          <p className="text-sm text-slate-400">Triggered from the dashboard or map.</p>
        </div>
        <div className="panel">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Scheduled runs</p>
          <p className="mt-2 text-3xl font-bold text-white">{scheduledCount}</p>
          <p className="text-sm text-slate-400">Background watchlist snapshots.</p>
        </div>
      </section>

      <section className="panel space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Filters</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Focus the run stream</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
              {(["all", "manual", "scheduled"] as SourceFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSourceFilter(option)}
                  className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                    sourceFilter === option
                      ? "bg-orange-500/15 text-orange-300"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
              {(["all", "low", "medium", "high"] as RiskFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRiskFilter(option)}
                  className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                    riskFilter === option
                      ? "bg-orange-500/15 text-orange-300"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading run history...
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        {!loading && !error && filteredRuns.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl">📭</span>
            <p className="text-sm text-slate-500">No runs match the current filters.</p>
          </div>
        )}

        {!loading && !error && filteredRuns.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/20">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[0.8fr_1.4fr_0.7fr_0.7fr_1fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <span>Run</span>
                <span>Origin</span>
                <span>Score</span>
                <span>Risk</span>
                <span>Created</span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {filteredRuns.map((run) => (
                  <div
                    key={run.run_id}
                    className="grid grid-cols-[0.8fr_1.4fr_0.7fr_0.7fr_1fr] gap-3 px-4 py-4 text-sm transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center">
                      <Link
                        to={`/runs/${run.run_id}`}
                        className="font-semibold text-orange-300 transition-colors hover:text-orange-200"
                      >
                        #{run.run_id}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <RunType run={run} />
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        {run.source === "scheduled" ? "watchlist" : "manual"}
                      </span>
                    </div>
                    <div className="flex items-center font-mono text-slate-200">{run.risk_score.toFixed(3)}</div>
                    <div className="flex items-center">
                      <RiskBadge level={run.risk_level} />
                    </div>
                    <div className="flex items-center text-xs text-slate-400">
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
