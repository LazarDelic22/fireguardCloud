import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { listWatchlist, runRiskFromLocation, type WatchlistRecord } from "../api/client";
import { WatchlistGrid } from "../components/WatchlistGrid";
import { RiskBadge } from "../components/RiskBadge";

const thresholds = [
  {
    label: "Low",
    rule: "min TTF >= 5h",
    detail: "Mild or humid conditions keep flashover far enough away that the model stays calm.",
    tone: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
  },
  {
    label: "Medium",
    rule: "min TTF < 5h",
    detail: "The forecast starts to compress the time to flashover, so the score rises into a warning band.",
    tone: "border-amber-400/20 bg-amber-400/5 text-amber-300",
  },
  {
    label: "High",
    rule: "min TTF < 3h",
    detail: "The weather becomes aggressive enough that flashover could happen quickly.",
    tone: "border-rose-400/20 bg-rose-400/5 text-rose-300",
  },
];

const explainer = [
  {
    title: "Pre-calculated cities",
    text: "A background job fills the watchlist so the app has live examples before anyone clicks the map.",
  },
  {
    title: "Shared city board",
    text: "Watched cities are global and public. That makes the homepage useful even before you sign in.",
  },
  {
    title: "User-triggered runs",
    text: "After login, your manual map and dashboard runs are attached to your account instead of mixed with everyone else.",
  },
];

function cityKey(city: WatchlistRecord): string {
  return `${city.name}:${city.lat.toFixed(4)}:${city.lon.toFixed(4)}`;
}

export function LandingPage() {
  const { user } = useAuth();
  const [cities, setCities] = useState<WatchlistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCityKey, setBusyCityKey] = useState<string | null>(null);

  async function loadWatchlist(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      setCities(await listWatchlist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    void loadWatchlist();
  }, []);

  async function handleRecalculate(city: WatchlistRecord) {
    setBusyCityKey(cityKey(city));
    setError("");
    try {
      await runRiskFromLocation(city.lat, city.lon);
      await loadWatchlist(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh city.");
    } finally {
      setBusyCityKey(null);
    }
  }

  const readyCities = cities
    .filter((city) => city.risk_score != null)
    .slice()
    .sort((left, right) => (right.risk_score ?? 0) - (left.risk_score ?? 0));
  const topCity = readyCities[0];
  const previewCities = cities.slice(0, 6);
  const readyCount = readyCities.length;
  const livePreview = readyCities.slice(0, 4);

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.88))] p-8 md:p-10 xl:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(245,158,11,0.16),_transparent_24%),radial-gradient(circle_at_50%_100%,_rgba(244,63,94,0.08),_transparent_25%)]" />
        <div className="absolute inset-y-0 right-[35%] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent xl:block hidden" />

        <div className="relative grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse-glow" />
              Live weather + FRCM
            </span>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight text-white md:text-6xl">
                Live fire risk that is already waiting when the demo starts.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                FireGuard fetches MET Norway forecasts, runs the FRCM model, stores the result, and keeps a public watchlist of major cities warm in the background.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link to="/dashboard" className="button px-5 py-3 text-sm">
                    Open dashboard
                  </Link>
                  <Link to="/map" className="button-ghost px-5 py-3 text-sm">
                    Open map
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="button px-5 py-3 text-sm">
                    Sign in
                  </Link>
                  <Link to="/register" className="button-ghost px-5 py-3 text-sm">
                    Create account
                  </Link>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Watchlist ready</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {readyCount}
                  <span className="ml-1 text-lg text-slate-500">/ {cities.length || 14}</span>
                </p>
                <p className="text-sm text-slate-400">cities with stored snapshots</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Current top city</p>
                <p className="mt-2 text-2xl font-bold text-white">{topCity?.name ?? "Warming up"}</p>
                <p className="text-sm text-slate-400">
                  {topCity?.risk_score != null ? `score ${topCity.risk_score.toFixed(3)}` : "startup bootstrap is filling the board"}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Access</p>
                <p className="mt-2 text-2xl font-bold text-white">{user ? user.username : "Demo ready"}</p>
                <p className="text-sm text-slate-400">
                  {user ? "JWT session active" : "public watchlist first, login second"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-6 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Live board</p>
                <h2 className="mt-1 text-2xl font-bold text-white">What the homepage is showing</h2>
              </div>
              {topCity ? <RiskBadge level={topCity.risk_level} /> : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(15,23,42,0.5))] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-200/70">Featured city</p>
              <p className="mt-2 text-3xl font-bold text-white">{topCity?.name ?? "Watchlist bootstrap"}</p>
              <p className="mt-1 text-sm text-slate-300">
                {topCity?.country ?? "The backend seeds missing city snapshots on startup, then the hourly scheduler keeps them fresh."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Risk score</p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {topCity?.risk_score != null ? topCity.risk_score.toFixed(3) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Min TTF</p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {topCity?.min_ttf_hours != null ? topCity.min_ttf_hours.toFixed(1) : "—"}
                    <span className="ml-1 text-sm font-medium text-slate-500">h</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {livePreview.length > 0 ? (
                livePreview.map((city) => (
                  <div
                    key={cityKey(city)}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-white">{city.name}</p>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{city.country}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-white">{city.risk_score?.toFixed(3)}</p>
                      <p className="text-xs text-slate-500">
                        {city.min_ttf_hours != null ? `${city.min_ttf_hours.toFixed(1)}h TTF` : "No TTF yet"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
                  No city snapshots yet. If you are using Docker with the scheduler enabled, the backend will seed them at startup before the page becomes useful.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {thresholds.map((threshold) => (
          <article key={threshold.label} className={`rounded-3xl border p-5 ${threshold.tone}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em]">{threshold.label}</p>
              <span className="font-mono text-sm text-slate-100">{threshold.rule}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{threshold.detail}</p>
          </article>
        ))}
      </section>

      <WatchlistGrid
        cities={previewCities}
        loading={loading}
        error={error}
        eyebrow="Public Watchlist"
        title="Watched cities"
        subtitle="This is the public board you can show before login. It previews the first six watched cities and proves the backend has already done useful work."
        actionHref={user ? "/dashboard" : "/login"}
        actionLabel={user ? "Open dashboard" : "Sign in to run your own analyses"}
        onRecalculate={user ? handleRecalculate : undefined}
        busyCityKey={busyCityKey}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {explainer.map((item) => (
          <article
            key={item.title}
            className="panel border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.75))]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">How it works</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
