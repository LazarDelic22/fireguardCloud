import { FormEvent, useState } from "react";

import { ResultCard } from "../components/ResultCard";
import {
  runRisk,
  runRiskFromLocation,
  uploadDataset,
  type DatasetRecord,
  type RunRecord,
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

export function DashboardPage() {
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

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setRunResult(null);
  }

  async function handleLocationRisk(event: FormEvent) {
    event.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setError("Enter valid coordinates.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      setRunResult(await runRiskFromLocation(parsedLat, parsedLon));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) { setError("Choose a CSV file first."); return; }
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

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] animate-fade-up">
      {/* Controls */}
      <section className="panel space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400/70">FireGuard</p>
          <h1 className="mt-0.5 text-2xl font-bold text-white">Risk Dashboard</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-1">
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
              mode === "location"
                ? "bg-orange-500/20 text-orange-300 border border-orange-500/25 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => switchMode("location")}
          >
            Location
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
              mode === "csv"
                ? "bg-orange-500/20 text-orange-300 border border-orange-500/25 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => switchMode("csv")}
          >
            CSV Upload
          </button>
        </div>

        {/* Location form */}
        {mode === "location" && (
          <form className="space-y-4 animate-fade-in" onSubmit={handleLocationRisk}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-400">
                Latitude
                <input
                  className="input mt-1.5"
                  type="number"
                  step="0.0001"
                  placeholder="60.3913"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-slate-400">
                Longitude
                <input
                  className="input mt-1.5"
                  type="number"
                  step="0.0001"
                  placeholder="5.3221"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  required
                />
              </label>
            </div>

            {/* Quick-fill chips */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600">Quick fill:</span>
              <button
                type="button"
                className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300 transition hover:bg-orange-500/20"
                onClick={() => { setLat("60.3913"); setLon("5.3221"); }}
              >
                Bergen
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                onClick={() => { setLat("59.9139"); setLon("10.7522"); }}
              >
                Oslo
              </button>
            </div>

            <button className="button w-full" type="submit" disabled={loading}>
              {loading ? <><Spinner /> Analyzing…</> : "Get Fire Risk"}
            </button>
          </form>
        )}

        {/* CSV form */}
        {mode === "csv" && (
          <div className="space-y-4 animate-fade-in">
            <form className="space-y-3" onSubmit={handleUpload}>
              <label className="block text-xs font-medium text-slate-400">
                Dataset CSV
                <input
                  className="input mt-1.5"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button className="button w-full" type="submit" disabled={loading || !selectedFile}>
                {loading && !dataset ? <><Spinner /> Uploading…</> : "Upload Dataset"}
              </button>
            </form>

            {dataset && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm">
                  <span className="text-emerald-400">✓</span>
                  <div>
                    <p className="font-medium text-slate-100">{dataset.filename}</p>
                    <p className="text-xs text-slate-400">{dataset.row_count} rows</p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-white/[0.07] bg-black/20 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Weights</p>
                  {[
                    { label: "Temperature", value: temperatureWeight, set: setTemperatureWeight },
                    { label: "Humidity", value: humidityWeight, set: setHumidityWeight },
                    { label: "Wind speed", value: windWeight, set: setWindWeight },
                  ].map(({ label, value, set }) => (
                    <label key={label} className="flex items-center justify-between gap-3 text-xs text-slate-300">
                      <span>{label}</span>
                      <input
                        className="input w-20 text-center"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={value}
                        onChange={(e) => set(Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>

                <button className="button w-full" onClick={handleCsvRisk} disabled={loading}>
                  {loading ? <><Spinner /> Running…</> : "Run Risk"}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="animate-fade-in rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </div>
        )}
      </section>

      {/* Result */}
      {runResult ? (
        <ResultCard run={runResult} />
      ) : (
        <section className="panel flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
            🔥
          </div>
          <p className="text-sm text-slate-500">
            {mode === "location" ? "Enter coordinates to analyze fire risk." : "Upload a CSV to get started."}
          </p>
        </section>
      )}
    </div>
  );
}
