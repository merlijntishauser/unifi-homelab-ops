import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, act } from "@testing-library/react";
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SettingsModal from "./SettingsModal";
import type { AiConfig, AiPreset } from "../api/types";
import type { AppContextValue } from "../hooks/useAppContext";
import { AppContext } from "../hooks/useAppContext";
import type { ColorMode } from "@xyflow/react";

vi.mock("../api/client", () => ({
  api: {
    getAiPresets: vi.fn(),
    getAiConfig: vi.fn(),
    getAiAnalysisSettings: vi.fn(),
    saveAiConfig: vi.fn(),
    saveAiAnalysisSettings: vi.fn(),
    testAiConnection: vi.fn(),
    deleteAiConfig: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getAuthStatus: vi.fn(),
  },
}));

import { api } from "../api/client";

const mockGetAiPresets = vi.mocked(api.getAiPresets);
const mockGetAiConfig = vi.mocked(api.getAiConfig);
const mockGetAiAnalysisSettings = vi.mocked(api.getAiAnalysisSettings);
const mockSaveAiConfig = vi.mocked(api.saveAiConfig);
const mockSaveAiAnalysisSettings = vi.mocked(api.saveAiAnalysisSettings);
const mockTestAiConnection = vi.mocked(api.testAiConnection);
const mockDeleteAiConfig = vi.mocked(api.deleteAiConfig);

const testPresets: AiPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    provider_type: "openai",
    default_model: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    base_url: "https://api.anthropic.com",
    provider_type: "anthropic",
    default_model: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
  },
];

const noConfig: AiConfig = {
  base_url: "",
  model: "",
  provider_type: "",
  has_key: false,
  key_source: "none",
  source: "none",
};

const existingConfig: AiConfig = {
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o",
  provider_type: "openai",
  has_key: true,
  key_source: "db",
  source: "db",
};

function makeContext(overrides?: Partial<AppContextValue>): AppContextValue {
  return {
    colorMode: "dark" as ColorMode,
    themePreference: "dark",
    onThemePreferenceChange: vi.fn(),
    showHidden: false,
    onShowHiddenChange: vi.fn(),
    hasHiddenZones: false,
    hasDisabledRules: false,
    onRefresh: vi.fn(),
    dataLoading: false,
    onLogout: vi.fn(),
    onOpenSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    settingsOpen: true,
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "env" as const },
    aiInfo: { configured: false, provider: "", model: "" },
    aiConfigured: false,
    zones: [],
    zonePairs: [],
    filteredZonePairs: [],
    visibleZones: [],
    hiddenZoneIds: new Set<string>(),
    onToggleZone: vi.fn(),
    dataError: null,
    notificationsOpen: false,
    onOpenNotifications: vi.fn(),
    onCloseNotifications: vi.fn(),
    notificationCount: 0,
    onAppLogout: null,
    notificationState: { notifications: [], activeCount: 0, dismiss: vi.fn(), dismissAll: vi.fn() },
    ...overrides,
  };
}

