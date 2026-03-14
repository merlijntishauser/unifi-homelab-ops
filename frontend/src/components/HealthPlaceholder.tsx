export default function HealthPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-noc-text-dim">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572" />
        <path d="M12 6l-2 4h4l-2 4" />
      </svg>
      <h2 className="text-lg font-display font-semibold text-gray-600 dark:text-noc-text-secondary">Site Health</h2>
      <p className="text-sm">Coming soon</p>
    </div>
  );
}
