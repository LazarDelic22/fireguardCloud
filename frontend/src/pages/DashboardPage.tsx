import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { ResultCard } from "../components/ResultCard";
import { WatchlistGrid } from "../components/WatchlistGrid";
import {
  listWatchlist,
  runRisk,
  runRiskFromLocation,
  uploadDataset,
  type DatasetRecord,
  type RunRecord,
  type WatchlistRecord,
} from "../api/client";

type Mode = "location" | "csv";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function cityKey(city: WatchlistRecord): string {
  return `${city.name}:${city.lat.toFixed(4)}:${city.lon.toFixed(4)}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("location");

  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [temperatureWeight, setTemperatureWeight] = useState(0.5);
  const [humidityWeight, setHumidityWeight] = useState(0.3);
  const [windWeight, setWindWeight] = useState(0.2);

  const [runResult, setRunResult] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState("");
  const [busyCityKey, setBusyCityKey] = useState<string | null>(null);

  async function loadWatchlist(showSpinner = true) {
    if (showSpinner) setWatchlistLoading(true);
    setWatchlistError("");
    try {
      setWatchlist(await listWatchlist());
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to load city watchlist.");
    } finally {
      if (showSpinner) setWatchlistLoading(false);
    }
  }

  useEffect(() => {
    void loadWatchlist();
  }, []);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setRunResult(null);
  }

  function applyCity(city: WatchlistRecord) {
    setMode("location");
    setLat(String(city.lat));
    setLon(String(city.lon));
    setError("");
  }

  async function handleLocationRisk(event: FormEvent) {
    event.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
      setError("Enter valid coordinates.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await runRiskFromLocation(parsedLat, parsedLon);
      setRunResult(result);
      await loadWatchlist(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a CSV file first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      setDataset(await uploadDataset(selectedFile));
      setRunResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvRisk() {
    if (!dataset) return;
    setError("");
    setLoading(true);
    try {
      setRunResult(
        await runRisk(dataset.dataset_id, {
          weights: { temperature: temperatureWeight, humidity: humidityWeight, wind_speed: windWeight },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk run failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate(city: WatchlistRecord) {
    setBusyCityKey(cityKey(city));
    setError("");
    try {
      const result = await runRiskFromLocation(city.lat, city.lon);
      setRunResult(result);
      setLat(String(city.lat));
      setLon(String(city.lon));
      setMode("location");
      await loadWatchlist(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setBusyCityKey(null);
    }
  }

  const hottestCity = watchlist
    .filter((city) => city.risk_score != null)
    .slice()
    .sort((left, right) => (right.risk_score ?? 0) - (left.risk_score ?? 0))[0];

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Operator Console</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Risk Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Signed in as {user?.username}. Manual runs are stored to your account while scheduled watchlist cities stay globally visible.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Current hotspot</p>
              <p className="mt-1 font-semibold text-white">{hottestCity?.name ?? "Waiting for watchlist data"}</p>
              <p className="text-xs text-slate-500">
                {hottestCity?.risk_score != null ? `score ${hottestCity.risk_score.toFixed(3)}` : "No stored city runs yet"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/70">Low</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Model only stays low when the minimum time to flashover remains at or above five hours.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/70">Medium</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Medium begins once min TTF drops below five hours.</p>
            </div>
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-300/70">High</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">High only appears once min TTF drops below three hours.</p>
            </div>
          </div>
        </div>

        <div className="panel space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Quick pick</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Jump to a watched city</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {watchlist.slice(0, 8).map((city) => (
              <button
                key={cityKey(city)}
                type="button"
                onClick={() => applyCity(city)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-orange-400/30 hover:bg-orange-400/10 hover:text-white"
              >
                {city.name}
              </button>
            ))}
          </div>

          <p className="text-sm leading-6 text-slate-400">
            Select a tracked city to prefill the location form, or go straight to the map when you want a free-click run anywhere in the world.
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel space-y-5">
          <div className="flex gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-1">
            <button
              type="button"
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
                mode === "location"
                  ? "border border-orange-500/20 bg-orange-500/15 text-orange-300"
                  : "text-slate-400 hover:text-slate-100"
              }`}
              onClick={() => switchMode("location")}
            >
              Live location
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
                mode === "csv"
                  ? "border border-orange-500/20 bg-orange-500/15 text-orange-300"
                  : "text-slate-400 hover:text-slate-100"
              }`}
              onClick={() => switchMode("csv")}
            >
              CSV scenario
            </button>
          </div>

          {mode === "location" ? (
            <form className="space-y-5" onSubmit={handleLocationRisk}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Coordinates</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-slate-400">
                    Latitude
                    <input
                      className="input mt-1.5"
                      type="number"
                      step="0.0001"
                      placeholder="37.98"
                      value={lat}
                      onChange={(event) => setLat(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-400">
                    Longitude
                    <input
                      className="input mt-1.5"
                      type="number"
                      step="0.0001"
                      placeholder="23.73"
                      value={lon}
                      onChange={(event) => setLon(event.target.value)}
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Helpful note</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The model is weather-driven. Dry-looking geography does not guarantee a high score; the current forecast still has to produce a short flashover time.
                </p>
              </div>

              <button className="button w-full" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner /> Analyzing live forecast...
                  </>
                ) : (
                  "Run live location analysis"
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <form className="space-y-4" onSubmit={handleUpload}>
                <label className="block text-xs font-medium text-slate-400">
                  Dataset CSV
                  <input
                    className="input mt-1.5"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                <button className="button w-full" type="submit" disabled={loading || !selectedFile}>
                  {loading && !dataset ? (
                    <>
                      <Spinner /> Uploading dataset...
                    </>
                  ) : (
                    "Upload dataset"
                  )}
                </button>
              </form>

              {dataset && (
                <>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <p className="font-semibold text-white">{dataset.filename}</p>
                    <p className="mt-1 text-sm text-slate-400">{dataset.row_count} rows stored</p>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Weights</p>
                    {[
                      { label: "Temperature", value: temperatureWeight, set: setTemperatureWeight },
                      { label: "Humidity", value: humidityWeight, set: setHumidityWeight },
                      { label: "Wind speed", value: windWeight, set: setWindWeight },
                    ].map(({ label, value, set }) => (
                      <label key={label} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>{label}</span>
                        <input
                          className="input w-24 text-center"
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={value}
                          onChange={(event) => set(Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>

                  <button className="button w-full" onClick={handleCsvRisk} disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner /> Running weighted scenario...
                      </>
                    ) : (
                      "Compute scenario risk"
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}
        </div>

        {runResult ? (
          <ResultCard run={runResult} />
        ) : (
          <section className="panel flex min-h-[320px] flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Awaiting result</p>
              <h2 className="mt-1 text-2xl font-bold text-white">No analysis selected yet</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                Run a location analysis or a CSV scenario and the latest result will render here with the FRCM explanation or factor breakdown.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Manual runs</p>
                <p className="mt-2 text-sm text-slate-300">Stored to your session-backed user account.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Background cities</p>
                <p className="mt-2 text-sm text-slate-300">Visible in the watchlist even before anyone clicks the map.</p>
              </div>
            </div>
          </section>
        )}
      </section>

      <WatchlistGrid
        cities={watchlist}
        loading={watchlistLoading}
        error={watchlistError}
        eyebrow="City Watchlist"
        title="Live city board"
        subtitle="Use this as the fastest demo path: inspect background snapshots, prefill the console, or force a fresh calculation."
        compact
        actionHref="/map"
        actionLabel="Open map"
        onRecalculate={handleRecalculate}
        busyCityKey={busyCityKey}
      />
    </div>
  );
}
