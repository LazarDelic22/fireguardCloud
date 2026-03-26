import { Link } from "react-router-dom";

const pipeline = [
  { n: "01", label: "Forecast", sub: "MET Norway" },
  { n: "02", label: "FRCM", sub: "Fire model" },
  { n: "03", label: "Score", sub: "0 – 1 risk" },
  { n: "04", label: "Persist", sub: "SQLite" },
];

export function LandingPage() {
  return (
    <div className="space-y-5 animate-fade-up">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02] p-10 md:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/[0.06] via-transparent to-transparent" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-amber-500/[0.08] blur-3xl" />

        <div className="relative z-10 max-w-xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse-glow" />
            Live · NREC · Sprint 3
          </span>
          <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-7xl">
            Fire Risk<br />Intelligence
          </h1>
          <p className="text-[15px] leading-relaxed text-slate-400">
            Live MET Norway forecasts → FRCM fire model → real-time risk score. Deployed on NREC cloud.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link to="/dashboard" className="button text-sm px-5 py-2.5">
              Open Dashboard
            </Link>
            <Link to="/history" className="button-ghost text-sm px-5 py-2.5">
              View History
            </Link>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-1">
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.07] p-5 transition-colors duration-200 hover:bg-sky-500/[0.12]">
          <p className="text-sm font-semibold text-sky-300">MET Norway</p>
          <p className="mt-1 text-xs text-slate-500">48-h Locationforecast 2.0</p>
        </div>
        <div className="rounded-2xl border border-orange-400/20 bg-orange-500/[0.07] p-5 transition-colors duration-200 hover:bg-orange-500/[0.12]">
          <p className="text-sm font-semibold text-orange-300">FRCM Model</p>
          <p className="mt-1 text-xs text-slate-500">dynamic-frcm-simple · TTF</p>
        </div>
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-5 transition-colors duration-200 hover:bg-violet-500/[0.12]">
          <p className="text-sm font-semibold text-violet-300">NREC Cloud</p>
          <p className="mt-1 text-xs text-slate-500">OpenStack · OSL region</p>
        </div>
      </div>

      {/* Pipeline */}
      <section className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6 animate-fade-up stagger-2 md:p-8">
        <p className="mb-7 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Location risk pipeline
        </p>
        <div className="flex items-start">
          {pipeline.map((step, i) => (
            <div key={step.n} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-mono text-orange-500/50">{step.n}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400 text-xs font-bold shadow-md shadow-orange-500/10">
                  {i + 1}
                </div>
                <span className="text-xs font-semibold text-slate-200">{step.label}</span>
                <span className="text-[10px] text-slate-500">{step.sub}</span>
              </div>
              {i < pipeline.length - 1 && (
                <div className="relative -mt-8 flex-1 px-1">
                  <div className="h-px w-full bg-gradient-to-r from-orange-500/40 to-orange-500/10" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-orange-500/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
