import { Link } from "react-router-dom";

const features = [
  {
    title: "Deterministic risk scoring",
    text: "Same input always gives the same output. Easy to explain and easy to verify in oral exam.",
  },
  {
    title: "Dataset + run history",
    text: "Upload once, run multiple times with different weights, and inspect historical run outputs.",
  },
  {
    title: "Explainable factors",
    text: "Every result includes top contributors so risk level is not a black box.",
  },
];

const flow = [
  "Upload weather CSV",
  "Store metadata + SHA256",
  "Compute normalized weighted score",
  "Save run and inspect explanation",
];

export function LandingPage() {
  return (
    <div className="space-y-10 md:space-y-14">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 md:p-12">
        <div className="absolute right-0 top-0 h-56 w-56 translate-x-20 -translate-y-20 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-16 translate-y-16 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <span className="inline-flex rounded-full border border-cyan-300/50 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
            Sprint 3 • End-to-end prototype
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            Fire risk analytics with a modern interface and explainable output.
          </h1>
          <p className="text-base leading-relaxed text-slate-200 md:text-lg">
            FireGuard combines CSV ingestion, deterministic risk scoring, persistence, and history tracking into one
            coherent demo. Built for clarity, presentation, and fast iteration.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Open Dashboard
            </Link>
            <Link
              to="/history"
              className="rounded-xl border border-white/30 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View Run History
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div>
          <h2 className="text-2xl font-semibold text-white">How FireGuard works</h2>
          <p className="mt-2 text-sm text-slate-300">
            The architecture is intentionally practical: input data in, deterministic computation, persistent runs out.
          </p>
          <div className="mt-5 space-y-3">
            {flow.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300/20 text-sm font-semibold text-cyan-200">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-100">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Architecture snapshot</p>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
{`Dashboard UI
   ↓
FastAPI API
   ↓
Risk Engine
   ↓
SQLite (datasets + runs)`}
          </pre>
        </aside>
      </section>
    </div>
  );
}

