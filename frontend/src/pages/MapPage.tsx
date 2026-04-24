import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

import {
  API_BASE_URL,
  listRuns,
  listWatchlist,
  runRiskFromLocation,
  type RunRecord,
  type WatchlistRecord,
} from "../api/client";
import { WatchlistGrid } from "../components/WatchlistGrid";

type ClickPoint = { lat: number; lon: number } | null;

const WORLD_CENTER: [number, number] = [18, 8];
const WORLD_ZOOM = 2;

function cityKey(city: WatchlistRecord): string {
  return `${city.name}:${city.lat.toFixed(4)}:${city.lon.toFixed(4)}`;
}

function fireIcon(level: RunRecord["risk_level"], scheduled: boolean): L.DivIcon {
  const fill = level === "low" ? "#10b981" : level === "medium" ? "#f59e0b" : "#e11d48";
  const ring = scheduled ? "stroke-dasharray: 3 3;" : "";
  const html = `
    <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#fff7ed" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${fill}" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <path d="M14 2 C 6 10, 2 16, 2 22 a12 12 0 0 0 24 0 C 26 16, 22 10, 14 2 Z"
        fill="url(#g)" stroke="${fill}" stroke-width="1.5" style="${ring}"/>
      <circle cx="14" cy="20" r="3.5" fill="#fff" opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html,
    className: "fireguard-marker",
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -28],
  });
}

function ClickCapture({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function RunPopup({ run }: { run: RunRecord }) {
  return (
    <div className="min-w-[180px] space-y-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">Run #{run.run_id}</span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
            (run.risk_level === "low"
              ? "bg-emerald-100 text-emerald-700"
              : run.risk_level === "medium"
                ? "bg-amber-100 text-amber-700"
                : "bg-rose-100 text-rose-700")
          }
        >
          {run.risk_level}
        </span>
      </div>
      <div className="font-mono text-slate-600">
        {run.lat?.toFixed(3)}, {run.lon?.toFixed(3)}
      </div>
      <div className="text-slate-700">
        Score <span className="font-mono">{run.risk_score.toFixed(3)}</span>
      </div>
      {run.explain?.min_ttf_hours != null && (
        <div className="text-slate-700">
          min TTF <span className="font-mono">{run.explain.min_ttf_hours.toFixed(1)}h</span>
        </div>
      )}
      <div className="text-[10px] text-slate-500">
        {run.source === "scheduled" ? "watchlist scheduler" : "manual"} · {new Date(run.created_at).toLocaleString()}
      </div>
    </div>
  );
}

export function MapPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([]);
  const [pending, setPending] = useState<ClickPoint>(null);
  const [busy, setBusy] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCityKey, setBusyCityKey] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  async function loadAll(showSpinner = false) {
    if (showSpinner) setWatchlistLoading(true);
    const [nextRuns, nextWatchlist] = await Promise.all([listRuns(), listWatchlist()]);
    setRuns(nextRuns.filter((run) => run.lat != null && run.lon != null));
    setWatchlist(nextWatchlist);
    if (showSpinner) setWatchlistLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    loadAll(true)
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setWatchlistLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/events`);
    esRef.current = es;
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event === "run_created") {
          loadAll().catch(() => {
            // Keep the current state if a background refresh fails.
          });
        }
      } catch {
        // Ignore malformed payloads and keep the stream alive.
      }
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  async function confirmRun() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      await runRiskFromLocation(pending.lat, pending.lon);
      await loadAll();
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run risk");
    } finally {
      setBusy(false);
    }
  }

  async function recalculateCity(city: WatchlistRecord) {
    setBusyCityKey(cityKey(city));
    setError("");
    try {
      await runRiskFromLocation(city.lat, city.lon);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh city");
    } finally {
      setBusyCityKey(null);
    }
  }

  const scheduledCount = runs.filter((run) => run.source === "scheduled").length;
  const manualCount = runs.filter((run) => run.source !== "scheduled").length;

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400/70">Live map</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Global Fire Risk Map</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Click anywhere in the world to request a fresh location run. Dashed markers are watchlist scheduler snapshots; solid markers are your manual analyses.
          </p>
        </div>
        <div className="panel">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Markers on map</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-2xl font-bold text-white">{scheduledCount}</p>
              <p className="text-xs text-slate-500">scheduled</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-2xl font-bold text-white">{manualCount}</p>
              <p className="text-xs text-slate-500">manual</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> low
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-500" /> medium
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-rose-500" /> high
            </span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
            {runs.length} visible location runs
          </span>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]" style={{ height: "600px" }}>
          <MapContainer
            center={WORLD_CENTER}
            zoom={WORLD_ZOOM}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickCapture onClick={(lat, lon) => setPending({ lat, lon })} />

            {runs.map((run) => (
              <Marker
                key={run.run_id}
                position={[run.lat as number, run.lon as number]}
                icon={fireIcon(run.risk_level, run.source === "scheduled")}
              >
                <Popup>
                  <RunPopup run={run} />
                </Popup>
              </Marker>
            ))}

            {pending && (
              <Marker position={[pending.lat, pending.lon]} icon={fireIcon("medium", false)}>
                <Popup>
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-slate-900">Run risk here?</div>
                    <div className="font-mono text-slate-600">
                      {pending.lat.toFixed(3)}, {pending.lon.toFixed(3)}
                    </div>
                    <div className="flex gap-2">
                      <button className="button px-3 py-1 text-[11px]" onClick={confirmRun} disabled={busy}>
                        {busy ? "Running..." : "Run"}
                      </button>
                      <button className="button-ghost px-3 py-1 text-[11px]" onClick={() => setPending(null)} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </section>

      <WatchlistGrid
        cities={watchlist}
        loading={watchlistLoading}
        error=""
        eyebrow="Tracked cities"
        title="World city watchlist"
        subtitle="These cards mirror the city markers the scheduler keeps alive. Recalculate a card to push a fresh result into the map and the global watchlist."
        compact
        onRecalculate={recalculateCity}
        busyCityKey={busyCityKey}
      />
    </div>
  );
}
