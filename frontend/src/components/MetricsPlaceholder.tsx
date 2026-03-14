export default function MetricsPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-noc-text-dim">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <h2 className="text-lg font-display font-semibold text-gray-600 dark:text-noc-text-secondary">Metrics</h2>
      <p className="text-sm">Coming soon</p>
    </div>
  );
}
