export function getActionColor(action: string): string {
  if (action === "ALLOW") return "#00d68f";
  return "#ff4d5e";
}

export function getEdgeColor(allowCount: number, blockCount: number): string {
  if (allowCount > 0 && blockCount === 0) return "#00d68f";
  if (blockCount > 0 && allowCount === 0) return "#ff4d5e";
  return "#ffaa2c";
}
