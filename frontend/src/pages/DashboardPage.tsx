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

export function DashboardPage() {
  const [mode, setMode] = useState<Mode>("location");

  // Location mode state
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  // CSV mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [temperatureWeight, setTemperatureWeight] = useState(0.5);
  const [humidityWeight, setHumidityWeight] = useState(0.3);
  const [windWeight, setWindWeight] = useState(0.2);

  // Shared state
  const [runResult, setRunResult] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLocationRisk(event: FormEvent) {
    event.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setError("Enter valid latitude and longitude values.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await runRiskFromLocation(parsedLat, parsedLon);
      setRunResult(result);
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
      const uploaded = await uploadDataset(selectedFile);
      setDataset(uploaded);
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
      const result = await runRisk(dataset.dataset_id, {
        weights: { temperature: temperatureWeight, humidity: humidityWeight, wind_speed: windWeight },
      });
      setRunResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk run failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="panel space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan-300">Live workflow</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Risk dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Compute fire risk from a live location (MET Norway + FRCM model) or from an uploaded CSV dataset.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === "location"
                ? "bg-cyan-600 text-white"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
            onClick={() => { setMode("location"); setError(""); setRunResult(null); }}
          >
            Location (MET + FRCM)
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === "csv"
                ? "bg-cyan-600 text-white"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
            onClick={() => { setMode("csv"); setError(""); setRunResult(null); }}
          >
            CSV upload
          </button>
        </div>

        {/* Location form */}
        {mode === "location" && (
          <form className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4" onSubmit={handleLocationRisk}>
            <p className="text-xs text-slate-400">
              Fetches a 48-hour forecast from MET Norway and runs the FRCM fire-risk model.
            </p>
            <label className="block text-sm text-slate-200">
              Latitude
              <input
                className="input mt-1"
                type="number"
                step="0.0001"
                placeholder="60.3913"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-200">
              Longitude
              <input
                className="input mt-1"
                type="number"
                step="0.0001"
                placeholder="5.3221"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                required
              />
            </label>
            <p className="text-xs text-slate-500">Bergen: 60.3913, 5.3221 &nbsp;|&nbsp; Oslo: 59.9139, 10.7522</p>
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Fetching forecast..." : "Get fire risk"}
            </button>
          </form>
        )}

        {/* CSV upload form */}
        {mode === "csv" && (
          <div className="space-y-4">
            <form className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4" onSubmit={handleUpload}>
              <label className="block text-sm font-medium text-slate-200">Dataset CSV</label>
              <input
                className="input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <button className="button" type="submit" disabled={loading}>
                {loading ? "Uploading..." : "Upload dataset"}
              </button>
            </form>

            {dataset && (
              <>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
                  <p><span className="text-slate-400">File:</span> {dataset.filename}</p>
                  <p className="mt-1"><span className="text-slate-400">Rows:</span> {dataset.row_count}</p>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Weights</h2>
                  <label className="block text-sm text-slate-200">
                    Temperature
                    <input className="input mt-1" type="number" step="0.1" value={temperatureWeight}
                      onChange={(e) => setTemperatureWeight(Number(e.target.value))} />
                  </label>
                  <label className="block text-sm text-slate-200">
                    Humidity
                    <input className="input mt-1" type="number" step="0.1" value={humidityWeight}
                      onChange={(e) => setHumidityWeight(Number(e.target.value))} />
                  </label>
                  <label className="block text-sm text-slate-200">
                    Wind speed
                    <input className="input mt-1" type="number" step="0.1" value={windWeight}
                      onChange={(e) => setWindWeight(Number(e.target.value))} />
                  </label>
                </div>

                <button className="button" onClick={handleCsvRisk} disabled={loading}>
                  {loading ? "Running..." : "Run risk"}
                </button>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}
      </section>

      {runResult ? (
        <ResultCard run={runResult} />
      ) : (
        <section className="panel flex min-h-[260px] items-center justify-center text-center text-sm text-slate-400">
          {mode === "location"
            ? "Enter coordinates and click Get fire risk."
            : "Upload a dataset and run risk to see results."}
        </section>
      )}
    </div>
  );
}
