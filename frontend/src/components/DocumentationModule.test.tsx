import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import DocumentationModule from "./DocumentationModule";

const sectionsMock = vi.hoisted(() => ({
  data: {
    sections: [
      { id: "zones", title: "Zones & Networks", content: "## Zones\n\n| Zone | VLAN |\n|------|------|\n| LAN | 1 |", item_count: 3, data: [{ zone: "LAN", vlan: 1 }] },
      { id: "rules", title: "Firewall Rules", content: "**10 rules** configured.", item_count: 10, data: null },
    ],
  } as { sections: Array<{ id: string; title: string; content: string; item_count: number; data: Record<string, string | number | boolean | null>[] | null }> } | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useDocSections: () => sectionsMock,
  };
});

const mockGetDocExport = vi.fn<() => Promise<string>>();

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>mocked diagram</svg>" }),
  },
}));

vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

vi.mock("../api/client", async () => {
  const actual = await vi.importActual("../api/client");
  return {
    ...actual,
    api: {
      ...(actual as Record<string, unknown>).api,
      getDocExport: () => mockGetDocExport(),
    },
  };
});

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
    settingsOpen: false,
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const },
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
    ...overrides,
  };
}

function renderModule(ctx?: Partial<AppContextValue>) {
  return render(
    <AppContext.Provider value={makeContext(ctx)}>
      <MemoryRouter>
        <DocumentationModule />
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  sectionsMock.data = {
    sections: [
      { id: "zones", title: "Zones & Networks", content: "## Zones\n\n| Zone | VLAN |\n|------|------|\n| LAN | 1 |", item_count: 3, data: [{ zone: "LAN", vlan: 1 }] },
      { id: "rules", title: "Firewall Rules", content: "**10 rules** configured.", item_count: 10, data: null },
    ],
  };
  sectionsMock.isLoading = false;
  sectionsMock.error = null;
  sectionsMock.refetch = vi.fn();
  mockGetDocExport.mockReset();
});

describe("DocumentationModule", () => {
  it("renders section titles when data is loaded", () => {
    renderModule();
    expect(screen.getByText("Zones & Networks")).toBeInTheDocument();
    expect(screen.getByText("Firewall Rules")).toBeInTheDocument();
  });

  it("shows item count badges", () => {
    renderModule();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows loading state when fetching", () => {
    sectionsMock.data = undefined;
    sectionsMock.isLoading = true;
    renderModule();
    expect(screen.getByText("Loading documentation...")).toBeInTheDocument();
  });

  it("shows error state when query fails", () => {
    sectionsMock.data = undefined;
    sectionsMock.error = new Error("Connection refused");
    renderModule();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows error fallback for non-Error objects", () => {
    sectionsMock.data = undefined;
    sectionsMock.error = { message: "" } as Error;
    renderModule();
    expect(screen.getByText("Failed to load documentation")).toBeInTheDocument();
  });

  it("shows empty state when no sections", () => {
    sectionsMock.data = { sections: [] };
    renderModule();
    expect(screen.getByText("No documentation sections available.")).toBeInTheDocument();
  });

  it("sections are collapsed by default", () => {
    renderModule();
    // The markdown content should not be visible before expanding
    expect(screen.queryByText("10 rules")).not.toBeInTheDocument();
  });

  it("expands section when header is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Firewall Rules"));
    // After expanding, the rendered markdown should be visible
    expect(screen.getByText(/10 rules/)).toBeInTheDocument();
  });

  it("collapses section when header is clicked again", () => {
    renderModule();
    // Expand
    fireEvent.click(screen.getByText("Firewall Rules"));
    expect(screen.getByText(/10 rules/)).toBeInTheDocument();
    // Collapse
    fireEvent.click(screen.getByText("Firewall Rules"));
    expect(screen.queryByText("10 rules")).not.toBeInTheDocument();
  });

  it("has export button", () => {
    renderModule();
    expect(screen.getByText("Export Markdown")).toBeInTheDocument();
  });

  it("has refresh button", () => {
    renderModule();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("calls refetch when refresh is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Refresh"));
    expect(sectionsMock.refetch).toHaveBeenCalled();
  });

  it("triggers file download on export", async () => {
    mockGetDocExport.mockResolvedValue("# Network Documentation\n\nContent here.");
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    });

    renderModule();
    fireEvent.click(screen.getByText("Export Markdown"));

    await waitFor(() => {
      expect(mockGetDocExport).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");

    vi.restoreAllMocks();
  });

  it("shows exporting state while export is in progress", async () => {
    let resolveExport: (value: string) => void = () => {};
    mockGetDocExport.mockImplementation(() => new Promise<string>((resolve) => { resolveExport = resolve; }));

    renderModule();
    fireEvent.click(screen.getByText("Export Markdown"));

    expect(screen.getByText("Exporting...")).toBeInTheDocument();

    // Resolve the export
    resolveExport("# Doc");
    await waitFor(() => {
      expect(screen.getByText("Export Markdown")).toBeInTheDocument();
    });
  });

  it("handles export failure gracefully", async () => {
    mockGetDocExport.mockRejectedValue(new Error("Network error"));

    renderModule();
    fireEvent.click(screen.getByText("Export Markdown"));

    await waitFor(() => {
      expect(screen.getByText("Export Markdown")).toBeInTheDocument();
    });
    // Should not crash -- button is restored
  });

  it("can expand multiple sections simultaneously", () => {
    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    fireEvent.click(screen.getByText("Firewall Rules"));
    // Both sections should have their content visible
    expect(screen.getByText(/10 rules/)).toBeInTheDocument();
    // Zones section content should also be visible (rendered as markdown heading)
    expect(screen.getByText("Zones")).toBeInTheDocument();
  });

  it("renders mermaid code blocks as diagrams", async () => {
    sectionsMock.data = {
      sections: [
        { id: "topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    fireEvent.click(screen.getByText("Network Topology"));
    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });
  });

  it("shows copy/download MD buttons when section expanded", () => {
    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    expect(screen.getByText("Copy MD")).toBeInTheDocument();
    expect(screen.getByText("Download MD")).toBeInTheDocument();
  });

  it("shows JSON buttons when section has data", () => {
    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    expect(screen.getByText("Copy JSON")).toBeInTheDocument();
    expect(screen.getByText("Download JSON")).toBeInTheDocument();
  });

  it("hides JSON buttons when section has no data", () => {
    renderModule();
    fireEvent.click(screen.getByText("Firewall Rules"));
    expect(screen.queryByText("Copy JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Download JSON")).not.toBeInTheDocument();
  });

  it("falls back to raw code when mermaid render fails", async () => {
    const { default: mermaidMock } = await import("mermaid");
    vi.mocked(mermaidMock.render).mockRejectedValueOnce(new Error("parse error"));
    sectionsMock.data = {
      sections: [
        { id: "topology", title: "Network Topology", content: "```mermaid\ninvalid\n```", item_count: 1 },
      ],
    };
    renderModule();
    fireEvent.click(screen.getByText("Network Topology"));
    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });
  });
});
