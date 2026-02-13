"""Minimal Sprint 1 demonstrator for FireGuard."""


def calculate_risk_indicator(temperature_c: float, humidity_pct: float) -> float:
    """Return a simple bounded risk indicator in [0.0, 1.0]."""
    raw = (temperature_c / 50.0) * (1.0 - humidity_pct / 100.0)
    return max(0.0, min(1.0, raw))


def demo() -> None:
    indicator = calculate_risk_indicator(25.0, 40.0)
    print(f"Sample risk indicator: {indicator:.2f}")


if __name__ == "__main__":
    demo()
