"""AI-powered device metrics analyzer."""

from __future__ import annotations

import structlog

from app.models import MetricsHistoryPoint, MetricsSnapshot
from app.services._ai_provider import call_anthropic, call_openai

log = structlog.get_logger()

_SYSTEM_PROMPT = """You are a network operations analyst reviewing 24h device metrics for a UniFi network device.

Provide a concise, actionable summary in 3-5 bullet points. Focus on:
- Anomalies or concerning patterns (CPU spikes, memory pressure, traffic surges)
- Whether current resource utilization is healthy or approaching limits
- Trends that suggest action may be needed soon

Be specific with numbers. Skip anything that looks normal.
If everything looks healthy, say so briefly.
Keep the total response under 200 words."""


def _build_user_prompt(device: MetricsSnapshot, history: list[MetricsHistoryPoint]) -> str:
    """Build the user prompt from device info and history."""
    lines = [
        f"Device: {device.name} ({device.model})",
        f"Status: {device.status}, Uptime: {device.uptime}s",
        f"Current: CPU {device.cpu:.1f}%, Mem {device.mem:.1f}%",
    ]
    if device.temperature is not None:
        lines.append(f"Temperature: {device.temperature:.1f}C")
    if device.poe_consumption is not None and device.poe_budget:
        lines.append(f"PoE: {device.poe_consumption:.1f}W / {device.poe_budget:.0f}W budget")
    lines.append(f"Clients: {device.num_sta}")
    lines.append("")

    # Summarize history as key stats
    if history:
        cpus = [h.cpu for h in history]
        mems = [h.mem for h in history]
        lines.append(f"24h CPU: min={min(cpus):.0f}%, max={max(cpus):.0f}%, avg={sum(cpus) / len(cpus):.0f}%")
        lines.append(f"24h Mem: min={min(mems):.0f}%, max={max(mems):.0f}%, avg={sum(mems) / len(mems):.0f}%")

        temps = [h.temperature for h in history if h.temperature is not None]
        if temps:
            lines.append(f"24h Temp: min={min(temps):.0f}C, max={max(temps):.0f}C")

        # Traffic totals (cumulative, so use first-last delta)
        if len(history) >= 2:
            tx_total = max(0, history[-1].tx_bytes - history[0].tx_bytes)
            rx_total = max(0, history[-1].rx_bytes - history[0].rx_bytes)
            lines.append(f"24h Traffic: TX {tx_total / (1024 * 1024):.1f}MB, RX {rx_total / (1024 * 1024):.1f}MB")

        clients = [h.num_sta for h in history]
        lines.append(f"24h Clients: min={min(clients)}, max={max(clients)}")

        # Sample 10 evenly-spaced data points for the timeline
        step = max(1, len(history) // 10)
        samples = history[::step][:10]
        lines.append("")
        lines.append("Timeline samples (HH:MM -> CPU%, Mem%):")
        for s in samples:
            ts = s.timestamp[11:16] if len(s.timestamp) > 16 else s.timestamp
            lines.append(f"  {ts}: CPU {s.cpu:.0f}%, Mem {s.mem:.0f}%")

    return "\n".join(lines)


def analyze_device(
    device: MetricsSnapshot,
    history: list[MetricsHistoryPoint],
    ai_config: dict[str, str],
) -> str:
    """Analyze device metrics with AI and return insight text."""
    user_prompt = _build_user_prompt(device, history)
    provider_type = ai_config.get("provider_type", "openai")
    base_url = ai_config["base_url"]
    api_key = ai_config["api_key"]
    model = ai_config["model"]

    log.info("metrics_ai_analyze", device=device.name, mac=device.mac, provider=provider_type)

    if provider_type == "anthropic":
        return call_anthropic(base_url, api_key, model, _SYSTEM_PROMPT, user_prompt)
    return call_openai(base_url, api_key, model, _SYSTEM_PROMPT, user_prompt)
