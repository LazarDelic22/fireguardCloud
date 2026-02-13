import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fireguard.frcm_adapter import parse_frcm_output, run_frcm_baseline


class FrcmAdapterTest(unittest.TestCase):
    def test_missing_csv_raises_file_not_found(self) -> None:
        with self.assertRaises(FileNotFoundError):
            run_frcm_baseline("missing_input_file.csv")

    def test_parse_frcm_output(self) -> None:
        sample_output = (
            "Computing FireRisk for given data in 'demo.csv' (2 datapoints)\n\n"
            "timestamp,ttf\n"
            "2026-01-07T00:00:00+00:00,6.07\n"
            "2026-01-07T01:00:00+00:00,5.72\n"
        )
        rows = parse_frcm_output(sample_output)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["timestamp"], "2026-01-07T00:00:00+00:00")
        self.assertAlmostEqual(rows[0]["ttf"], 6.07, places=2)


if __name__ == "__main__":
    unittest.main()

