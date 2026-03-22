import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SuspenseRoute from "./SuspenseRoute";

describe("SuspenseRoute", () => {
  it("renders children", () => {
    render(
      <SuspenseRoute>
        <div data-testid="child">Hello</div>
      </SuspenseRoute>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });
});
