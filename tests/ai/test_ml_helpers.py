"""Unit tests for the pure ML/statistics helpers in ``ai-server/models``.

These functions carry the grading, forecasting, fraud and risk decisions but had
no direct tests: only the auth gate and the rate limiter were covered. They are
all deterministic and side-effect free (or guarded behind module globals), so
they are exercised directly rather than through HTTP.

Edge cases covered per helper: empty input, single data point, ``None``/NaN
handling, extreme values, constant (zero-variance) series, and one happy path.

The bugs this suite originally surfaced (missing module-scope ``math``/``scipy``
imports, the PCA/KMeans space mismatch, lexicographic severity ``max()`` and
the unguarded NaN regression paths) are fixed at source and now asserted as
normal passing tests.

Run:  pytest tests/ai/test_ml_helpers.py
"""
from __future__ import annotations

import math
import time

import numpy as np
import pytest

import models.behavior_profiling as bp
import models.confidence as conf
import models.fraud_detection as fd
import models.geo_validation as geo
import models.monitoring as mon
import models.performance_analysis as pa
import models.risk_prediction as rp
from models.trend_prediction import (
    _classify_trend,
    _filter_outliers,
    arima_trend,
    compare_methods,
    linear_trend,
    moving_average_trend,
    predict_trend,
    prophet_trend,
    suggest_intervention,
)


# ── predict_grade ─────────────────────────────────────────────


class TestPredictGrade:
    def test_happy_path_positive_correlation(self):
        """More attendance maps to a higher predicted grade."""
        attendances = [50, 60, 70, 80, 90]
        grades = [45, 55, 65, 75, 85]

        result = pa.predict_grade(75, attendances, grades)

        assert result["predicted_grade"] == pytest.approx(70.0)
        assert result["model"]["slope"] == pytest.approx(1.0)
        assert result["model"]["r_squared"] == pytest.approx(1.0)
        assert result["input_attendance"] == 75
        lower = result["confidence_interval"]["lower"]
        upper = result["confidence_interval"]["upper"]
        assert lower <= result["predicted_grade"] <= upper

    @pytest.mark.parametrize("attendance", [0.0, 100.0, -50.0, 1e9])
    def test_prediction_is_clamped_to_0_100(self, attendance):
        """Out-of-band query points clamp instead of escaping the grade scale."""
        result = pa.predict_grade(attendance, [10, 20, 30], [50, 60, 70])
        assert 0.0 <= result["predicted_grade"] <= 100.0
        assert 0.0 <= result["confidence_interval"]["lower"] <= 100.0
        assert 0.0 <= result["confidence_interval"]["upper"] <= 100.0

    def test_empty_history_is_rejected(self):
        result = pa.predict_grade(80, [], [])
        assert "error" in result
        assert (
            result["error"]
            == "Need at least 3 finite paired data points for prediction"
        )

    def test_single_data_point_is_rejected(self):
        result = pa.predict_grade(80, [70], [60])
        assert "error" in result

    def test_mismatched_lengths_are_rejected(self):
        result = pa.predict_grade(80, [70, 80, 90], [60, 65])
        assert "error" in result

    def test_none_history_is_rejected_not_raised(self):
        result = pa.predict_grade(80, None, None)
        assert "error" in result

    @pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
    def test_non_finite_attendance_is_rejected(self, bad):
        assert "error" in pa.predict_grade(bad, [70, 80, 90], [60, 70, 80])

    @pytest.mark.parametrize("bad", [float("nan"), float("inf")])
    def test_non_finite_history_is_rejected(self, bad):
        result = pa.predict_grade(80, [70, bad, 90], [60, 70, 80])
        assert "error" in result

    def test_numeric_strings_in_history_are_coerced(self):
        # y = x - 10, so 80% attendance projects to 70.
        result = pa.predict_grade(80, ["70", "80", "90"], ["60", "70", "80"])
        assert result["predicted_grade"] == pytest.approx(70.0)

    def test_constant_history_does_not_produce_nan(self):
        result = pa.predict_grade(50, [70, 70, 70], [60, 60, 60])
        assert not math.isnan(result["model"]["slope"])
        assert result["predicted_grade"] < 100.0


# ── predict_performance_v4 ─────────────────────────────────────


class TestPredictPerformanceV4:
    def test_falls_back_to_predict_grade_below_five_points(self):
        result = pa.predict_performance_v4(80, [70, 80, 90], [60, 70, 80])
        assert result["model"]["slope"] == pytest.approx(1.0)

    def test_happy_path_returns_projection_and_range(self):
        attendances = [50, 60, 70, 80, 90]
        grades = [45, 55, 65, 75, 85]

        result = pa.predict_performance_v4(70, attendances, grades)

        assert result["method"] == "probabilistic_projection_v4"
        # y = x - 5, so 70% attendance projects to 65.
        assert result["projected_grade"] == pytest.approx(65.0)
        assert result["r_squared"] == pytest.approx(1.0)
        low, high = result["range"]
        assert 0.0 <= low <= high <= 100.0
        assert result["stability"] in ("stable", "volatile")

    def test_unpaired_history_with_five_entries_is_not_guarded(self):
        """Unlike predict_grade, this path never validates pairing."""
        with pytest.raises(ValueError):
            pa.predict_performance_v4(70, [1, 2, 3, 4, 5], [1, 2])

    def test_constant_history_does_not_produce_nan(self):
        result = pa.predict_performance_v4(50, [70] * 5, [60] * 5)
        assert not math.isnan(result["projected_grade"])


