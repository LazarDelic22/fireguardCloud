import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listRuns, type RunRecord } from "../api/client";

export function HistoryPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRuns() {
      setLoading(true);
      setError("");
      try {
        const items = await listRuns();
        setRuns(items);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load runs.");
      } finally {
        setLoading(false);
      }
    }
    void loadRuns();
  }, []);

  return (
    <section className="panel space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan-300">Persisted runs</p>
          <h1 className="text-3xl font-bold text-white">History</h1>
        </div>
        <p className="text-xs text-slate-400">{runs.length} runs</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading runs...</p>}
      {error && <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-3 py-3">Run</th>
                <th className="px-3 py-3">Dataset</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Level</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id} className="border-t border-white/10 text-slate-200 hover:bg-white/5">
                  <td className="px-3 py-3">
                    <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to={`/runs/${run.run_id}`}>
                      #{run.run_id}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{run.dataset_id}</td>
                  <td className="px-3 py-3">{run.risk_score.toFixed(3)}</td>
                  <td className="px-3 py-3 uppercase">{run.risk_level}</td>
                  <td className="px-3 py-3">{new Date(run.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No runs yet.</p>}
        </div>
      )}
    </section>
  );
}