function renderModal(onClose: () => void, ctxOverrides?: Partial<AppContextValue>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppContext.Provider value={makeContext(ctxOverrides)}>
          <SettingsModal onClose={onClose} />
        </AppContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderModalElement(ui: ReactElement, ctxOverrides?: Partial<AppContextValue>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppContext.Provider value={makeContext(ctxOverrides)}>
          {ui}
        </AppContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAiAnalysisSettings.mockResolvedValue({ site_profile: "homelab" });
    mockSaveAiAnalysisSettings.mockResolvedValue({});
  });

  // --- Tab navigation ---

  it("renders Connection tab as default", () => {
    renderModal(vi.fn());
    expect(screen.getByRole("heading", { name: "Connection" })).toBeInTheDocument();
    expect(screen.getByLabelText("Controller URL")).toBeInTheDocument();
  });

  it("switches to AI Provider tab", async () => {
    mockGetAiPresets.mockReturnValue(new Promise(() => {}));
    mockGetAiConfig.mockReturnValue(new Promise(() => {}));
    mockGetAiAnalysisSettings.mockReturnValue(new Promise(() => {}));

    renderModal(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    expect(screen.getByText("AI Provider Settings")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("switches to User Settings tab", () => {
    renderModal(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "User Settings" }));

    expect(screen.getByText("Appearance")).toBeInTheDocument();
  });

  // --- Connection pane ---

  it("renders connection form fields", () => {
    renderModal(vi.fn());
    expect(screen.getByLabelText("Controller URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Site")).toBeInTheDocument();
    expect(screen.getByLabelText("Verify SSL")).toBeInTheDocument();
  });

  it("pre-fills URL and username from connectionInfo", () => {
    renderModal(vi.fn());
    const urlInput = screen.getByLabelText("Controller URL") as HTMLInputElement;
    const usernameInput = screen.getByLabelText("Username") as HTMLInputElement;
    expect(urlInput.value).toBe("https://unifi.local");
    expect(usernameInput.value).toBe("admin");
  });

  it("shows connected badge when connected", () => {
    renderModal(vi.fn());
    expect(screen.getByText(/Connected to https:\/\/unifi\.local/)).toBeInTheDocument();
  });

  it("shows Disconnect button when connected", () => {
    renderModal(vi.fn());
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("does not show connected badge or Disconnect when not connected", () => {
    renderModal(vi.fn(), { connectionInfo: null });
    expect(screen.queryByText(/Connected to/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  });

  it("calls onLogout when Disconnect is clicked", () => {
    const onLogout = vi.fn();
    renderModal(vi.fn(), { onLogout });
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(onLogout).toHaveBeenCalled();
  });

  it("allows editing connection form fields", () => {
    renderModal(vi.fn());
    fireEvent.change(screen.getByLabelText("Controller URL"), { target: { value: "https://new.url" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "newpass" } });
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "mysite" } });
    fireEvent.click(screen.getByLabelText("Verify SSL"));

    expect((screen.getByLabelText("Controller URL") as HTMLInputElement).value).toBe("https://new.url");
    expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("newuser");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("newpass");
    expect((screen.getByLabelText("Site") as HTMLInputElement).value).toBe("mysite");
    expect((screen.getByLabelText("Verify SSL") as HTMLInputElement).checked).toBe(true);
  });

  it("calls login mutation when Connect is clicked", async () => {
    const mockLoginFn = vi.mocked(api.login);
    mockLoginFn.mockResolvedValue(undefined);

    renderModal(vi.fn());
    fireEvent.change(screen.getByLabelText("Controller URL"), { target: { value: "https://192.168.1.1" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pass" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    expect(mockLoginFn).toHaveBeenCalled();
  });

  it("switches back to Connection tab from another tab", () => {
    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "User Settings" }));
    expect(screen.getByText("Appearance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connection" }));
    expect(screen.getByRole("heading", { name: "Connection" })).toBeInTheDocument();
  });

  it("shows connection error from login mutation", async () => {
    const mockLoginFn = vi.mocked(api.login);
    mockLoginFn.mockRejectedValue(new Error("Auth failed"));

    renderModal(vi.fn());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Auth failed")).toBeInTheDocument();
    });
  });

  // --- AI Provider pane ---

  it("shows provider dropdown after loading on AI tab", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("auto-fills fields when preset is selected", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    });

    const modelSelect = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(modelSelect.value).toBe("gpt-4o");
  });

  it("calls saveAiConfig on save", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-test-key" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiConfig).toHaveBeenCalledWith({
      base_url: "https://api.openai.com/v1",
      api_key: "sk-test-key",
      model: "gpt-4o",
      provider_type: "openai",
    });
    expect(mockSaveAiAnalysisSettings).toHaveBeenCalledWith({ site_profile: "homelab" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls testAiConnection on test", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockTestAiConnection.mockResolvedValue({ status: "ok" });

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    });

    expect(mockTestAiConnection).toHaveBeenCalled();
    const successMsg = screen.getByText("Connection successful - provider responded");
    expect(successMsg).toBeInTheDocument();
    expect(successMsg.className).toContain("text-green-600");
  });

  it("calls deleteAiConfig on delete", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(existingConfig);
    mockDeleteAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(mockDeleteAiConfig).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error when AI loading fails", async () => {
    mockGetAiPresets.mockRejectedValue(new Error("Network error"));
    mockGetAiConfig.mockRejectedValue(new Error("Network error"));

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
    });
  });

  it("shows error when save fails", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockRejectedValue(new Error("Save failed"));
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows connection failed when test fails", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockTestAiConnection.mockRejectedValue(new Error("Connection error"));

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    });

    const failMsg = screen.getByText(/Connection error/);
    expect(failMsg).toBeInTheDocument();
    expect(failMsg.className).toContain("text-red-600");
  });

  it("shows error when delete fails", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(existingConfig);
    mockDeleteAiConfig.mockRejectedValue(new Error("Delete failed"));
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(screen.getByText("Failed to delete settings")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows custom fields when custom preset is selected", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "custom" } });
    });

    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider Type")).toBeInTheDocument();
    const modelInput = screen.getByLabelText("Model") as HTMLInputElement;
    expect(modelInput.type).toBe("text");
  });

  it("allows editing base URL and model for custom preset", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "custom" } });
    });

    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "https://custom.api.com/v1" } });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "custom-model" } });
    fireEvent.change(screen.getByLabelText("Provider Type"), { target: { value: "anthropic" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "custom-key" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiConfig).toHaveBeenCalledWith({
      base_url: "https://custom.api.com/v1",
      api_key: "custom-key",
      model: "custom-model",
      provider_type: "anthropic",
    });
  });

  it("allows changing model in preset dropdown", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    });

    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "gpt-4o-mini" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-key" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiConfig).toHaveBeenCalledWith({
      base_url: "https://api.openai.com/v1",
      api_key: "sk-key",
      model: "gpt-4o-mini",
      provider_type: "openai",
    });
  });

  it("hides Delete button when source is none", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed on backdrop", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.keyDown(screen.getByTestId("settings-backdrop"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose for non-Escape keys on backdrop", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.keyDown(screen.getByTestId("settings-backdrop"), { key: "Tab" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops keyboard event propagation on dialog content", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("auto-fills fields from existing config matching a preset", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(existingConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText("Provider") as HTMLSelectElement;
    expect(providerSelect.value).toBe("openai");

    const modelSelect = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(modelSelect.value).toBe("gpt-4o");
  });

  it("loads existing config with no matching preset", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue({
      base_url: "https://custom.example.com/v1",
      model: "custom-model-7b",
      provider_type: "openai",
      has_key: true,
      key_source: "db",
      source: "db",
    });

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText("Provider") as HTMLSelectElement;
    expect(providerSelect.value).toBe("");

    expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();
  });

  it("ignores handlePresetChange for unknown preset id", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    });

    const modelSelect = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(modelSelect.value).toBe("gpt-4o");

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "nonexistent" } });
    });

    const modelAfter = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(modelAfter.value).toBe("gpt-4o");
  });

  it("renders site profile dropdown with loaded value", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockGetAiAnalysisSettings.mockResolvedValue({ site_profile: "smb" });

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Site Profile")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Site Profile") as HTMLSelectElement;
    expect(select.value).toBe("smb");
  });

  it("saves site profile when changed", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    });

    fireEvent.change(screen.getByLabelText("Site Profile"), { target: { value: "enterprise" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-key" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiAnalysisSettings).toHaveBeenCalledWith({ site_profile: "enterprise" });
  });

  it("shows api key placeholder with existing db key", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(existingConfig);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    const keyInput = screen.getByLabelText("API Key") as HTMLInputElement;
    expect(keyInput.placeholder).toBe("Key configured \u2014 leave blank to keep");
  });

  it("shows env key placeholder when key comes from environment", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue({
      ...existingConfig,
      has_key: true,
      key_source: "env",
      source: "db",
    });

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    const keyInput = screen.getByLabelText("API Key") as HTMLInputElement;
    expect(keyInput.placeholder).toBe("Loaded from environment");
  });

  it("shows fallback message when test fails with non-Error value", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockTestAiConnection.mockRejectedValue("string error");

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    });

    const failMsg = screen.getByText("Connection failed");
    expect(failMsg).toBeInTheDocument();
    expect(failMsg.className).toContain("text-red-600");
  });

  describe("env-sourced config", () => {
    const envConfig: AiConfig = {
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o",
      provider_type: "openai",
      has_key: true,
      key_source: "env",
      source: "env",
    };

    it("shows env banner when config is from environment", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByText(/Configured via environment variables/)).toBeInTheDocument();
      });
    });

    it("disables provider dropdown when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Provider")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Provider")).toBeDisabled();
    });

    it("shows provider-specific key indicator when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByText("OpenAI key configured via environment")).toBeInTheDocument();
      });

      expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    });

    it("disables model dropdown when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Model")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Model")).toBeDisabled();
    });

    it("hides Delete button when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Provider")).toBeInTheDocument();
      });

      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });

    it("Save only saves site profile when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);
      mockSaveAiAnalysisSettings.mockResolvedValue({});
      const onClose = vi.fn();

      renderModal(onClose);
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Provider")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(mockSaveAiAnalysisSettings).toHaveBeenCalledWith({ site_profile: "homelab" });
      expect(mockSaveAiConfig).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("still shows Test Connection button when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Test Connection" })).toBeInTheDocument();
      });
    });

    it("allows site profile editing when env-sourced", async () => {
      mockGetAiPresets.mockResolvedValue(testPresets);
      mockGetAiConfig.mockResolvedValue(envConfig);

      renderModal(vi.fn());
      fireEvent.click(screen.getByRole("button", { name: "AI Provider" }));

      await waitFor(() => {
        expect(screen.getByLabelText("Site Profile")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Site Profile")).not.toBeDisabled();
    });
  });

  // --- User Settings pane ---

  it("renders theme selector on User Settings tab", () => {
    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "User Settings" }));

    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
  });

  it("calls onThemePreferenceChange when theme option is clicked", () => {
    const onThemePreferenceChange = vi.fn();
    renderModal(vi.fn(), { themePreference: "dark", onThemePreferenceChange });

    fireEvent.click(screen.getByRole("button", { name: "User Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Theme: Light" }));

    expect(onThemePreferenceChange).toHaveBeenCalledWith("light");
  });

  it("highlights current theme preference in User Settings", () => {
    renderModal(vi.fn(), { themePreference: "system" });
    fireEvent.click(screen.getByRole("button", { name: "User Settings" }));

    const systemBtn = screen.getByRole("button", { name: "Theme: System" });
    expect(systemBtn.className).toContain("bg-ub-blue");
  });

  // --- Unused helper suppression ---

  it("renderModalElement helper works", () => {
    renderModalElement(<SettingsModal onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
