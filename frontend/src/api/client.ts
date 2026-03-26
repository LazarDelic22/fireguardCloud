export type TopFactor = {
  column: string;
  contribution: number;
  weight: number;
  normalized_mean: number;
};

export type Explain = {
  record_count: number;
  top_factors: TopFactor[];
  // Present for FRCM location runs
  model?: string;
  min_ttf_hours?: number;
  mean_ttf_hours?: number;
};

export type DatasetRecord = {
  dataset_id: string;
  filename: string;
  sha256: string;
  row_count: number;
  created_at: string;
};

export type RunRecord = {
  run_id: number;
  dataset_id: string | null;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  params: Record<string, unknown>;
  explain: Explain;
  created_at: string;
  lat?: number | null;
  lon?: number | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(`Cannot reach backend at ${API_BASE_URL}. Is the API running on port 8000?`);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function uploadDataset(file: File): Promise<DatasetRecord> {
  const form = new FormData();
  form.append("file", file);
  return request<DatasetRecord>("/datasets", { method: "POST", body: form });
}

export async function runRisk(datasetId: string, params: Record<string, unknown>): Promise<RunRecord> {
  return request<RunRecord>("/risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId, params }),
  });
}

export async function runRiskFromLocation(lat: number, lon: number): Promise<RunRecord> {
  return request<RunRecord>("/risk/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
}

export async function listRuns(): Promise<RunRecord[]> {
  return request<RunRecord[]>("/runs");
}

export async function getRun(runId: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}`);
}