# ── correlations ───────────────────────────────────────────────


class TestCorrelations:
    def test_pearson_happy_path(self):
        result = pa.pearson_correlation([50, 60, 70, 80, 90], [45, 55, 65, 75, 85])
        assert result["r"] == pytest.approx(1.0)
        assert result["strength"] == "strong"
        assert result["direction"] == "positive"
        assert bool(result["significant"]) is True
        assert result["method"] == "pearson"

    def test_spearman_happy_path_ranks_not_magnitudes(self):
        result = pa.spearman_correlation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])
        assert result["rho"] == pytest.approx(1.0)
        assert result["method"] == "spearman"

    @pytest.mark.parametrize("fn", [pa.pearson_correlation, pa.spearman_correlation])
    @pytest.mark.parametrize("x, y", [([], []), ([1], [2]), ([1, 2, 3], [1, 2])])
    def test_too_few_or_unpaired_points_return_an_error(self, fn, x, y):
        assert fn(x, y) == {"error": "Need ≥ 3 paired data points"}

    def test_batch_correlation_labels_subjects_and_defaults_name(self):
        results = pa.batch_correlation(
            [
                {"name": "Maths", "attendances": [1, 2, 3], "grades": [1, 2, 3]},
                {"attendances": [1, 2, 3], "grades": [3, 2, 1]},
            ]
        )
        assert [r["subject"] for r in results] == ["Maths", "Unknown"]
        assert results[0]["pearson"]["r"] == pytest.approx(1.0)
        assert results[1]["pearson"]["r"] == pytest.approx(-1.0)

    def test_batch_correlation_on_empty_input_is_empty(self):
        assert pa.batch_correlation([]) == []

    def test_constant_series_reports_an_error_not_nan(self):
        result = pa.pearson_correlation([50, 50, 50], [1, 2, 3])
        assert "error" in result


# ── detect_performance_risk ────────────────────────────────────


class TestDetectPerformanceRisk:
    def test_healthy_student_is_low_risk(self):
        result = pa.detect_performance_risk(
            attendance_pct=95,
            current_grade=88,
            historical_attendances=[70, 80, 85, 90, 95],
            historical_grades=[70, 78, 82, 86, 90],
        )
        assert result["at_risk"] is False
        assert result["severity"] == "LOW"
        assert result["recommendation"] == "Continue monitoring"

    def test_low_attendance_is_critical(self):
        result = pa.detect_performance_risk(40, 80, [], [])
        assert result["at_risk"] is True
        assert result["severity"] == "CRITICAL"
        assert "CRITICAL: Attendance below 60%" in result["risk_factors"]

    def test_mid_attendance_is_high(self):
        result = pa.detect_performance_risk(70, 80, [], [])
        assert result["severity"] == "HIGH"
        assert result["recommendation"] == "Faculty follow-up recommended"

    def test_long_absence_streak_escalates(self):
        assert (
            pa.detect_performance_risk(95, 90, [], [], absence_streak=6)["severity"]
            == "CRITICAL"
        )
        assert (
            pa.detect_performance_risk(95, 90, [], [], absence_streak=3)["severity"]
            == "HIGH"
        )
        assert (
            pa.detect_performance_risk(95, 90, [], [], absence_streak=2)["severity"]
            == "LOW"
        )

    @pytest.mark.parametrize("bad", [None, "not-a-number", object()])
    def test_garbage_streak_falls_back_to_zero(self, bad):
        result = pa.detect_performance_risk(95, 90, [], [], absence_streak=bad)
        assert result["severity"] == "LOW"

    def test_failing_current_grade_is_critical(self):
        result = pa.detect_performance_risk(95, 30, [], [])
        assert result["severity"] == "CRITICAL"
        assert "Current grade below passing threshold" in result["risk_factors"]

    def test_echoes_inputs(self):
        result = pa.detect_performance_risk(88.5, 77.0, [], [])
        assert result["attendance_pct"] == 88.5
        assert result["current_grade"] == 77.0

    def test_near_failing_prediction_escalates_severity(self):
        result = pa.detect_performance_risk(
            attendance_pct=90,
            current_grade=70,
            historical_attendances=[60, 70, 80, 90, 95],
            historical_grades=[50, 55, 58, 59, 60],
        )
        assert result["severity"] in ("HIGH", "CRITICAL")
        assert result["at_risk"] is True


# ── trend helpers ──────────────────────────────────────────────


class TestLinearTrend:
    def test_happy_path_improving_series(self):
        result = linear_trend([40, 50, 60, 70], forecast_weeks=2)
        assert result["method"] == "linear_regression"
        assert result["slope"] == pytest.approx(10.0)
        assert result["r_squared"] == pytest.approx(1.0)
        assert result["trend"] == "improving"
        assert result["predictions"] == [80.0, 90.0]

    def test_single_point_is_an_error(self):
        result = linear_trend([50])
        assert result["error"] == "Need ≥2 data points"
        assert result["predictions"] == []

    def test_empty_input_is_an_error(self):
        assert "error" in linear_trend([])

    def test_constant_series_has_zero_slope_and_no_r_squared(self):
        result = linear_trend([50, 50, 50], forecast_weeks=3)
        assert result["slope"] == 0.0
        assert result["r_squared"] == 0.0
        assert result["trend"] == "stable"
        assert result["predictions"] == [50.0, 50.0, 50.0]

    def test_declining_series(self):
        assert linear_trend([80, 70, 60, 50])["trend"] == "declining"

    def test_predictions_are_clamped(self):
        result = linear_trend([10, 20, 30, 40], forecast_weeks=40)
        assert all(0.0 <= p <= 100.0 for p in result["predictions"])

    def test_zero_forecast_weeks_is_empty_not_an_error(self):
        assert linear_trend([50, 60, 70], forecast_weeks=0)["predictions"] == []


