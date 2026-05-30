import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RootErrorBoundary from "./RootErrorBoundary";

const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  consoleError.mockClear();
});

function Boom({ when }: { when: boolean }) {
  if (when) {
    throw new Error("root kaboom");
  }
  return <div>Healthy child</div>;
}

describe("RootErrorBoundary", () => {
  it("renders its children when there is no error", () => {
    render(
      <RootErrorBoundary>
        <Boom when={false} />
      </RootErrorBoundary>,
    );
    expect(screen.getByText("Healthy child")).toBeInTheDocument();
  });

  it("renders the fallback with the error message when a child throws", () => {
    render(
      <RootErrorBoundary>
        <Boom when />
      </RootErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("root kaboom")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("reloads the page when Reload is clicked", () => {
    const reload = vi.fn();
    const original = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    try {
      render(
        <RootErrorBoundary>
          <Boom when />
        </RootErrorBoundary>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
      expect(reload).toHaveBeenCalled();
    } finally {
      if (original) {
        Object.defineProperty(window, "location", original);
      }
    }
  });

  it("falls back to a generic message when the error has no message", () => {
    function BlankThrow(): never {
      throw new Error("");
    }
    render(
      <RootErrorBoundary>
        <BlankThrow />
      </RootErrorBoundary>,
    );
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });
});
