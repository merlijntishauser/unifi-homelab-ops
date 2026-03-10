import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import type { ZonePair, Rule, Finding, SimulateResponse } from "../api/types";

interface RulePanelProps {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  aiConfigured: boolean;
  onClose: () => void;
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "bg-status-success";
  if (grade === "C") return "bg-status-warning";
  return "bg-status-danger";
}

function severityBadge(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-100 dark:bg-status-danger-dim text-red-700 dark:text-status-danger";
    case "medium":
      return "bg-amber-100 dark:bg-status-warning-dim text-amber-700 dark:text-status-warning";
    case "low":
      return "bg-blue-100 dark:bg-ub-blue-dim text-blue-700 dark:text-ub-blue";
    default:
      return "bg-gray-100 dark:bg-noc-raised text-gray-700 dark:text-noc-text-secondary";
  }
}

function actionColor(action: Rule["action"], enabled: boolean): string {
  if (!enabled) return "bg-gray-50 dark:bg-noc-raised/50 border-gray-200 dark:border-noc-border";
  switch (action) {
    case "ALLOW":
      return "bg-green-50 dark:bg-status-success/6 border-green-200 dark:border-status-success/20";
    case "BLOCK":
    case "REJECT":
      return "bg-red-50 dark:bg-status-danger/6 border-red-200 dark:border-status-danger/20";
  }
}

function actionBadge(action: Rule["action"]): string {
  switch (action) {
    case "ALLOW":
      return "bg-green-100 dark:bg-status-success/15 text-green-800 dark:text-status-success";
    case "BLOCK":
      return "bg-red-100 dark:bg-status-danger/15 text-red-800 dark:text-status-danger";
    case "REJECT":
      return "bg-red-100 dark:bg-status-danger/15 text-red-800 dark:text-status-danger";
  }
}

function verdictColor(verdict: string | null): string {
  switch (verdict) {
    case "ALLOW":
      return "bg-green-50 dark:bg-status-success/10 border-green-300 dark:border-status-success/30 text-green-800 dark:text-status-success";
    case "BLOCK":
    case "REJECT":
      return "bg-red-50 dark:bg-status-danger/10 border-red-300 dark:border-status-danger/30 text-red-800 dark:text-status-danger";
    default:
      return "bg-gray-50 dark:bg-noc-raised border-gray-300 dark:border-noc-border text-gray-700 dark:text-noc-text-secondary";
  }
}

