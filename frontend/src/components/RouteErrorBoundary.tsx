import { isRouteErrorResponse, useRouteError, useNavigate } from "react-router-dom";
import ErrorScreen from "./ErrorScreen";
import { ERROR_PRIMARY_BTN, ERROR_SECONDARY_BTN } from "./ui";

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

  return (
    <ErrorScreen message={errorMessage(error)} stack={errorStack(error)}>
      <button type="button" onClick={() => navigate(0)} className={ERROR_PRIMARY_BTN}>
        Try again
      </button>
      <button type="button" onClick={() => navigate("/health")} className={ERROR_SECONDARY_BTN}>
        Go to Health
      </button>
    </ErrorScreen>
  );
}
