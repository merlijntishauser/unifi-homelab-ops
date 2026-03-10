import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";

interface LoginScreenProps {
  onLoggedIn: () => void;
}

export default function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [site, setSite] = useState("default");
  const [verifySsl, setVerifySsl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(url, username, password, site, verifySsl);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-3 py-2.5 text-sm text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors font-body";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-noc-bg px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(0,111,255,0.07)_0%,_transparent_60%)]" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-xl shadow-lg dark:shadow-2xl p-8 space-y-5 animate-fade-in"
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-ub-blue/50 to-transparent" />

        <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-noc-text text-center tracking-tight">
          Connect to UniFi Controller
        </h2>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-3 text-sm text-red-700 dark:text-status-danger">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary"
          >
            Controller URL
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://192.168.1.1"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="site"
            className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary"
          >
            Site
          </label>
          <input
            id="site"
            type="text"
            required
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="verifySsl"
            type="checkbox"
            checked={verifySsl}
            onChange={(e) => setVerifySsl(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
          />
          <label
            htmlFor="verifySsl"
            className="text-sm text-gray-700 dark:text-noc-text-secondary"
          >
            Verify SSL
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ub-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Connecting..." : "Connect"}
        </button>
      </form>
    </div>
  );
}
