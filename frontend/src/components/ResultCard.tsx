import type { RunRecord } from "../api/client";

type ResultCardProps = {
  run: RunRecord;
};

function levelStyles(level: RunRecord["risk_level"]): string {
  if (level === "low") return "bg-emerald-300/20 text-emerald-200 border-emerald-300/30";
  if (level === "medium") return "bg-amber-300/20 text-amber-200 border-amber-300/30";
  return "bg-rose-300/20 text-rose-200 border-rose-300/30";
}

export function ResultCard({ run }: ResultCardProps) {
  const isFrcm = run.explain.model === "dynamic-frcm-simple";

  return (
    <section className="panel h-full space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">Latest run</p>
          <h2 className="text-2xl font-semibold text-white">Risk result</h2>
          {run.lat != null && run.lon != null && (
            <p className="mt-1 text-xs text-slate-400">
              {run.lat.toFixed(4)}, {run.lon.toFixed(4)}
            </p>
          )}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${levelStyles(run.risk_level)}`}>
          {run.risk_level}
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Risk score</p>
        <p className="text-5xl font-bold tracking-tight text-cyan-200">{run.risk_score.toFixed(3)}</p>
        {isFrcm && (
          <p className="mt-1 text-xs text-slate-400">
            Model: dynamic-frcm-simple &nbsp;|&nbsp; min TTF: {run.explain.min_ttf_hours?.toFixed(2)} h
          </p>
        )}
      </div>

      {/* FRCM model info */}
      {isFrcm && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">FRCM forecast summary</p>
          <p>Min time to flashover: <span className="text-white">{run.explain.min_ttf_hours?.toFixed(2)} h</span></p>
          <p>Mean time to flashover: <span className="text-white">{run.explain.mean_ttf_hours?.toFixed(2)} h</span></p>
          <p className="mt-1 text-xs text-slate-500">
            Lower TTF = higher fire risk. Source: MET Norway Locationforecast.
          </p>
        </div>
      )}

      {/* CSV run: top contributing factors */}
      {!isFrcm && run.explain.top_factors.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Top factors</p>
          <div className="space-y-2">
            {run.explain.top_factors.map((factor) => (
              <div key={factor.column} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{factor.column}</span>
                  <span className="text-xs text-slate-400">weight {factor.weight.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">contribution {factor.contribution.toFixed(4)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">Run #{run.run_id} &nbsp;|&nbsp; {new Date(run.created_at).toLocaleString()}</p>
    </section>
  );
}
