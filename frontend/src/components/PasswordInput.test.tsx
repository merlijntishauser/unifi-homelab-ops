import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasswordInput from "./PasswordInput";

describe("PasswordInput", () => {
  it("renders as password type by default", () => {
    render(<PasswordInput id="pw" value="" onChange={vi.fn()} />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("toggles to text type when show button is clicked", () => {
    render(<PasswordInput id="pw" value="secret" onChange={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggle);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("toggles back to password type on second click", () => {
    render(<PasswordInput id="pw" value="secret" onChange={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("calls onChange with the input value", () => {
    const handler = vi.fn();
    render(<PasswordInput id="pw" value="" onChange={handler} />);
    const input = document.getElementById("pw") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test123" } });
    expect(handler).toHaveBeenCalledWith("test123");
  });

  it("passes placeholder and required props", () => {
    render(<PasswordInput id="pw" value="" onChange={vi.fn()} placeholder="Enter password" required />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.placeholder).toBe("Enter password");
    expect(input.required).toBe(true);
  });

  it("uses current-password autoComplete by default", () => {
    render(<PasswordInput id="pw" value="" onChange={vi.fn()} />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.autocomplete).toBe("current-password");
  });
});
