const REPO_URL = "https://github.com/merlijntishauser/unifi-network-maps-ha";
const HACS_INSTALL_URL = "https://my.home-assistant.io/redirect/hacs_repository/?owner=merlijntishauser&repository=unifi-network-maps-ha&category=integration";

const features = [
  {
    title: "Interactive Network Map",
    description: "Real-time SVG visualization of your entire UniFi topology with pan, zoom, and touch support.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="2" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><path d="m4.93 4.93 2.83 2.83m8.48 8.48 2.83 2.83m0-17.17-2.83 2.83m-8.48 8.48-2.83 2.83" />
      </svg>
    ),
  },
  {
    title: "Live Updates",
    description: "WebSocket push with HTTP polling fallback keeps your dashboard in sync with network changes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2a7 7 0 0 1 0-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a7 7 0 0 1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
      </svg>
    ),
  },
  {
    title: "VLAN Visualization",
    description: "Color-coded nodes and connections let you see VLAN segmentation at a glance across your network.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><rect x="14" y="14" width="8" height="8" rx="1" />
      </svg>
    ),
  },
  {
    title: "Automation Sensors",
    description: "Monitor device and client presence across VLANs with dedicated Home Assistant sensors.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 2a10 10 0 0 1 7.38 16.75" /><path d="M12 2a10 10 0 0 0-7.38 16.75" /><path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    title: "Multiple Themes",
    description: "Six SVG rendering styles and customizable icon sets to match your dashboard aesthetic.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    title: "Device Filtering",
    description: "Show or hide gateways, switches, access points, and clients to focus on what matters.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    ),
  },
];

const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-ub-blue px-6 py-3 text-sm font-semibold text-white hover:bg-ub-blue-light transition-colors cursor-pointer shadow-md";
const btnSecondary = "inline-flex items-center gap-2 rounded-lg border border-ui-border dark:border-noc-border px-6 py-3 text-sm font-semibold text-ui-text dark:text-noc-text hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors cursor-pointer";

export default function HomeAssistantModule() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ub-blue/5 via-transparent to-[#51bff7]/5 dark:from-ub-blue/10 dark:to-[#51bff7]/10" />
        <div className="relative max-w-3xl mx-auto px-6 pt-5 pb-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-ub-blue/10 dark:bg-ub-blue/20 px-4 py-1.5 mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-ub-blue" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            <span className="text-xs font-semibold text-ub-blue uppercase tracking-wide">Home Assistant Integration</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text dark:text-noc-text mb-2">
            UniFi Network Map
          </h1>
          <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary mb-2 max-w-xl mx-auto">
            Bring your UniFi network topology into Home Assistant. Interactive, real-time, and built for your dashboard.
          </p>
        </div>
      </div>

      {/* CTA buttons -- outside hero to stay above the fold */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-6 pb-6">
        <a href={HACS_INSTALL_URL} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Install via HACS
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          View on GitHub
        </a>
      </div>

      {/* Features grid */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <h2 className="text-center text-xs font-semibold uppercase tracking-widest text-ui-text-dim dark:text-noc-text-dim mb-5">What you get</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface p-5 hover:border-ui-border-hover dark:hover:border-noc-border-hover transition-colors">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-ub-blue/10 dark:bg-ub-blue/20 text-ub-blue mb-3">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-ui-text dark:text-noc-text mb-1">{f.title}</h3>
              <p className="text-xs text-ui-text-secondary dark:text-noc-text-secondary leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        <div className="rounded-xl border border-ui-border dark:border-noc-border bg-ui-raised dark:bg-noc-raised p-6">
          <h2 className="text-sm font-semibold text-ui-text dark:text-noc-text mb-4">Requirements</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ui-text-secondary dark:text-noc-text-secondary">
            {[
              "Home Assistant 2024.12+",
              "UniFi Dream Machine or controller",
              "Local UniFi account (not cloud)",
              "HACS installed",
            ].map((req) => (
              <li key={req} className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-status-success shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {req}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-6 pb-16 text-center">
        <p className="text-sm text-ui-text-dim dark:text-noc-text-dim">
          Open source under MIT license.{" "}
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className="text-ub-blue hover:underline">
            Report an issue
          </a>
          {" or "}
          <a href={`${REPO_URL}/pulls`} target="_blank" rel="noopener noreferrer" className="text-ub-blue hover:underline">
            contribute
          </a>.
        </p>
      </div>
    </div>
  );
}
