"""Snoozed devices persistence service.

A snoozed device (by MAC) is hidden from views and excluded from anomaly
processing until it reconnects. Mirrors the zone_filter persistence pattern.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import delete, select

from app.database import get_session
from app.models import SnoozedDevice, SnoozeInput
from app.models_db import SnoozedDeviceRow
from app.services.metrics import resolve_all_notifications

log = structlog.get_logger()


def get_snoozed() -> list[SnoozedDevice]:
    """Return all snoozed devices, newest first."""
    session = get_session()
    try:
        rows = (
            session.execute(select(SnoozedDeviceRow).order_by(SnoozedDeviceRow.snoozed_at.desc()))
            .scalars()
            .all()
        )
        return [
            SnoozedDevice(mac=r.mac, name=r.name, model=r.model, snoozed_at=r.snoozed_at)
            for r in rows
        ]
    finally:
        session.close()


def get_snoozed_macs() -> set[str]:
    """Return the set of snoozed MACs (lowercased)."""
    session = get_session()
    try:
        macs = session.execute(select(SnoozedDeviceRow.mac)).scalars().all()
        return {m.lower() for m in macs}
    finally:
        session.close()


def snooze_devices(devices: list[SnoozeInput]) -> None:
    """Snooze one or many devices. Already-snoozed devices keep their timestamp."""
    now = datetime.now(UTC).isoformat()
    session = get_session()
    try:
        existing = {m.lower() for m in session.execute(select(SnoozedDeviceRow.mac)).scalars().all()}
        added: list[str] = []
        for device in devices:
            mac = device.mac.lower()
            if mac in existing:
                continue
            session.add(SnoozedDeviceRow(mac=mac, name=device.name, model=device.model, snoozed_at=now))
            existing.add(mac)
            added.append(mac)
        if added:
            session.commit()
            log.info("devices_snoozed", macs=added)
    finally:
        session.close()
    for mac in {d.mac.lower() for d in devices}:
        resolve_all_notifications(mac)


def unsnooze_device(mac: str) -> None:
    """Remove a device from the snoozed set (idempotent)."""
    session = get_session()
    try:
        session.execute(delete(SnoozedDeviceRow).where(SnoozedDeviceRow.mac == mac.lower()))
        session.commit()
        log.info("device_unsnoozed", mac=mac.lower())
    finally:
        session.close()


def reconcile_online(online_macs: set[str]) -> list[str]:
    """Auto-unsnooze any snoozed device that is now online. Returns re-enabled MACs."""
    online = {m.lower() for m in online_macs}
    session = get_session()
    try:
        snoozed = {m.lower() for m in session.execute(select(SnoozedDeviceRow.mac)).scalars().all()}
        to_enable = sorted(snoozed & online)
        if to_enable:
            session.execute(delete(SnoozedDeviceRow).where(SnoozedDeviceRow.mac.in_(to_enable)))
            session.commit()
            log.info("devices_auto_unsnoozed", macs=to_enable)
        return to_enable
    finally:
        session.close()
