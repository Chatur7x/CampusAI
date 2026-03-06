# =============================================================
# 10. AI Audit & Logging
#     (ai-server/models/audit_logger.py)
# =============================================================
"""
Subsystem 10: AI Audit & Logging

Every AI decision is logged for security audits and compliance.

Logged Data:
  - Similarity score
  - Liveness result
  - Device fingerprint
  - Location
  - Confidence score
  - Fraud flags
  - Timestamp
  - Student/user ID

Storage:
  - JSON log files (rotated daily)
  - In-memory recent buffer for dashboard

Advanced Features:
  ✔ Security audit trail
  ✔ Decision replay
  ✔ Anomaly pattern search
  ✔ Compliance reporting
"""
from __future__ import annotations

import json, logging, os, time
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from config import AUDIT_LOG_DIR, AUDIT_LOG_ENABLED

logger = logging.getLogger("campusai.audit")

# ── In-memory buffer ─────────────────────────────────────────
_recent_logs: deque = deque(maxlen=1000)
_stats = {
    "total_decisions": 0,
    "approved": 0,
    "rejected": 0,
    "flagged": 0,
    "fraud_detected": 0,
}


def _ensure_log_dir():
    if not os.path.exists(AUDIT_LOG_DIR):
        os.makedirs(AUDIT_LOG_DIR, exist_ok=True)


def _log_file_path() -> str:
    """Daily rotated log file."""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return os.path.join(AUDIT_LOG_DIR, f"audit_{date_str}.jsonl")


# ── Public API ───────────────────────────────────────────────

def log_ai_decision(
    decision_type: str,
    student_id: Optional[str] = None,
    user_id: Optional[str] = None,
    result: Optional[dict] = None,
    similarity_score: Optional[float] = None,
    liveness_result: Optional[dict] = None,
    confidence_score: Optional[float] = None,
    fraud_flags: Optional[list[str]] = None,
    device_fingerprint: Optional[str] = None,
    ip_address: Optional[str] = None,
    location: Optional[dict] = None,
    approved: bool = False,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Log an AI decision for audit trail.

    decision_type: FACE_VERIFY, FACE_IDENTIFY, LIVENESS_CHECK, ATTENDANCE_MARK, RISK_PREDICT, etc.
    """
    if not AUDIT_LOG_ENABLED:
        return {"logged": False, "reason": "audit disabled"}

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "epoch": time.time(),
        "decision_type": decision_type,
        "student_id": student_id,
        "user_id": user_id,
        "similarity_score": similarity_score,
        "liveness": {
            "is_live": liveness_result.get("is_live") if liveness_result else None,
            "score": liveness_result.get("liveness_score") if liveness_result else None,
            "spoof_flags": liveness_result.get("spoof_flags", []) if liveness_result else [],
        } if liveness_result else None,
        "confidence_score": confidence_score,
        "fraud_flags": fraud_flags or [],
        "device_fingerprint": device_fingerprint,
        "ip_address": ip_address,
        "location": location,
        "approved": approved,
        "result_summary": _summarize_result(result) if result else None,
        "metadata": metadata,
    }

    # Update stats
    _stats["total_decisions"] += 1
    if approved:
        _stats["approved"] += 1
    else:
        _stats["rejected"] += 1
    if fraud_flags:
        _stats["flagged"] += 1
        if any(f in ("GPS_SPOOF", "PROXY_ATTENDANCE", "DEEPFAKE_SUSPECTED") for f in fraud_flags):
            _stats["fraud_detected"] += 1

    # Store in memory
    _recent_logs.append(entry)

    # Write to file
    try:
        _ensure_log_dir()
        with open(_log_file_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, default=str) + "\n")
    except Exception as e:
        logger.warning(f"Audit log write failed: {e}")

    return {"logged": True, "decision_id": f"d_{int(entry['epoch'] * 1000)}"}


def _summarize_result(result: dict) -> dict:
    """Extract key fields from a result dict for the audit log."""
    summary = {}
    for key in ("match", "identified", "is_live", "score", "category", "risk_score", "fraud_score"):
        if key in result:
            summary[key] = result[key]
    return summary


# ── Query API ────────────────────────────────────────────────

def get_recent_logs(limit: int = 50, decision_type: Optional[str] = None) -> list[dict]:
    """Get recent audit logs from memory buffer."""
    logs = list(_recent_logs)
    if decision_type:
        logs = [l for l in logs if l.get("decision_type") == decision_type]
    return logs[-limit:]


def get_audit_stats() -> dict:
    """Get aggregate audit statistics."""
    return {
        **_stats,
        "approval_rate": round(_stats["approved"] / max(_stats["total_decisions"], 1) * 100, 1),
        "fraud_rate": round(_stats["fraud_detected"] / max(_stats["total_decisions"], 1) * 100, 1),
        "recent_log_count": len(_recent_logs),
    }


def get_student_audit_trail(student_id: str, limit: int = 20) -> list[dict]:
    """Get audit trail for a specific student."""
    return [l for l in _recent_logs if l.get("student_id") == student_id][-limit:]


def search_audit_logs(
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    fraud_only: bool = False,
    rejected_only: bool = False,
) -> list[dict]:
    """Search audit logs with filters."""
    results = list(_recent_logs)
    if start_time:
        results = [l for l in results if l.get("epoch", 0) >= start_time]
    if end_time:
        results = [l for l in results if l.get("epoch", 0) <= end_time]
    if fraud_only:
        results = [l for l in results if l.get("fraud_flags")]
    if rejected_only:
        results = [l for l in results if not l.get("approved")]
    return results


def generate_compliance_report() -> dict:
    """Generate a compliance report from audit data."""
    logs = list(_recent_logs)
    if not logs:
        return {"error": "No audit data available"}

    total = len(logs)
    fraud_count = sum(1 for l in logs if l.get("fraud_flags"))
    rejected_count = sum(1 for l in logs if not l.get("approved"))
    avg_confidence = 0.0
    confidence_values = [l.get("confidence_score") for l in logs if l.get("confidence_score") is not None]
    if confidence_values:
        avg_confidence = sum(confidence_values) / len(confidence_values)

    return {
        "report_generated": datetime.now(timezone.utc).isoformat(),
        "total_decisions": total,
        "approved": total - rejected_count,
        "rejected": rejected_count,
        "fraud_flagged": fraud_count,
        "avg_confidence_score": round(avg_confidence, 4),
        "decision_types": _count_by_field(logs, "decision_type"),
        "top_fraud_flags": _count_fraud_flags(logs),
    }


def _count_by_field(logs: list[dict], field: str) -> dict:
    counts: dict[str, int] = {}
    for l in logs:
        val = l.get(field, "unknown")
        counts[val] = counts.get(val, 0) + 1
    return counts


def _count_fraud_flags(logs: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for l in logs:
        for flag in l.get("fraud_flags", []):
            counts[flag] = counts.get(flag, 0) + 1
    return counts