class TestClassifyTrend:
    def test_upward_shift_is_improving(self):
        assert _classify_trend([50, 50, 50, 50], [60, 60, 60, 60]) == "improving"

    def test_downward_shift_is_declining(self):
        assert _classify_trend([80, 80, 80, 80], [60, 60, 60, 60]) == "declining"

    def test_small_shift_is_stable(self):
        assert _classify_trend([80, 80, 80, 80], [79, 79, 79, 79]) == "stable"

    def test_empty_inputs_do_not_raise(self):
        assert _classify_trend([], []) == "stable"


class TestFilterOutliers:
    def test_spike_is_clipped_toward_the_quartiles(self):
        filtered = _filter_outliers(np.array([50.0, 60, 55, 70, 999, 65, 60, 58]))
        assert filtered.max() < 999
        assert filtered.min() >= 50.0

    def test_clean_series_is_unchanged(self):
        series = np.array([10.0, 20, 30, 40, 50])
        assert np.array_equal(_filter_outliers(series), series)

    def test_short_series_is_returned_as_is(self):
        """Fewer than 4 points has no meaningful IQR, so it passes through."""
        series = np.array([1.0, 999.0])
        assert np.array_equal(_filter_outliers(series), series)


class TestMovingAverageTrend:
    def test_happy_path_smooths_and_extrapolates(self):
        result = moving_average_trend(
            [40, 45, 50, 55, 60], forecast_weeks=2, window=3
        )
        assert result["method"] == "moving_average"
        assert result["window"] == 3
        assert result["momentum"] > 0
        assert len(result["predictions"]) == 2
        assert all(0.0 <= p <= 100.0 for p in result["predictions"])

    def test_constant_series_has_zero_momentum(self):
        result = moving_average_trend([50] * 8)
        assert result["momentum"] == 0.0
        assert result["last_sma"] == 50.0
        assert result["last_ema"] == 50.0
        assert result["trend"] == "stable"

    def test_window_longer_than_series_falls_back_to_linear(self):
        result = moving_average_trend([1, 2, 3], forecast_weeks=2, window=5)
        assert result["method"] == "linear_regression"

    def test_empty_input_degrades_to_the_linear_error(self):
        assert moving_average_trend([]) == {
            "error": "Need ≥2 data points",
            "predictions": [],
        }

    def test_single_point_degrades_to_the_linear_error(self):
        assert moving_average_trend([50])["error"] == "Need ≥2 data points"


class TestCompareMethods:
    def test_happy_path_blends_an_ensemble(self):
        result = compare_methods([40, 50, 60, 70, 80], forecast_weeks=3)

        assert "linear" in result
        assert "moving_average" in result
        assert result["ensemble"]["method"] == "weighted_ensemble_v4"
        assert len(result["ensemble"]["predictions"]) == 3
        scores = result["ensemble"]["confidence_scores"]
        assert set(scores) >= {"linear", "moving_average"}
        assert all(v > 0 for v in scores.values())

    @pytest.mark.parametrize("rates", [[], None, [50], [None, None]])
    def test_too_few_points_is_an_error(self, rates):
        assert compare_methods(rates)["error"].startswith("Need at least 2")

    @pytest.mark.parametrize("weeks, expected", [(0, 1), (-5, 1), (999, 26)])
    def test_forecast_weeks_is_clamped(self, weeks, expected):
        result = compare_methods([40, 50, 60, 70, 80], forecast_weeks=weeks)
        assert len(result["ensemble"]["predictions"]) == expected

    def test_longer_series_adds_arima(self):
        result = compare_methods([50, 55, 60, 58, 62, 65, 61, 70])
        assert "arima" in result

    def test_arima_falls_back_to_linear_when_statsmodels_is_missing(self):
        """The <8-point guard keeps this deterministic and library-free."""
        assert arima_trend([50, 60, 55])["method"] == "linear_regression"

    def test_prophet_falls_back_below_ten_points(self):
        assert prophet_trend([50, 60, 55, 65])["method"] == "linear_regression"

    def test_outlier_spike_does_not_poison_the_ensemble(self):
        clean = compare_methods([40, 50, 60, 70, 80], forecast_weeks=2)
        spiked = compare_methods([40, 50, 60, 70, 999], forecast_weeks=2)
        clean_pred = clean["ensemble"]["predictions"][-1]
        spiked_pred = spiked["ensemble"]["predictions"][-1]
        assert abs(clean_pred - spiked_pred) < 40.0

    def test_none_entries_do_not_raise(self):
        assert "ensemble" in compare_methods([50, None, 60, 70])


