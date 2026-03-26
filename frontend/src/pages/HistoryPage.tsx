import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listRuns, type RunRecord } from "../api/client";

function RiskBadge({ level }: { level: RunRecord["risk_level"] }) {
  const cls =
    level === "low" ? "badge-low" : level === "medium" ? "badge-medium" : "badge-high";
  return <span className={cls}>{level}</span>;
}

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        setRuns(await listRuns());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <section className="panel space-y-5 animate-fade-up">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400/70">Persisted</p>
          <h1 className="mt-0.5 text-2xl font-bold text-white">Run History</h1>
        </div>
        {!loading && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
        )}
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

      {!loading && !error && runs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-3xl">📭</span>
          <p className="text-sm text-slate-500">No runs yet. Start from the Dashboard.</p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.07] animate-fade-in">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/[0.07] bg-white/[0.03]">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Run
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.run_id}
                  className="border-t border-white/[0.05] transition-colors duration-100 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      className="font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                      to={`/runs/${run.run_id}`}
                    >
                      #{run.run_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <RunType run={run} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-200">{run.risk_score.toFixed(3)}</td>
                  <td className="px-4 py-3.5">
                    <RiskBadge level={run.risk_level} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">
                    {new Date(run.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
