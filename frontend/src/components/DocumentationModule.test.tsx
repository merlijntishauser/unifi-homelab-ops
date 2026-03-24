import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
    onAppLogout: null,
    notificationState: { notifications: [], activeCount: 0, dismiss: vi.fn(), dismissAll: vi.fn() },
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
    expect(screen.getByText("Complete Markdown")).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("Complete Markdown"));

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

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();

    renderModule();
    fireEvent.click(screen.getByText("Complete Markdown"));

    expect(screen.getByText("Downloading...")).toBeInTheDocument();

    // Resolve the export
    resolveExport("# Doc");
    await waitFor(() => {
      expect(screen.getByText("Complete Markdown")).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it("handles export failure gracefully", async () => {
    mockGetDocExport.mockRejectedValue(new Error("Network error"));

    renderModule();
    fireEvent.click(screen.getByText("Complete Markdown"));

    await waitFor(() => {
      expect(screen.getByText("Complete Markdown")).toBeInTheDocument();
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

  it("renders non-mermaid code blocks as plain code", () => {
    sectionsMock.data = {
      sections: [
        { id: "config", title: "Config", content: "```json\n{\"key\": \"value\"}\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    fireEvent.click(screen.getByText("Config"));
    expect(screen.getByText(/"key"/)).toBeInTheDocument();
  });

  it("renders mermaid code blocks as diagrams", async () => {
    sectionsMock.data = {
      sections: [
        { id: "topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => {
      await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });
    });
    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });
  });

  it("shows copy/download MD buttons when section expanded", () => {
    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    expect(screen.getByRole("button", { name: "Copy MD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download MD" })).toBeInTheDocument();
  });

  it("shows JSON buttons when section has data", () => {
    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeInTheDocument();
  });

  it("hides JSON buttons when section has no data", () => {
    renderModule();
    fireEvent.click(screen.getByText("Firewall Rules"));
    expect(screen.queryByRole("button", { name: "Copy JSON" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download JSON" })).not.toBeInTheDocument();
  });

  it("shows SVG and PNG download buttons for mermaid section", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });
    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });
    expect(screen.getByRole("button", { name: "Download SVG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
  });

  it("hides SVG/PNG buttons for non-mermaid sections", () => {
    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    expect(screen.queryByRole("button", { name: "Download SVG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PNG" })).not.toBeInTheDocument();
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
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });
    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });
  });

  it("copies markdown to clipboard when Copy MD is clicked", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderModule();
    fireEvent.click(screen.getByText("Firewall Rules"));
    fireEvent.click(screen.getByRole("button", { name: "Copy MD" }));

    expect(writeText).toHaveBeenCalledWith("**10 rules** configured.");
  });

  it("copies JSON to clipboard when Copy JSON is clicked", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));

    expect(writeText).toHaveBeenCalledWith(JSON.stringify([{ zone: "LAN", vlan: 1 }], null, 2));
  });

  it("handles clipboard failure gracefully", () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });

    renderModule();
    fireEvent.click(screen.getByText("Firewall Rules"));
    // Should not throw
    fireEvent.click(screen.getByRole("button", { name: "Copy MD" }));
    expect(writeText).toHaveBeenCalled();
  });

  it("downloads markdown file when Download MD is clicked", () => {
    const createObjectURL = vi.fn(() => "blob:md-url");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });

    renderModule();
    fireEvent.click(screen.getByText("Firewall Rules"));
    fireEvent.click(screen.getByRole("button", { name: "Download MD" }));

    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = vi.mocked(createObjectURL).mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("text/markdown");
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:md-url");

    vi.restoreAllMocks();
  });

  it("downloads JSON file when Download JSON is clicked", () => {
    const createObjectURL = vi.fn(() => "blob:json-url");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });

    renderModule();
    fireEvent.click(screen.getByText("Zones & Networks"));
    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = vi.mocked(createObjectURL).mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("application/json");
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:json-url");

    vi.restoreAllMocks();
  });

  it("downloads SVG when Download SVG is clicked on mermaid section", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });

    // Wait for the SVG to be inserted into the DOM via the ref
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });

    const serializeToString = vi.fn(() => "<svg>serialized</svg>");
    vi.stubGlobal("XMLSerializer", class { serializeToString = serializeToString; });

    const createObjectURL = vi.fn(() => "blob:svg-url");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });

    fireEvent.click(screen.getByRole("button", { name: "Download SVG" }));

    expect(serializeToString).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:svg-url");

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads PNG when Download PNG is clicked on mermaid section", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });

    const serializeToString = vi.fn(() => "<svg>serialized</svg>");
    vi.stubGlobal("XMLSerializer", class { serializeToString = serializeToString; });

    const createObjectURL = vi.fn(() => "blob:png-url");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const drawImage = vi.fn();
    const scale = vi.fn();
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage, scale })),
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
        cb(new Blob(["png-data"], { type: "image/png" }));
      }),
    };

    const anchorClickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      if (tag === "a") return { href: "", download: "", click: anchorClickSpy } as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });

    // Mock Image constructor to immediately call onload
    const mockImage = { width: 100, height: 50, onload: null as (() => void) | null, src: "" };
    vi.stubGlobal("Image", class {
      width = mockImage.width;
      height = mockImage.height;
      onload: (() => void) | null = null;
      _src = "";
      get src() { return this._src; }
      set src(val: string) {
        this._src = val;
        // Trigger onload asynchronously
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    // Wait for the Image onload to fire (via setTimeout)
    await waitFor(() => {
      expect(drawImage).toHaveBeenCalled();
    });

    expect(serializeToString).toHaveBeenCalled();
    expect(mockCanvas.getContext).toHaveBeenCalledWith("2d");
    expect(scale).toHaveBeenCalledWith(2, 2);
    expect(mockCanvas.toBlob).toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("handles Download PNG gracefully when no SVG is present", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ninvalid\n```", item_count: 1, data: null },
      ],
    };

    const { default: mermaidMock } = await import("mermaid");
    vi.mocked(mermaidMock.render).mockRejectedValueOnce(new Error("fail"));

    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });

    // No SVG in the DOM -- clicking Download PNG should not throw
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
  });

  it("handles Download SVG gracefully when no SVG is present", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ninvalid\n```", item_count: 1, data: null },
      ],
    };

    const { default: mermaidMock } = await import("mermaid");
    vi.mocked(mermaidMock.render).mockRejectedValueOnce(new Error("fail"));

    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });

    // No SVG in the DOM -- clicking Download SVG should not throw
    fireEvent.click(screen.getByRole("button", { name: "Download SVG" }));
  });

  it("handles Download PNG when canvas getContext returns null", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });

    vi.stubGlobal("XMLSerializer", class { serializeToString = vi.fn(() => "<svg/>"); });

    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const mockCanvas = {
      width: 0, height: 0,
      getContext: vi.fn(() => null),
      toBlob: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return originalCreateElement(tag);
    });

    vi.stubGlobal("Image", class {
      width = 100; height = 50; onload: (() => void) | null = null; _src = "";
      get src() { return this._src; }
      set src(val: string) { this._src = val; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
    });

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    await waitFor(() => {
      expect(mockCanvas.getContext).toHaveBeenCalledWith("2d");
    });

    // toBlob should NOT be called since getContext returned null
    expect(mockCanvas.toBlob).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("handles Download PNG when toBlob returns null", async () => {
    sectionsMock.data = {
      sections: [
        { id: "mermaid-topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });

    vi.stubGlobal("XMLSerializer", class { serializeToString = vi.fn(() => "<svg/>"); });

    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const drawImage = vi.fn();
    const scaleFn = vi.fn();
    const mockCanvas = {
      width: 0, height: 0,
      getContext: vi.fn(() => ({ drawImage, scale: scaleFn })),
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => { cb(null); }),
    };

    const anchorClickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      if (tag === "a") return { href: "", download: "", click: anchorClickSpy } as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });

    vi.stubGlobal("Image", class {
      width = 100; height = 50; onload: (() => void) | null = null; _src = "";
      get src() { return this._src; }
      set src(val: string) { this._src = val; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
    });

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    await waitFor(() => {
      expect(drawImage).toHaveBeenCalled();
    });

    expect(mockCanvas.toBlob).toHaveBeenCalled();
    // anchor click should NOT have been called since blob was null
    expect(anchorClickSpy).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders mermaid diagram into ref div when render succeeds", async () => {
    sectionsMock.data = {
      sections: [
        { id: "topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule();
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.render).toHaveBeenCalled();
    });

    // The rendered SVG should be inserted into the DOM
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });
  });

  it("uses light theme variables when colorMode is light", async () => {
    sectionsMock.data = {
      sections: [
        { id: "topology", title: "Network Topology", content: "```mermaid\ngraph TD;\nA-->B;\n```", item_count: 1, data: null },
      ],
    };
    renderModule({ colorMode: "light" as ColorMode });
    await act(async () => { fireEvent.click(screen.getByText("Network Topology")); });

    const { default: mermaidMod } = await import("mermaid");
    await waitFor(() => {
      expect(mermaidMod.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          themeVariables: expect.objectContaining({ background: "#f7f8fa" }),
        }),
      );
    });
    await waitFor(() => {
      expect(document.querySelector("svg")).not.toBeNull();
    });
  });
});