class TestSuggestIntervention:
    def test_happy_path_on_track(self):
        result = suggest_intervention([90, 92, 91, 93, 92])
        assert result["severity"] == "LOW"
        assert result["suggestions"] == [
            "Attendance on track — no intervention needed"
        ]

    def test_short_series_is_reported_as_insufficient(self):
        assert suggest_intervention([90, 80])["suggestion"] == (
            "Insufficient data for analysis"
        )

    def test_critical_low_attendance(self):
        result = suggest_intervention([50, 55, 45, 52, 48])
        assert result["severity"] == "CRITICAL"

    def test_detects_recent_drop_from_the_overall_average(self):
        result = suggest_intervention([95, 96, 94, 60, 55])
        assert any("Recent drop" in s for s in result["suggestions"])

    def test_declining_trend_does_not_downgrade_high_severity(self):
        result = suggest_intervention([90, 88, 80, 70, 60, 50])
        assert result["severity"] == "HIGH"


class TestPredictTrendAutoSelect:
    @pytest.mark.parametrize(
        "n_points", [0, 1, 2, 3, 5, 8, 10]
    )
    def test_never_raises_for_any_series_length(self, n_points):
        rates = [50.0 + i for i in range(n_points)]
        result = predict_trend(rates, forecast_weeks=2)
        assert isinstance(result, dict)
        if "error" in result:
            assert result["error"] == "Need ≥2 data points"
        else:
            assert all(0.0 <= p <= 100.0 for p in result["predictions"])


# ── risk model ─────────────────────────────────────────────────


class TestRiskHelpers:
    def test_category_boundaries_are_inclusive_at_the_lower_edge(self):
        assert rp._cat(0.0) == "LOW"
        assert rp._cat(0.2499) == "LOW"
        assert rp._cat(0.25) == "MEDIUM"
        assert rp._cat(0.4999) == "MEDIUM"
        assert rp._cat(0.50) == "HIGH"
        assert rp._cat(0.7499) == "HIGH"
        assert rp._cat(0.75) == "CRITICAL"
        assert rp._cat(1.0) == "CRITICAL"

    def test_feature_extraction_uses_documented_defaults(self):
        assert rp._extract_features({}).tolist() == [[75.0, 0.0, 0.0, 0.0, 0.0]]

    def test_behavioural_shift_is_current_minus_historical_average(self):
        features = rp._extract_features(
            {"attendance_pct": 40, "historical_avg": 90}
        )
        assert features[0][4] == pytest.approx(-50.0)

    def test_heuristic_risk_is_zero_for_a_perfect_record(self):
        result = rp._heuristic_risk(
            {"attendance_pct": 100, "consecutive_absences": 0, "late_count": 0}
        )
        assert result["risk_score"] == 0.0
        assert result["category"] == "LOW"
        assert result["method"] == "heuristic"

    def test_heuristic_risk_saturates_at_one(self):
        result = rp._heuristic_risk(
            {"attendance_pct": 0, "consecutive_absences": 10_000, "late_count": 10_000}
        )
        assert result["risk_score"] == 1.0
        assert result["category"] == "CRITICAL"

    def test_untrained_predictors_fall_back_to_the_heuristic(self):
        for predictor in (
            rp.predict_risk_unsupervised,
            rp.predict_risk_supervised,
            rp.predict_risk_random_forest,
            rp.predict_risk_gradient_boosting,
        ):
            assert predictor({})["method"] == "heuristic"

    def test_untrained_ensemble_falls_back_to_the_heuristic(self):
        assert rp.predict_risk_ensemble({})["method"] == "heuristic"

    def test_untrained_convenience_wrapper_falls_back(self):
        assert rp.predict_risk({})["method"] == "heuristic"

    def test_training_on_no_records_leaves_models_untrained(self, monkeypatch):
        monkeypatch.setattr(rp, "_iso_forest", None, raising=False)
        rp.train_isolation_forest([])
        assert rp._iso_forest is None

    def test_isolation_forest_training_and_prediction(self):
        records = [
            {
                "attendance_pct": float(p),
                "consecutive_absences": abs(100 - p) // 10,
                "late_count": abs(100 - p) // 5,
                "monthly_trend": 0.0,
                "historical_avg": float(p),
            }
            for p in range(0, 101, 2)
        ]
        try:
            rp.train_isolation_forest(records)
            result = rp.predict_risk_unsupervised(
                {"attendance_pct": 10, "consecutive_absences": 9}
            )
            assert result["method"] == "isolation_forest"
            assert 0.0 <= result["risk_score"] <= 1.0
        finally:
            rp._iso_forest = None
            rp._scaler = None

    def test_explain_risk_without_a_trained_model_is_an_error(self):
        assert "error" in rp.explain_risk({})


# ── fraud detection ────────────────────────────────────────────


@pytest.fixture
def clean_fraud_state():
    """Snapshot and restore the module-level tracking maps."""
    devices = dict(fd._device_student_map)
    ips = dict(fd._ip_student_map)
    times = dict(fd._student_attendance_times)
    fd._device_student_map.clear()
    fd._ip_student_map.clear()
    fd._student_attendance_times.clear()
    yield
    fd._device_student_map.clear()
    fd._device_student_map.update(devices)
    fd._ip_student_map.clear()
    fd._ip_student_map.update(ips)
    fd._student_attendance_times.clear()
    fd._student_attendance_times.update(times)