export default function RulePanel({
  pair,
  sourceZoneName,
  destZoneName,
  aiConfigured,
  onClose,
}: RulePanelProps) {
  const [srcIp, setSrcIp] = useState("");
  const [dstIp, setDstIp] = useState("");
  const [protocol, setProtocol] = useState("TCP");
  const [port, setPort] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFindings, setAiFindings] = useState<Finding[]>([]);

  const sortedRules = useMemo(() => [...pair.rules].sort((a, b) => a.index - b.index), [pair.rules]);

  const allFindings = useMemo<Finding[]>(() => [
    ...(pair.analysis?.findings ?? []),
    ...aiFindings,
  ], [pair.analysis?.findings, aiFindings]);

  async function handleAiAnalyze() {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await api.analyzeWithAi({
        source_zone_name: sourceZoneName,
        destination_zone_name: destZoneName,
        rules: pair.rules,
      });
      setAiFindings(result.findings);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSimulate(e: FormEvent) {
    e.preventDefault();
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    try {
      const result = await api.simulate({
        src_ip: srcIp,
        dst_ip: dstIp,
        protocol: protocol === "Any" ? "all" : protocol.toLowerCase(),
        port: port ? Number(port) : null,
      });
      setSimResult(result);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-2.5 py-1.5 text-xs font-mono text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

  return (
    <div className="w-[400px] h-full border-l border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface flex flex-col overflow-hidden animate-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-noc-border">
        <h2 className="text-sm font-display font-semibold text-gray-900 dark:text-noc-text truncate">
          {sourceZoneName} &rarr; {destZoneName}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text text-lg leading-none cursor-pointer transition-colors"
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Analysis section */}
        {pair.analysis && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded-md text-xs font-bold text-white ${gradeColor(pair.analysis.grade)}`}>
                {pair.analysis.grade}
              </div>
              <span className="text-xs font-mono text-gray-500 dark:text-noc-text-dim">
                {pair.analysis.score}/100
              </span>
            </div>
            {allFindings.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
                  Findings ({allFindings.length})
                </h3>
                {allFindings.map((finding, idx) => (
                  <div key={finding.id ?? idx} className="rounded-lg border border-gray-200 dark:border-noc-border p-2.5 text-xs bg-gray-50 dark:bg-noc-raised/50">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadge(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      {finding.source === "ai" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-ub-purple/15 text-purple-700 dark:text-ub-purple-light">
                          AI
                        </span>
                      )}
                      <span className="font-medium text-gray-900 dark:text-noc-text">{finding.title}</span>
                    </div>
                    <p className="mt-1 text-gray-500 dark:text-noc-text-secondary">{finding.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {aiError && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
            {aiError}
          </div>
        )}
        {aiConfigured && (
          <button
            onClick={handleAiAnalyze}
            disabled={aiLoading}
            className="w-full rounded-lg bg-ub-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-ub-purple-light focus:outline-none focus:ring-2 focus:ring-ub-purple/40 focus:ring-offset-1 dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            {aiLoading ? "Analyzing..." : "Analyze with AI"}
          </button>
        )}

        {/* Rule list */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
            Rules ({sortedRules.length})
          </h3>
          {sortedRules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-lg border p-2.5 text-xs ${actionColor(rule.action, rule.enabled)} ${
                simResult?.matched_rule_id === rule.id
                  ? "ring-2 ring-ub-blue"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-medium text-gray-900 dark:text-noc-text truncate">
                  {rule.index}. {rule.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {rule.predefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-noc-input text-gray-600 dark:text-noc-text-dim font-mono">
                      built-in
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${actionBadge(rule.action)}`}
                  >
                    {rule.action}
                  </span>
                </div>
              </div>
              {(rule.protocol || rule.port_ranges.length > 0) && (
                <div className="mt-1 font-mono text-gray-500 dark:text-noc-text-secondary">
                  {rule.protocol && <span>{rule.protocol}</span>}
                  {rule.port_ranges.length > 0 && (
                    <span className="ml-1">
                      port {rule.port_ranges.join(", ")}
                    </span>
                  )}
                </div>
              )}
              {!rule.enabled && (
                <div className="mt-1 text-gray-400 dark:text-noc-text-dim italic">
                  disabled
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Packet simulation form */}
        <form onSubmit={handleSimulate} className="space-y-2">
          <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
            Packet Simulation
          </h3>
          <input
            type="text"
            placeholder="Source IP"
            value={srcIp}
            onChange={(e) => setSrcIp(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Destination IP"
            value={dstIp}
            onChange={(e) => setDstIp(e.target.value)}
            required
            className={inputClass}
          />
          <div className="flex gap-2">
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className={inputClass}
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
              <option value="Any">Any</option>
            </select>
            <input
              type="number"
              placeholder="Port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              min={1}
              max={65535}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={simLoading}
            className="w-full rounded-lg bg-ub-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 focus:ring-offset-1 dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            {simLoading ? "Simulating..." : "Simulate"}
          </button>
        </form>

        {/* Simulation error */}
        {simError && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
            {simError}
          </div>
        )}

        {/* Simulation result */}
        {simResult && (
          <div className="space-y-2 animate-fade-in">
            <div
              className={`rounded-lg border p-3 text-center font-display font-semibold text-sm ${verdictColor(simResult.verdict)}`}
            >
              {simResult.verdict ?? "NO MATCH"}
              {simResult.default_policy_used && (
                <div className="text-xs font-normal mt-1 opacity-70 font-body">
                  (default policy)
                </div>
              )}
            </div>

            {simResult.matched_rule_name && (
              <div className="text-xs text-gray-600 dark:text-noc-text-secondary">
                Matched:{" "}
                <span className="font-medium text-gray-900 dark:text-noc-text">
                  {simResult.matched_rule_name}
                </span>
              </div>
            )}

            {simResult.evaluations.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
                  Evaluation Chain
                </h4>
                {simResult.evaluations.map((ev) => (
                  <div
                    key={ev.rule_id}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                      ev.matched
                        ? "border-blue-300 dark:border-ub-blue/30 bg-blue-50 dark:bg-ub-blue-dim"
                        : ev.skipped_disabled
                          ? "border-gray-200 dark:border-noc-border bg-gray-50 dark:bg-noc-raised/50 opacity-50"
                          : "border-gray-200 dark:border-noc-border bg-gray-50 dark:bg-noc-raised/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-noc-text-secondary truncate">
                        {ev.rule_name}
                      </span>
                      <span
                        className={`shrink-0 ml-1 font-mono ${ev.matched ? "text-ub-blue font-semibold" : "text-gray-400 dark:text-noc-text-dim"}`}
                      >
                        {ev.matched ? "MATCH" : "skip"}
                      </span>
                    </div>
                    <div className="text-gray-400 dark:text-noc-text-dim mt-0.5">
                      {ev.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
