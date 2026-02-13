import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fireguard.api import app


class ApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_risk_endpoint(self) -> None:
        payload = {"temperature": 25.0, "humidity": 40.0}
        response = self.client.post("/risk", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("risk_indicator", data)
        self.assertGreaterEqual(data["risk_indicator"], 0.0)
        self.assertLessEqual(data["risk_indicator"], 1.0)
        self.assertAlmostEqual(data["risk_indicator"], 0.30, places=6)

    def test_risk_validation(self) -> None:
        payload = {"temperature": 20.0, "humidity": 120.0}
        response = self.client.post("/risk", json=payload)
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()