class TestDeviceAndIpTracking:
    def test_two_students_on_one_device_is_proxy_attendance(self, clean_fraud_state):
        fd.track_device("s1", "dev-1", "1.1.1.1")
        fd.track_device("s2", "dev-1", "1.1.1.1")
        result = fd.check_multi_student_device("dev-1")
        assert result["multi_student"] is True
        assert result["student_count"] == 2
        assert result["flag"] == "PROXY_ATTENDANCE"

    def test_same_student_twice_is_not_proxy_attendance(self, clean_fraud_state):
        fd.track_device("s1", "dev-1")
        fd.track_device("s1", "dev-1")
        result = fd.check_multi_student_device("dev-1")
        assert result["multi_student"] is False
        assert result["student_count"] == 1

    def test_unknown_device_is_clean(self, clean_fraud_state):
        assert fd.check_multi_student_device("never-seen")["flag"] is None

    def test_blank_device_and_ip_are_not_tracked(self, clean_fraud_state):
        fd.track_device("s1", "", "")
        assert fd.check_multi_student_device("")["student_count"] == 0
        assert fd.check_ip_anomaly("", "s1")["students_on_ip"] == 0

    def test_ip_anomaly_threshold_is_strictly_above_ten(self, clean_fraud_state):
        for i in range(10):
            fd.track_device(f"s{i}", f"dev-{i}", "9.9.9.9")
        assert fd.check_ip_anomaly("9.9.9.9", "s0")["ip_suspicious"] is False

        fd.track_device("s10", "dev-10", "9.9.9.9")
        result = fd.check_ip_anomaly("9.9.9.9", "s0")
        assert result["ip_suspicious"] is True
        assert result["flag"] == "IP_ANOMALY"
        assert result["students_on_ip"] == 11

    def test_attendance_spike_needs_more_than_three_marks(self, clean_fraud_state):
        for _ in range(3):
            fd.track_device("s1", "dev-1")
        assert fd.check_attendance_spike("s1")["spike_detected"] is False

        fd.track_device("s1", "dev-1")
        result = fd.check_attendance_spike("s1")
        assert result["spike_detected"] is True
        assert result["flag"] == "ATTENDANCE_SPIKE"

    def test_student_with_no_history_has_no_spike(self, clean_fraud_state):
        assert fd.check_attendance_spike("ghost")["marks_in_window"] == 0

    def test_stale_marks_outside_the_window_are_ignored(self, clean_fraud_state):
        fd._student_attendance_times["s1"].extend(
            [time.time() - 7200] * 10
        )
        assert fd.check_attendance_spike("s1")["spike_detected"] is False

    def test_dashboard_counts_reflect_the_tracked_state(self, clean_fraud_state):
        fd.track_device("s1", "shared", "1.1.1.1")
        fd.track_device("s2", "shared", "1.1.1.1")
        dashboard = fd.get_fraud_dashboard()
        assert dashboard["tracked_devices"] == 1
        assert dashboard["multi_student_devices"] == 1
        assert dashboard["students_tracked"] == 2


class TestDetectFraud:
    def test_empty_record_scores_zero(self):
        result = fd.detect_fraud({})
        assert result["fraud_score"] == 0.0
        assert result["is_fraudulent"] is False
        assert result["flags"] == []
        assert result["severity"] == "LOW"

    def test_far_from_campus_is_flagged(self):
        result = fd.detect_fraud({"distance_from_campus": 5000})
        assert "GPS_SPOOF" in result["flags"]
        assert result["components"]["location_anomaly"] == 1.0

    def test_distance_just_under_the_threshold_is_not_flagged(self):
        result = fd.detect_fraud({"distance_from_campus": 499})
        assert "GPS_SPOOF" not in result["flags"]

    def test_unknown_device_is_flagged(self):
        result = fd.detect_fraud(
            {"device_fingerprint": "dev-x", "known_devices": ["dev-y"]}
        )
        assert "DEVICE_MISMATCH" in result["flags"]
        assert result["components"]["device_anomaly"] == 0.6

    def test_known_device_is_not_flagged(self):
        result = fd.detect_fraud(
            {"device_fingerprint": "dev-x", "known_devices": ["dev-x"]}
        )
        assert "DEVICE_MISMATCH" not in result["flags"]

    @pytest.mark.parametrize("hour", [0, 5, 23, -1, 99])
    def test_out_of_hours_is_flagged(self, hour):
        assert "TIME_ANOMALY" in fd.detect_fraud({"hour_of_day": hour})["flags"]

    @pytest.mark.parametrize("hour", [6, 12, 22])
    def test_normal_hours_are_not_flagged(self, hour):
        assert "TIME_ANOMALY" not in fd.detect_fraud({"hour_of_day": hour})["flags"]

    def test_extreme_distance_alone_is_capped_at_a_plausible_score(self):
        """An absurd distance must not saturate the whole composite score."""
        result = fd.detect_fraud({"distance_from_campus": 1e12})
        assert 0.0 <= result["fraud_score"] <= 1.0
        assert result["components"]["location_anomaly"] == 1.0

    def test_components_are_all_reported(self):
        components = fd.detect_fraud({})["components"]
        assert set(components) == {
            "device_anomaly",
            "location_anomaly",
            "similarity_anomaly",
            "behavior_anomaly",
        }

    def test_heuristic_fallback_flags_a_poor_face_match(self):
        result = fd.detect_fraud({"face_similarity": 0.1, "liveness_score": 0.1})
        assert "PATTERN_ANOMALY" in result["flags"]
        assert result["components"]["similarity_anomaly"] == pytest.approx(0.6)
        # 0.2 weight on a 0.6 signal is only 0.12, so it is not fraud yet.
        assert result["fraud_score"] == pytest.approx(0.12)
        assert result["is_fraudulent"] is False


