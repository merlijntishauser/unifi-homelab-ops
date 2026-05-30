import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import ErrorScreen from "./ErrorScreen";
import { ERROR_PRIMARY_BTN } from "./ui";

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary that catches render errors anywhere in the tree --
 * including above the router (auth flow, context providers) where React Router's
 * per-route errorElement cannot reach. A full reload is the only safe recovery
 * here, since the app shell itself failed to mount.
 */
export default class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Root error boundary caught an error", error, info);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <ErrorScreen message={error.message || "An unexpected error occurred."} stack={error.stack} fullScreen>
          <button type="button" onClick={() => window.location.reload()} className={ERROR_PRIMARY_BTN}>
            Reload page
          </button>
        </ErrorScreen>
      );
    }
    return this.props.children;
  }
}
