"""Quality report aggregation for a plant-local date range.

Pure data (no rendering): the dashboard renders + prints it. Everything is
counted per part (one full inspection grouped by part_inspection_id): a part
with several defects is one inspected part and one NC part. A part is "NC for
PMP" if it has any PMP defect (same for INJECTION).
"""
from collections import Counter
from datetime import date as date_cls, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.constants import CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION
from app.models.defect import InspectionLog, DefectType
from app.models.operator import Operator
from app.schemas.report import (
    QualityReport, ReportDefectRow, ReportOperatorRow, ReportDailyRow,
)

_ISO = "%Y-%m-%dT%H:%M:%SZ"


def _rate(nc: int, total: int) -> float:
    return round(nc / total, 4) if total else 0.0


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.plant_tz)


def build_report(db: Session, date_from: date_cls, date_to: date_cls) -> QualityReport:
    tz = _tz()
    lo = datetime.combine(date_from, time.min, tzinfo=tz).astimezone(timezone.utc).strftime(_ISO)
    hi = datetime.combine(date_to, time.max, tzinfo=tz).astimezone(timezone.utc).strftime(_ISO)

    rows = db.query(
        InspectionLog.id,
        InspectionLog.part_inspection_id,
        InspectionLog.outcome,
        InspectionLog.category_kind,
        InspectionLog.defect_type_id,
        InspectionLog.operator_id,
        InspectionLog.logged_at,
    ).filter(InspectionLog.logged_at >= lo, InspectionLog.logged_at <= hi).all()

    # ── Collapse rows into parts ──────────────────────────────────────────────
    parts: dict[str, dict] = {}
    defect_counts: Counter[int] = Counter()
    for row_id, pid, outcome, cat, dtid, opid, logged in rows:
        key = pid or f"r{row_id}"
        part = parts.get(key)
        if part is None:
            part = {"pmp_nc": False, "inj_nc": False, "operator": opid, "logged": logged}
            parts[key] = part
        if outcome == "DEFECT":
            if cat == CATEGORY_KIND_PMP:
                part["pmp_nc"] = True
            elif cat == CATEGORY_KIND_INJECTION:
                part["inj_nc"] = True
            if dtid is not None:
                defect_counts[dtid] += 1

    total = len(parts)
    nc = sum(1 for p in parts.values() if p["pmp_nc"] or p["inj_nc"])
    pmp_nc = sum(1 for p in parts.values() if p["pmp_nc"])
    inj_nc = sum(1 for p in parts.values() if p["inj_nc"])

    # ── By operator ───────────────────────────────────────────────────────────
    op_parts: Counter[int] = Counter()
    op_nc: Counter[int] = Counter()
    for p in parts.values():
        op = p["operator"]
        op_parts[op] += 1
        if p["pmp_nc"] or p["inj_nc"]:
            op_nc[op] += 1

    # ── Daily trend (plant-local) ─────────────────────────────────────────────
    daily: dict[str, list[int]] = {}
    for p in parts.values():
        d = datetime.fromisoformat(p["logged"].replace("Z", "+00:00")).astimezone(tz).date().isoformat()
        cell = daily.setdefault(d, [0, 0])
        cell[0] += 1
        if p["pmp_nc"] or p["inj_nc"]:
            cell[1] += 1

    # ── Labels / names ────────────────────────────────────────────────────────
    labels = dict(db.query(DefectType.id, DefectType.label).all())
    names = dict(db.query(Operator.id, Operator.name).all())

    top_defects = [
        ReportDefectRow(label=labels.get(did, f"#{did}"), count=cnt)
        for did, cnt in defect_counts.most_common(10)
    ]
    by_operator = sorted(
        (
            ReportOperatorRow(
                operator=names.get(oid, f"#{oid}"),
                parts=op_parts[oid],
                nc_parts=op_nc[oid],
                nc_rate=_rate(op_nc[oid], op_parts[oid]),
            )
            for oid in op_parts
        ),
        key=lambda r: -r.parts,
    )
    daily_rows = [
        ReportDailyRow(date=d, parts=c[0], nc_parts=c[1], nc_rate=_rate(c[1], c[0]))
        for d, c in sorted(daily.items())
    ]

    return QualityReport(
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        generated_at=datetime.now(timezone.utc).strftime(_ISO),
        inspected_parts=total,
        nc_parts=nc,
        ok_parts=total - nc,
        nc_rate=_rate(nc, total),
        pmp_nc_parts=pmp_nc,
        pmp_nc_rate=_rate(pmp_nc, total),
        inj_nc_parts=inj_nc,
        inj_nc_rate=_rate(inj_nc, total),
        defects_total=sum(defect_counts.values()),
        top_defects=top_defects,
        by_operator=by_operator,
        daily=daily_rows,
    )
