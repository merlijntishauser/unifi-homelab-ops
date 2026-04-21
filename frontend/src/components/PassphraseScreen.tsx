import { useState } from "react";
import type { FormEvent } from "react";
import { useAppLogin } from "../hooks/queries";
import PasswordInput from "./PasswordInput";

interface PassphraseScreenProps {
  onAuthenticated: () => void;
}

export default function PassphraseScreen({ onAuthenticated }: PassphraseScreenProps) {
  const [password, setPassword] = useState("");
  const appLoginMutation = useAppLogin();

  const error = appLoginMutation.error
    ? (appLoginMutation.error instanceof Error ? appLoginMutation.error.message : "Authentication failed")
    : null;
  const loading = appLoginMutation.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    appLoginMutation.mutate(password, { onSuccess: onAuthenticated });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-ui-bg dark:bg-noc-bg">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.08] dark:opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,111,255,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,111,255,0.4) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(0,111,255,0.12)_0%,_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_30%,_rgba(0,111,255,0.15)_0%,_transparent_60%)]" />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-[radial-gradient(circle_at_0%_0%,_rgba(0,111,255,0.08)_0%,_transparent_70%)]" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[radial-gradient(circle_at_100%_100%,_rgba(0,111,255,0.06)_0%,_transparent_70%)]" />
      {/* Floating dots */}
      <div
        className="absolute inset-0 opacity-[0.15] dark:opacity-[0.25]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,111,255,0.6) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          backgroundPosition: "30px 30px",
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-white/80 dark:bg-noc-surface/90 backdrop-blur-xl border border-ui-border dark:border-noc-border rounded-xl shadow-xl dark:shadow-2xl p-8 space-y-5 animate-fade-in"
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-ub-blue/50 to-transparent" />

        <h2 className="text-2xl font-sans font-semibold text-ub-blue text-center tracking-tight">
          UniFi Homelab Ops
        </h2>
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary text-center">
          Enter the application password to continue.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-3 text-sm text-red-700 dark:text-status-danger">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label
            htmlFor="passphrase"
            className="block text-sm font-medium text-ui-text-secondary dark:text-noc-text-secondary"
          >
            Password
          </label>
          <PasswordInput
            id="passphrase"
            required
            value={password}
            onChange={setPassword}
            placeholder="Application password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ub-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Authenticating..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
