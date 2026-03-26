import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getRun, type RunRecord } from "../api/client";

export function RunDetailsPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentRunId = runId;
    if (!currentRunId) {
      setError("Run ID is missing.");
      setLoading(false);
      return;
    }

    async function loadRun() {
      setLoading(true);
      setError("");
      try {
        const data = await getRun(currentRunId!);
        setRun(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load run details.");
      } finally {
        setLoading(false);
      }
    }
    void loadRun();
  }, [runId]);

  const isFrcm = run?.explain.model === "dynamic-frcm-simple";

  return (
    <section className="panel space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan-300">Run details</p>
          <h1 className="text-3xl font-bold text-white">Run #{runId}</h1>
        </div>
        <Link className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10" to="/history">
          Back
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading run...</p>}
      {error && <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {run && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: core result */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-200 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">Result</p>
            <p className="text-5xl font-bold text-cyan-200">{run.risk_score.toFixed(3)}</p>
            <p className="text-sm uppercase tracking-wide text-slate-300">{run.risk_level} risk</p>

            {/* Location run */}
            {isFrcm && run.lat != null && run.lon != null && (
              <>
                <p className="text-xs text-slate-400">Location</p>
                <p className="text-sm">{run.lat.toFixed(4)}, {run.lon.toFixed(4)}</p>
                <p className="text-xs text-slate-400">Model</p>
                <p className="text-sm">dynamic-frcm-simple</p>
                <p className="text-xs text-slate-400">Source</p>
                <p className="text-sm">MET Norway Locationforecast</p>
              </>
            )}

            {/* CSV run */}
            {!isFrcm && run.dataset_id && (
              <>
                <p className="text-xs text-slate-400">Dataset ID</p>
                <p className="font-mono text-xs break-all">{run.dataset_id}</p>
              </>
            )}

            <p className="text-xs text-slate-400">Created</p>
            <p className="text-sm">{new Date(run.created_at).toLocaleString()}</p>
          </div>

          {/* Right: model-specific detail */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
            {isFrcm ? (
              <>
                <p className="text-xs uppercase tracking-wider text-slate-400">FRCM forecast summary</p>
                <div className="space-y-2 text-sm text-slate-200">
                  <p>Min time to flashover: <span className="text-white font-semibold">{run.explain.min_ttf_hours?.toFixed(2)} h</span></p>
                  <p>Mean time to flashover: <span className="text-white font-semibold">{run.explain.mean_ttf_hours?.toFixed(2)} h</span></p>
                  <p className="text-xs text-slate-400 mt-2">Lower TTF = higher fire risk.</p>
                  <p className="text-xs text-slate-400">Based on {run.explain.record_count} weather data points.</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wider text-slate-400">Top contributing factors</p>
                <ul className="space-y-2">
                  {run.explain.top_factors.map((factor) => (
                    <li key={factor.column} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100">
                      <p className="font-semibold">{factor.column}</p>
                      <p className="text-xs text-slate-300">contribution {factor.contribution.toFixed(4)}</p>
                      <p className="text-xs text-slate-400">weight {factor.weight.toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
