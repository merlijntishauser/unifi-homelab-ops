"""SQLAlchemy ORM models for persistent application state."""

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AiConfigRow(Base):
    __tablename__ = "ai_config"
    __table_args__ = (CheckConstraint("id = 1", name="singleton_ai_config"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    provider_type: Mapped[str] = mapped_column(String, nullable=False, default="openai")


class AiAnalysisCacheRow(Base):
    __tablename__ = "ai_analysis_cache"

    cache_key: Mapped[str] = mapped_column(Text, primary_key=True)
    zone_pair_key: Mapped[str] = mapped_column(Text, nullable=False)
    findings: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class HiddenZoneRow(Base):
    __tablename__ = "hidden_zones"

    zone_id: Mapped[str] = mapped_column(Text, primary_key=True)


class AiAnalysisSettingsRow(Base):
    __tablename__ = "ai_analysis_settings"
    __table_args__ = (CheckConstraint("id = 1", name="singleton_ai_analysis_settings"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    site_profile: Mapped[str] = mapped_column(Text, nullable=False, default="homelab")


class SiteHealthCacheRow(Base):
    __tablename__ = "site_health_cache"

    cache_key: Mapped[str] = mapped_column(Text, primary_key=True)
    findings: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class DeviceMetricRow(Base):
    __tablename__ = "device_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mac: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    timestamp: Mapped[str] = mapped_column(Text, nullable=False)
    cpu: Mapped[float] = mapped_column(sa.Float, nullable=False)
    mem: Mapped[float] = mapped_column(sa.Float, nullable=False)
    temperature: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    uptime: Mapped[int] = mapped_column(Integer, nullable=False)
    tx_bytes: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    rx_bytes: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    num_sta: Mapped[int] = mapped_column(Integer, nullable=False)
    poe_consumption: Mapped[float | None] = mapped_column(sa.Float, nullable=True)


class RackRow(Base):
    __tablename__ = "racks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    size: Mapped[str] = mapped_column(Text, nullable=False, default="19-inch")
    height_u: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    location: Mapped[str] = mapped_column(Text, nullable=False, default="")


class RackItemRow(Base):
    __tablename__ = "rack_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rack_id: Mapped[int] = mapped_column(Integer, sa.ForeignKey("racks.id", ondelete="CASCADE"), nullable=False)
    position_u: Mapped[float] = mapped_column(sa.Float, nullable=False)
    height_u: Mapped[float] = mapped_column(sa.Float, nullable=False, default=1)
    device_type: Mapped[str] = mapped_column(Text, nullable=False, default="other")
    label: Mapped[str] = mapped_column(Text, nullable=False)
    power_watts: Mapped[float] = mapped_column(sa.Float, nullable=False, default=0.0)
    device_mac: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    width_fraction: Mapped[float] = mapped_column(sa.Float, nullable=False, default=1.0)
    position_x: Mapped[float] = mapped_column(sa.Float, nullable=False, default=0.0)


class TopologyNodePositionRow(Base):
    __tablename__ = "topology_node_positions"

    mac: Mapped[str] = mapped_column(Text, primary_key=True)
    x: Mapped[float] = mapped_column(sa.Float, nullable=False)
    y: Mapped[float] = mapped_column(sa.Float, nullable=False)


class NotificationRow(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_mac: Mapped[str] = mapped_column(Text, nullable=False)
    check_id: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    dismissed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PatchPanelRow(Base):
    __tablename__ = "patch_panels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    port_count: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    panel_type: Mapped[str] = mapped_column(Text, nullable=False, default="keystone")
    rack_mounted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rack_item_id: Mapped[int | None] = mapped_column(
        Integer, sa.ForeignKey("rack_items.id", ondelete="SET NULL"), nullable=True,
    )
    location: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")


class CableRunRow(Base):
    __tablename__ = "cable_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_device_mac: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dest_device_mac: Mapped[str | None] = mapped_column(Text, nullable=True)
    dest_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dest_label: Mapped[str] = mapped_column(Text, nullable=False, default="")
    patch_panel_id: Mapped[int | None] = mapped_column(
        Integer, sa.ForeignKey("patch_panels.id", ondelete="SET NULL"), nullable=True,
    )
    patch_panel_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cable_type: Mapped[str] = mapped_column(Text, nullable=False, default="cat6")
    length_m: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    color: Mapped[str] = mapped_column(Text, nullable=False, default="")
    label: Mapped[str] = mapped_column(Text, nullable=False, default="")
    speed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    poe: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")


class CableLabelSettingsRow(Base):
    __tablename__ = "cable_label_settings"
    __table_args__ = (CheckConstraint("id = 1", name="singleton_cable_label_settings"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    mode: Mapped[str] = mapped_column(Text, nullable=False, default="sequential")
    prefix: Mapped[str] = mapped_column(Text, nullable=False, default="C-")
    next_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    custom_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
