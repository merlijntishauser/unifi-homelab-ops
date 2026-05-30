import { isRouteErrorResponse, useRouteError, useNavigate } from "react-router-dom";

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred.";
}

function errorStack(error: unknown): string | null {
  return error instanceof Error && error.stack ? error.stack : null;
}

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = errorMessage(error);
  const stack = errorStack(error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        role="alert"
        className="w-full max-w-lg rounded-xl border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface p-8 shadow-lg space-y-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-red-50 dark:bg-status-danger-dim text-red-600 dark:text-status-danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <h2 className="text-lg font-sans font-semibold text-ui-text dark:text-noc-text">
            Something went wrong
          </h2>
        </div>

        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">
          This part of the app hit an unexpected error. You can try again, or reload the page if it keeps happening.
        </p>

        <p className="rounded-lg bg-ui-input dark:bg-noc-input border border-ui-border dark:border-noc-border px-3 py-2 font-mono text-xs text-red-700 dark:text-status-danger break-words">
          {message}
        </p>

        {stack && (
          <details className="text-xs text-ui-text-dim dark:text-noc-text-dim">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-ui-input dark:bg-noc-input p-3 font-mono whitespace-pre-wrap break-words">
              {stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate(0)}
            className="flex-1 rounded-lg bg-ub-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 transition-all"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => navigate("/health")}
            className="rounded-lg border border-ui-border dark:border-noc-border px-4 py-2 text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-all"
          >
            Go to Health
          </button>
        </div>
      </div>
    </div>
  );
}
