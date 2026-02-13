import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fireguard.main import calculate_risk_indicator


class RiskIndicatorTest(unittest.TestCase):
    def test_value_is_always_in_range(self) -> None:
        samples = [
            (0.0, 0.0),
            (25.0, 40.0),
            (60.0, 20.0),
            (-10.0, 50.0),
            (100.0, 110.0),
        ]
        for temperature, humidity in samples:
            value = calculate_risk_indicator(temperature, humidity)
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 1.0)

    def test_output_is_deterministic(self) -> None:
        first = calculate_risk_indicator(18.5, 67.0)
        second = calculate_risk_indicator(18.5, 67.0)
        self.assertEqual(first, second)

    def test_known_inputs(self) -> None:
        self.assertAlmostEqual(calculate_risk_indicator(25.0, 40.0), 0.30, places=6)
        self.assertAlmostEqual(calculate_risk_indicator(50.0, 0.0), 1.00, places=6)
        self.assertAlmostEqual(calculate_risk_indicator(0.0, 55.0), 0.00, places=6)


if __name__ == "__main__":
    unittest.main()

