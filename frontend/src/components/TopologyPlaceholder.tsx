export default function TopologyPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-noc-text-dim">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
      <h2 className="text-lg font-display font-semibold text-gray-600 dark:text-noc-text-secondary">Topology</h2>
      <p className="text-sm">Coming soon</p>
    </div>
  );
}
