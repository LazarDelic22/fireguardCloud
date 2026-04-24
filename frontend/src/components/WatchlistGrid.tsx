import { Link } from "react-router-dom";

import type { WatchlistRecord } from "../api/client";
import { RiskBadge, riskDotClass, riskTextClass } from "./RiskBadge";

type WatchlistGridProps = {
  cities: WatchlistRecord[];
  loading?: boolean;
  error?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  actionHref?: string;
  actionLabel?: string;
  onRecalculate?: (city: WatchlistRecord) => void;
  busyCityKey?: string | null;
};

function cityKey(city: WatchlistRecord): string {
  return `${city.name}:${city.lat.toFixed(4)}:${city.lon.toFixed(4)}`;
}

function formatUpdatedAt(value?: string | null): string {
  if (!value) return "Bootstrapping first snapshot";
  return new Date(value).toLocaleString();
}

function cardTone(level?: string | null): string {
  if (level === "low") return "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.09),rgba(2,6,23,0.72))]";
  if (level === "medium") return "border-amber-400/15 bg-[linear-gradient(180deg,rgba(245,158,11,0.11),rgba(2,6,23,0.72))]";
  if (level === "high") return "border-rose-400/15 bg-[linear-gradient(180deg,rgba(225,29,72,0.11),rgba(2,6,23,0.72))]";
  return "border-white/10 bg-[linear-gradient(180deg,rgba(148,163,184,0.05),rgba(2,6,23,0.72))]";
}

export function WatchlistGrid({
  cities,
  loading = false,
  error = "",
  eyebrow = "Watchlist",
  title = "Tracked Cities",
  subtitle = "Pre-calculated cities polled by the scheduler. Recalculate any card when you want a fresh check.",
  compact = false,
  actionHref,
  actionLabel,
  onRecalculate,
  busyCityKey = null,
}: WatchlistGridProps) {
  return (
    <section className="panel space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">{eyebrow}</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actionHref && actionLabel && (
              <Link to={actionHref} className="button-ghost px-3 py-2 text-xs">
                {actionLabel}
              </Link>
            )}
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
              {cities.length} cities
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
          {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-3xl border border-white/8 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
          {cities.map((city) => {
            const isBusy = busyCityKey === cityKey(city);
            const tone = riskTextClass(city.risk_level);

            return (
              <article
                key={cityKey(city)}
                className={`overflow-hidden rounded-3xl border p-5 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${cardTone(city.risk_level)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold tracking-tight text-white">{city.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.26em] text-slate-500">{city.country}</p>
                  </div>
                  <RiskBadge level={city.risk_level} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Risk score</p>
                    <p className={`mt-3 text-3xl font-bold ${tone}`}>
                      {city.risk_score != null ? city.risk_score.toFixed(3) : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Min TTF</p>
                    <p className="mt-3 text-3xl font-bold text-white">
                      {city.min_ttf_hours != null ? city.min_ttf_hours.toFixed(1) : "—"}
                      <span className="ml-1 text-sm font-medium text-slate-500">h</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${riskDotClass(city.risk_level)}`} />
                    <span>
                      {city.risk_level ? "Latest city snapshot stored" : "Scheduler is warming this city up"}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-500">
                    {city.lat.toFixed(2)}, {city.lon.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">{formatUpdatedAt(city.updated_at)}</p>
                </div>

                {onRecalculate && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => onRecalculate(city)}
                      disabled={isBusy}
                      className="button w-full px-3 py-2 text-xs"
                    >
                      {isBusy ? "Running..." : "Recalculate city"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