class TestFingerprintHashing:
    def test_fingerprint_is_deterministic(self):
        a = fd.generate_device_fingerprint("UA", "1.2.3.4", "1920x1080")
        b = fd.generate_device_fingerprint("UA", "1.2.3.4", "1920x1080")
        assert a == b
        assert len(a) == 24

    @pytest.mark.parametrize(
        "kwargs",
        [
            {"user_agent": "UA2", "ip": "1.2.3.4", "screen_res": "1920x1080"},
            {"user_agent": "UA", "ip": "1.2.3.5", "screen_res": "1920x1080"},
            {"user_agent": "UA", "ip": "1.2.3.4", "screen_res": "1280x720"},
        ],
    )
    def test_every_component_changes_the_fingerprint(self, kwargs):
        base = fd.generate_device_fingerprint("UA", "1.2.3.4", "1920x1080")
        assert fd.generate_device_fingerprint(**kwargs) != base

    def test_concatenation_ambiguity_is_not_possible_for_the_ua_field(self):
        """Fields are pipe-separated in the salted preimage."""
        a = fd.generate_device_fingerprint("ab", "1.1.1.1", "")
        b = fd.generate_device_fingerprint("a", "b1.1.1.1", "")
        assert a != b

    def test_empty_fingerprint_has_zero_entropy(self):
        assert fd._extract_fingerprint_entropy("") == 0.0

    def test_repeated_hash_has_low_entropy(self):
        assert fd._extract_fingerprint_entropy("a" * 64) == 0.0

    def test_hex_hash_has_high_entropy(self):
        assert fd._extract_fingerprint_entropy("a1b2c3d4e5f60718") > 3.0

    def test_validate_fingerprint_v4_reports_entropy_for_a_real_hash(self):
        fingerprint = fd.generate_device_fingerprint("UA", "1.2.3.4", "1920x1080")
        result = fd.validate_fingerprint_v4(fingerprint)
        assert result["entropy"] > 3.0
        assert result["is_suspicious"] is False
        assert result["flag"] is None


# ── confidence ─────────────────────────────────────────────────


class TestComputeConfidence:
    def test_perfect_signals_are_auto_approved(self):
        result = conf.compute_confidence(1.0, 1.0, 1.0, 1.0)
        assert result.category == "HIGH"
        assert result.score > 0.9
        assert result.auto_approved is True
        assert result.flags == []
        assert result.requires_reverification is False
        assert result.admin_alert is False

    def test_all_zero_signals_are_rejected_and_alert(self):
        result = conf.compute_confidence(0.0, 0.0, 0.0, 0.0)
        assert result.category == "REJECTED"
        assert result.auto_approved is False
        assert result.admin_alert is True
        assert "LOW_FACE_SIMILARITY" in result.flags

    def test_one_bad_pillar_collapses_the_score(self):
        """v4 design: an exponential collapse, not a linear subtraction."""
        good = conf.compute_confidence(0.95, 0.95, 0.95, 0.95).score
        with_impossible_travel = conf.compute_confidence(
            0.95, 0.95, 0.95, 0.95, impossible_travel=True
        ).score
        assert with_impossible_travel < good * 0.5
        assert "IMPOSSIBLE_TRAVEL" in conf.compute_confidence(
            0.95, 0.95, 0.95, 0.95, impossible_travel=True
        ).flags

    @pytest.mark.parametrize(
        "kwarg, flag",
        [
            ({"device_risk": True}, "HIGH_DEVICE_RISK"),
            ({"session_mismatch": True}, "SESSION_CODE_MISMATCH"),
            ({"proxy_location": True}, "PROXY_LOCATION_DETECTION"),
            ({"shared_device": True}, "SHARED_DEVICE_DETECTED"),
        ],
    )
    def test_each_security_flag_is_reported(self, kwarg, flag):
        assert flag in conf.compute_confidence(0.9, 0.9, 0.9, 0.9, **kwarg).flags

    def test_score_is_always_bounded(self):
        for args in [(0, 0, 0, 0), (1, 1, 1, 1), (50, -5, 1e9, 1e9)]:
            score = conf.compute_confidence(*args).score
            assert 0.0 <= score <= 1.0

    def test_degrades_monotonically(self):
        previous = 1.1
        for face in (1.0, 0.8, 0.6, 0.4, 0.2):
            score = conf.compute_confidence(face, 1.0, 1.0, 1.0).score
            assert score <= previous
            previous = score


