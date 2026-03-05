from __future__ import annotations


def _sample_csv() -> bytes:
    return (
        "timestamp,temperature,humidity,wind_speed\n"
        "2026-01-01T00:00:00+00:00,10,70,4\n"
        "2026-01-01T01:00:00+00:00,14,65,6\n"
        "2026-01-01T02:00:00+00:00,20,55,7\n"
    ).encode("utf-8")


def test_dataset_upload_and_risk_run(client) -> None:
    upload_response = client.post(
        "/datasets",
        files={"file": ("weather.csv", _sample_csv(), "text/csv")},
    )
    assert upload_response.status_code == 201
    dataset_data = upload_response.json()
    assert dataset_data["row_count"] == 3
    assert dataset_data["dataset_id"]

    run_response = client.post(
        "/risk",
        json={"dataset_id": dataset_data["dataset_id"], "params": {"weights": {"temperature": 0.5, "humidity": 0.3, "wind_speed": 0.2}}},
    )
    assert run_response.status_code == 200
    run_data = run_response.json()
    assert run_data["dataset_id"] == dataset_data["dataset_id"]
    assert 0.0 <= run_data["risk_score"] <= 1.0
    assert run_data["risk_level"] in {"low", "medium", "high"}
    assert run_data["run_id"] > 0

    list_runs = client.get("/runs")
    assert list_runs.status_code == 200
    assert len(list_runs.json()) == 1

    run_details = client.get(f"/runs/{run_data['run_id']}")
    assert run_details.status_code == 200
    assert run_details.json()["run_id"] == run_data["run_id"]

    datasets = client.get("/datasets")
    assert datasets.status_code == 200
    assert len(datasets.json()) == 1


def test_risk_multipart_upload_creates_dataset_and_run(client) -> None:
    response = client.post(
        "/risk",
        files={"file": ("inline.csv", _sample_csv(), "text/csv")},
        data={"params": '{"weights":{"temperature":0.4,"humidity":0.4,"wind_speed":0.2}}'},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"]
    assert data["run_id"] > 0
    assert 0.0 <= data["risk_score"] <= 1.0

