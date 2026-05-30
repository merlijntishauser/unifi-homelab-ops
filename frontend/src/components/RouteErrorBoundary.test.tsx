import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import RouteErrorBoundary from "./RouteErrorBoundary";

// Error boundaries log to console.error; silence it for these intentional throws.
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  consoleError.mockClear();
});

function renderWithThrow(thrower: () => unknown) {
  function Boom() {
    throw thrower();
  }
  const router = createMemoryRouter(
    [
      { path: "/", element: <Boom />, errorElement: <RouteErrorBoundary /> },
      { path: "/health", element: <div>Health Page</div> },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("RouteErrorBoundary", () => {
  it("renders the friendly error UI with the message and a stack details panel", () => {
    renderWithThrow(() => new Error("kaboom"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("kaboom")).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
  });

  it("navigates to Health when the secondary button is clicked", () => {
    renderWithThrow(() => new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Go to Health" }));
    expect(screen.getByText("Health Page")).toBeInTheDocument();
  });

  it("renders a Try again button", () => {
    renderWithThrow(() => new Error("boom"));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("formats a route error response as status + statusText", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          loader: () => {
            throw new Response("nope", { status: 503, statusText: "Service Unavailable" });
          },
          element: <div>never</div>,
          errorElement: <RouteErrorBoundary />,
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);
    // The loader throw is async, so wait for the boundary to render.
    expect(await screen.findByText("503 Service Unavailable")).toBeInTheDocument();
    // Route responses are not Errors, so no stack panel.
    expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
  });

  it("renders a thrown string verbatim", () => {
    renderWithThrow(() => "plain string failure");
    expect(screen.getByText("plain string failure")).toBeInTheDocument();
    expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
  });

  it("falls back to a generic message for non-Error, non-string values", () => {
    renderWithThrow(() => ({ weird: true }));
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });
});