class TestComputeDeviceTrust:
    def test_known_device_and_ip_is_maximum_trust(self):
        assert conf.compute_device_trust("d1", ["d1"], "1.1.1.1", ["1.1.1.1"]) == 1.0

    def test_no_information_is_the_neutral_default(self):
        assert conf.compute_device_trust() == 0.5

    def test_unknown_device_and_ip_is_penalised(self):
        """0.5 neutral - 0.2 unknown device - 0.1 unknown IP."""
        assert conf.compute_device_trust("d2", ["d1"], "2.2.2.2", ["1.1.1.1"]) == (
            pytest.approx(0.2)
        )

    @pytest.mark.parametrize(
        "score",
        [
            conf.compute_device_trust("d2", ["d1"], "2.2.2.2", ["1.1.1.1"]),
            conf.compute_device_trust("d1", ["d1"], "1.1.1.1", ["1.1.1.1"]),
            conf.compute_device_trust(),
        ],
    )
    def test_stays_within_zero_and_one(self, score):
        assert 0.0 <= score <= 1.0


# ── geo validation ─────────────────────────────────────────────


class TestGeoValidation:
    def test_haversine_of_the_same_point_is_zero(self):
        assert geo.haversine(10.0, 20.0, 10.0, 20.0) == 0.0

    def test_haversine_matches_a_known_distance(self):
        # One degree of latitude is ~111.2 km.
        assert geo.haversine(0.0, 0.0, 1.0, 0.0) == pytest.approx(111_195, rel=1e-3)

    def test_haversine_is_symmetric(self):
        assert geo.haversine(10.0, 20.0, 11.0, 21.0) == pytest.approx(
            geo.haversine(11.0, 21.0, 10.0, 20.0)
        )

    def test_antipodal_points_are_half_the_circumference(self):
        assert geo.haversine(0.0, 0.0, 0.0, 180.0) == pytest.approx(
            math.pi * 6_371_000, rel=1e-6
        )

    def test_on_campus_is_valid_with_full_confidence(self):
        result = geo.validate_location(0.0, 0.0, 0, campus_lat=0.0, campus_lon=0.0)
        assert result["valid"] is True
        assert result["distance_m"] == 0.0
        assert result["geo_accuracy"] == 1.0

    def test_far_away_is_invalid_with_zero_confidence(self):
        result = geo.validate_location(0.0, 0.0, 0, campus_lat=51.5, campus_lon=-0.1)
        assert result["valid"] is False
        assert result["geo_accuracy"] == 0.0

    def test_poor_accuracy_reduces_confidence(self):
        tight = geo.validate_location(0.0, 0.0, 0, campus_lat=0.0, campus_lon=0.0)
        loose = geo.validate_location(0.0, 0.0, 400, campus_lat=0.0, campus_lon=0.0)
        assert loose["geo_accuracy"] < tight["geo_accuracy"]

    def test_geo_accuracy_never_leaves_zero_to_one(self):
        for accuracy in (-5, 0, 50, 500, 100_000):
            result = geo.validate_location(10.0, 20.0, accuracy)
            assert 0.0 <= result["geo_accuracy"] <= 1.0

    def test_no_previous_position_is_not_spoofing(self):
        assert geo.detect_gps_spoof(1.0, 1.0)["spoofing_suspected"] is False

    def test_mock_location_is_flagged(self):
        result = geo.detect_gps_spoof(1.0, 1.0, is_mock=True)
        assert result["spoofing_suspected"] is True
        assert "MOCK_LOCATION" in result["flags"]

    def test_impossible_speed_is_flagged(self):
        result = geo.detect_gps_spoof(20.0, 20.0, 10.0, 10.0, 60)
        assert "IMPOSSIBLE_SPEED" in result["flags"]

    @pytest.mark.parametrize("delta", [0, -10, None])
    def test_zero_or_negative_time_delta_skips_the_speed_check(self, delta):
        assert geo.detect_gps_spoof(20.0, 20.0, 10.0, 10.0, delta)["flags"] == []

    def test_impossible_travel_rejects_an_unparseable_timestamp(self):
        result = geo.check_impossible_travel(20.0, 20.0, 10.0, 10.0, "not-a-date")
        assert result == {"impossible": False, "reason": "invalid_timestamp"}

    def test_a_future_timestamp_is_not_impossible_travel(self):
        result = geo.check_impossible_travel(
            20.0, 20.0, 10.0, 10.0, time.time() + 9999
        )
        assert result["reason"] == "invalid_delta"

    def test_a_short_hop_is_ignored_as_gps_jitter(self):
        result = geo.check_impossible_travel(10.001, 10.0, 10.0, 10.0, time.time() - 60)
        assert result["impossible"] is False

    def test_geo_confidence_is_penalised_for_a_mock_location(self):
        no_flags = {"flags": [], "spoofing_suspected": False}
        clean = geo.get_geo_confidence(
            geo.CAMPUS_LAT, geo.CAMPUS_LON, 0, no_flags
        )
        assert clean == pytest.approx(1.0)

        spoofed = geo.get_geo_confidence(
            geo.CAMPUS_LAT,
            geo.CAMPUS_LON,
            0,
            {"flags": ["MOCK_LOCATION"], "spoofing_suspected": True},
        )
        assert spoofed == pytest.approx(0.5)
        assert spoofed < clean


# ── behaviour profiling ────────────────────────────────────────


