import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import PassphraseScreen from "./PassphraseScreen";

vi.mock("../api/client", () => ({
  api: {
    appLogin: vi.fn(),
  },
}));

import { api } from "../api/client";

const mockAppLogin = vi.mocked(api.appLogin);

describe("PassphraseScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the passphrase form", () => {
    render(<PassphraseScreen onAuthenticated={vi.fn()} />);
    expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("calls appLogin on submit", async () => {
    mockAppLogin.mockResolvedValue({ status: "ok" });
    const onAuthenticated = vi.fn();

    render(<PassphraseScreen onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "my-secret" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    });

    expect(mockAppLogin).toHaveBeenCalledWith("my-secret");
    expect(onAuthenticated).toHaveBeenCalled();
  });

  it("shows error on failed login", async () => {
    mockAppLogin.mockRejectedValue(new Error("401: Invalid password"));

    render(<PassphraseScreen onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    });

    expect(screen.getByText("401: Invalid password")).toBeInTheDocument();
  });

  it("shows fallback error for non-Error rejection", async () => {
    mockAppLogin.mockRejectedValue("string error");

    render(<PassphraseScreen onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    });

    expect(screen.getByText("Authentication failed")).toBeInTheDocument();
  });

  it("shows loading state while authenticating", async () => {
    mockAppLogin.mockReturnValue(new Promise(() => {}));

    render(<PassphraseScreen onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    });

    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
  });
});