def _profile_records(n: int = 12):
    """Three clearly separated behaviour groups so KMeans finds structure."""
    records = []
    for i in range(n // 3):
        j = i % 3
        records.append(
            {
                "attendance_pct": 92.0 + j,
                "absence_streak_max": i % 2,
                "late_pct": 2.0,
                "variance_weekly": 3.0,
            }
        )
        records.append(
            {
                "attendance_pct": 70.0 + j,
                "absence_streak_max": 3 + (i % 2),
                "late_pct": 15.0,
                "variance_weekly": 20.0,
            }
        )
        records.append(
            {
                "attendance_pct": 35.0 + j,
                "absence_streak_max": 12,
                "late_pct": 40.0,
                "variance_weekly": 45.0,
            }
        )
    return records


@pytest.fixture
def clean_profile_state():
    saved = bp._kmeans, bp._scaler, dict(bp._cluster_labels)
    bp._kmeans = None
    bp._scaler = None
    bp._cluster_labels = {}
    yield
    bp._kmeans, bp._scaler = saved[0], saved[1]
    bp._cluster_labels = saved[2]


class TestBehaviourProfiling:
    @pytest.mark.parametrize(
        "pct, expected",
        [
            (95, "Regular"),
            (85, "Regular"),
            (75, "Occasionally absent"),
            (60, "Occasionally absent"),
            (10, "Chronic absentee"),
        ],
    )
    def test_heuristic_profile_thresholds(self, pct, expected):
        assert bp._heuristic_profile({"attendance_pct": pct})["profile"] == expected

    def test_untrained_classifier_uses_the_heuristic(self, clean_profile_state):
        result = bp.classify_student({"attendance_pct": 90})
        assert result["method"] == "heuristic"
        assert result["cluster_id"] == -1
        assert result["confidence"] == 0.5

    def test_too_few_records_is_an_error(self, clean_profile_state):
        result = bp.train_profiles([{"attendance_pct": i} for i in range(4)])
        assert result["error"] == "Need ≥ 5 records for self-optimization"

    def test_training_reports_clusters_and_centres(self, clean_profile_state):
        result = bp.train_profiles(_profile_records())
        assert result["n_clusters"] >= 2
        assert result["silhouette_score"] > -1.0
        assert len(result["centres"]) == result["n_clusters"]
        assert result["total_records"] == len(_profile_records())
        # The best-attending cluster is ranked "Regular".
        best = max(result["centres"], key=lambda c: c["attendance_pct"])
        assert best["cluster"] == "Regular"

    def test_classifier_uses_kmeans_after_training(self, clean_profile_state):
        bp.train_profiles(_profile_records())
        result = bp.classify_student({"attendance_pct": 95, "absence_streak_max": 0})
        assert result["method"] == "kmeans"
        assert result["profile"] in bp.PROFILE_NAMES
        assert 0.0 <= result["confidence"] <= 1.0

    def test_batch_classify_carries_the_student_id(self, clean_profile_state):
        records = [
            {"student_id": "s1", "attendance_pct": 95},
            {"student_id": "s2", "attendance_pct": 30},
        ]
        results = bp.batch_classify(records)
        assert [r["student_id"] for r in results] == ["s1", "s2"]

    def test_batch_classify_on_empty_input_is_empty(self, clean_profile_state):
        assert bp.batch_classify([]) == []


# ── monitoring / drift ─────────────────────────────────────────


class TestDriftMetrics:
    def test_identical_distributions_have_zero_psi(self):
        data = [float(i) for i in range(20)]
        assert mon.psi(data, list(data)) == pytest.approx(0.0, abs=1e-9)

    def test_a_large_shift_raises_psi(self):
        baseline = [float(i) for i in range(20)]
        shifted = [float(i) + 1000 for i in range(20)]
        assert mon.psi(baseline, shifted) > 1.0

    def test_constant_series_do_not_raise(self):
        assert mon.psi([5.0] * 10, [5.0] * 10) == pytest.approx(0.0, abs=1e-9)

    def test_check_data_drift_severity_bands(self):
        baseline = [float(i) for i in range(50)]
        mild = mon.check_data_drift("m", baseline, [float(i) + 2 for i in range(50)])
        severe = mon.check_data_drift(
            "m", baseline, [float(i) + 5000 for i in range(50)]
        )
        assert severe["severity"] == "significant"
        assert severe["drift_detected"] is True
        assert mild["model"] == "m"

    def test_jsd_has_a_module_level_scipy_import(self):
        """Inverted when monitoring.py gained a module-scope `scipy.stats` import.

        jensen_shannon_divergence used to rely on a function-local import in
        check_advanced_drift and raised NameError whenever it was called from
        anywhere else, 500-ing /analytics/drift/advanced for every request.
        """
        assert hasattr(mon, "stats")

    def test_identical_distributions_have_zero_jsd(self):
        p = np.array([0.1, 0.2, 0.3, 0.4])
        assert mon.jensen_shannon_divergence(p, p) == pytest.approx(0.0, abs=1e-9)

    def test_jsd_is_symmetric(self):
        p = np.array([0.1, 0.2, 0.3, 0.4])
        q = np.array([0.4, 0.3, 0.2, 0.1])
        assert mon.jensen_shannon_divergence(p, q) == pytest.approx(
            mon.jensen_shannon_divergence(q, p)
        )

    def test_model_health_is_healthy_without_history(self):
        health = mon.get_model_health("never-trained")
        assert health["total_predictions"] == 0
        assert health["status"] == "healthy"

    def test_all_models_health_handles_no_metrics(self):
        assert mon.get_all_models_health() == []


