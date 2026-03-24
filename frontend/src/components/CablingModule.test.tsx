import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CablingModule from "./CablingModule";

const cablesMock = vi.hoisted(() => ({
  data: undefined as Array<Record<string, unknown>> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const panelsMock = vi.hoisted(() => ({
  data: undefined as Array<Record<string, unknown>> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const createCableMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const updateCableMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const deleteCableMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const syncCablesMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const createPanelMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const updatePanelMock = vi.hoisted(() => ({ mutate: vi.fn() }));
const deletePanelMock = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useCables: () => cablesMock,
    usePatchPanels: () => panelsMock,
    useCreateCable: () => createCableMock,
    useUpdateCable: () => updateCableMock,
    useDeleteCable: () => deleteCableMock,
    useSyncCables: () => syncCablesMock,
    useCreatePatchPanel: () => createPanelMock,
    useUpdatePatchPanel: () => updatePanelMock,
    useDeletePatchPanel: () => deletePanelMock,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderModule() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <CablingModule />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleCables = [
  {
    id: 1,
    source_device_mac: "aa:bb:cc:dd:ee:01",
    source_port: 1,
    dest_device_mac: "aa:bb:cc:dd:ee:02",
    dest_port: 3,
    dest_label: "",
    patch_panel_id: 1,
    patch_panel_port: 5,
    cable_type: "cat6",
    length_m: 3.5,
    color: "blue",
    label: "C-001",
    speed: 1000,
    poe: true,
    status: "active",
    notes: "Main uplink",
    source_device_name: "Switch-01",
    dest_device_name: "Gateway",
    patch_panel_name: "PP-01",
  },
  {
    id: 2,
    source_device_mac: null,
    source_port: null,
    dest_device_mac: null,
    dest_port: null,
    dest_label: "Office 201-A",
    patch_panel_id: null,
    patch_panel_port: null,
    cable_type: "cat6a",
    length_m: 15.0,
    color: "white",
    label: "C-002",
    speed: null,
    poe: false,
    status: "spare",
    notes: "",
    source_device_name: null,
    dest_device_name: null,
    patch_panel_name: null,
  },
  {
    id: 3,
    source_device_mac: "aa:bb:cc:dd:ee:03",
    source_port: 2,
    dest_device_mac: null,
    dest_port: null,
    dest_label: "Server Room",
    patch_panel_id: null,
    patch_panel_port: null,
    cable_type: "fiber-om3",
    length_m: null,
    color: "",
    label: "C-003",
    speed: 10000,
    poe: false,
    status: "faulty",
    notes: "Broken connector",
    source_device_name: "Switch-02",
    dest_device_name: null,
    patch_panel_name: null,
  },
];

const samplePanels = [
  {
    id: 1,
    name: "PP-01 Meterkast",
    port_count: 24,
    panel_type: "keystone",
    rack_mounted: true,
    rack_item_id: 5,
    location: "Server Room",
    notes: "Main patch panel",
    assigned_ports: 18,
  },
  {
    id: 2,
    name: "PP-02 Office",
    port_count: 12,
    panel_type: "fixed",
    rack_mounted: false,
    rack_item_id: null,
    location: "Office closet",
    notes: "",
    assigned_ports: 4,
  },
];

beforeEach(() => {
  cablesMock.data = [...sampleCables];
  cablesMock.isLoading = false;
  cablesMock.error = null;
  panelsMock.data = [...samplePanels];
  panelsMock.isLoading = false;
  panelsMock.error = null;
  createCableMock.mutate = vi.fn();
  updateCableMock.mutate = vi.fn();
  deleteCableMock.mutate = vi.fn();
  syncCablesMock.mutate = vi.fn();
  syncCablesMock.isPending = false;
  createPanelMock.mutate = vi.fn();
  updatePanelMock.mutate = vi.fn();
  deletePanelMock.mutate = vi.fn();
});

describe("CablingModule", () => {
  describe("View toggle", () => {
    it("renders both view tabs", () => {
      renderModule();
      expect(screen.getByTestId("tab-cables")).toBeInTheDocument();
      expect(screen.getByTestId("tab-panels")).toBeInTheDocument();
    });

    it("defaults to cable table view", () => {
      renderModule();
      expect(screen.getByTestId("cable-table")).toBeInTheDocument();
    });

    it("switches to patch panels view when tab is clicked", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      expect(screen.getByTestId("panel-card-1")).toBeInTheDocument();
      expect(screen.queryByTestId("cable-table")).not.toBeInTheDocument();
    });

    it("switches back to cables view", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      fireEvent.click(screen.getByTestId("tab-cables"));
      expect(screen.getByTestId("cable-table")).toBeInTheDocument();
    });
  });

  describe("Loading and error states", () => {
    it("shows loading state", () => {
      cablesMock.data = undefined;
      cablesMock.isLoading = true;
      panelsMock.data = undefined;
      panelsMock.isLoading = true;
      renderModule();
      expect(screen.getByText("Loading cabling data...")).toBeInTheDocument();
    });

    it("shows error state for Error objects", () => {
      cablesMock.data = undefined;
      cablesMock.error = new Error("Network error");
      renderModule();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    it("shows fallback error for non-Error objects", () => {
      cablesMock.data = undefined;
      cablesMock.error = { message: "" } as Error;
      renderModule();
      expect(screen.getByText("Failed to load cabling data")).toBeInTheDocument();
    });
  });

  describe("Cable Table", () => {
    it("renders cable rows with correct data", () => {
      renderModule();
      expect(screen.getByTestId("cable-row-1")).toBeInTheDocument();
      expect(screen.getByTestId("cable-row-2")).toBeInTheDocument();
      expect(screen.getByTestId("cable-row-3")).toBeInTheDocument();
    });

    it("displays cable labels", () => {
      renderModule();
      expect(screen.getByText("C-001")).toBeInTheDocument();
      expect(screen.getByText("C-002")).toBeInTheDocument();
      expect(screen.getByText("C-003")).toBeInTheDocument();
    });

    it("displays source device names", () => {
      renderModule();
      expect(screen.getByText("Switch-01")).toBeInTheDocument();
      expect(screen.getByText("Switch-02")).toBeInTheDocument();
    });

    it("displays destination info", () => {
      renderModule();
      expect(screen.getByText("Gateway")).toBeInTheDocument();
      expect(screen.getByText("Office 201-A")).toBeInTheDocument();
    });

    it("displays cable types", () => {
      renderModule();
      const cells = screen.getAllByText("cat6");
      expect(cells.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("cat6a")).toBeInTheDocument();
      expect(screen.getByText("fiber-om3")).toBeInTheDocument();
    });

    it("displays formatted speed", () => {
      renderModule();
      expect(screen.getByText("1G")).toBeInTheDocument();
      expect(screen.getByText("10G")).toBeInTheDocument();
    });

    it("displays formatted length", () => {
      renderModule();
      expect(screen.getByText("3.5m")).toBeInTheDocument();
      expect(screen.getByText("15m")).toBeInTheDocument();
    });

    it("displays cable status with dot", () => {
      renderModule();
      // Status text appears in both table cells and filter options, so use getAllByText
      expect(screen.getAllByText("active").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("spare").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("faulty").length).toBeGreaterThanOrEqual(1);
    });

    it("displays patch panel via column", () => {
      renderModule();
      expect(screen.getByText("PP-01 #5")).toBeInTheDocument();
    });

    it("has sync button", () => {
      renderModule();
      expect(screen.getByTestId("sync-button")).toBeInTheDocument();
      expect(screen.getByText("Sync from Topology")).toBeInTheDocument();
    });

    it("has add cable button", () => {
      renderModule();
      expect(screen.getByTestId("add-cable-button")).toBeInTheDocument();
    });

    it("sync button triggers sync", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("sync-button"));
      expect(syncCablesMock.mutate).toHaveBeenCalled();
    });

    it("shows syncing state on sync button", () => {
      syncCablesMock.isPending = true;
      renderModule();
      expect(screen.getByText("Syncing...")).toBeInTheDocument();
    });

    it("filters cables by status", () => {
      renderModule();
      const filter = screen.getByTestId("status-filter");
      fireEvent.change(filter, { target: { value: "active" } });
      expect(screen.getByTestId("cable-row-1")).toBeInTheDocument();
      expect(screen.queryByTestId("cable-row-2")).not.toBeInTheDocument();
      expect(screen.queryByTestId("cable-row-3")).not.toBeInTheDocument();
    });

    it("sorts cables by clicking column header", () => {
      renderModule();
      const typeHeader = screen.getByText(/^Type/);
      fireEvent.click(typeHeader);
      const rows = screen.getAllByTestId(/^cable-row-/);
      expect(rows.length).toBe(3);
    });

    it("shows empty state when no cables match filter", () => {
      cablesMock.data = [];
      renderModule();
      expect(screen.getByText("No cables found")).toBeInTheDocument();
    });
  });

  describe("Cable edit/add flow", () => {
    it("clicking a cable row opens edit panel", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      expect(screen.getByTestId("cable-edit-panel")).toBeInTheDocument();
      expect(screen.getByText("Edit Cable")).toBeInTheDocument();
    });

    it("edit panel has delete button for existing cables", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      expect(screen.getByTestId("cable-delete-button")).toBeInTheDocument();
    });

    it("clicking add cable button opens add panel", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("add-cable-button"));
      expect(screen.getByTestId("cable-edit-panel")).toBeInTheDocument();
      // Title "Add Cable" appears in both the button and the panel header
      expect(screen.getAllByText("Add Cable").length).toBe(2);
    });

    it("add panel does not have delete button", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("add-cable-button"));
      expect(screen.queryByTestId("cable-delete-button")).not.toBeInTheDocument();
    });

    it("save button calls create for new cables", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("add-cable-button"));
      fireEvent.click(screen.getByTestId("cable-save-button"));
      expect(createCableMock.mutate).toHaveBeenCalled();
    });

    it("save button calls update for existing cables", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      fireEvent.click(screen.getByTestId("cable-save-button"));
      expect(updateCableMock.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        expect.any(Object),
      );
    });

    it("delete button calls delete mutation", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      fireEvent.click(screen.getByTestId("cable-delete-button"));
      expect(deleteCableMock.mutate).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it("close button closes the edit panel", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      expect(screen.getByTestId("cable-edit-panel")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Close"));
      expect(screen.queryByTestId("cable-edit-panel")).not.toBeInTheDocument();
    });

    it("edit panel form fields are populated", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      const labelInput = screen.getByLabelText("Label") as HTMLInputElement;
      expect(labelInput.value).toBe("C-001");
    });
  });

  describe("Patch Panels view", () => {
    function switchToPanels() {
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
    }

    it("renders panel cards with correct data", () => {
      switchToPanels();
      expect(screen.getByTestId("panel-card-1")).toBeInTheDocument();
      expect(screen.getByTestId("panel-card-2")).toBeInTheDocument();
    });

    it("shows panel name on card", () => {
      switchToPanels();
      expect(screen.getByText("PP-01 Meterkast")).toBeInTheDocument();
      expect(screen.getByText("PP-02 Office")).toBeInTheDocument();
    });

    it("shows port utilization badge", () => {
      switchToPanels();
      expect(screen.getByText("18/24")).toBeInTheDocument();
      expect(screen.getByText("4/12")).toBeInTheDocument();
    });

    it("shows panel type and location", () => {
      switchToPanels();
      expect(screen.getByText(/keystone/)).toBeInTheDocument();
      expect(screen.getByText(/Server Room/)).toBeInTheDocument();
    });

    it("has new panel button", () => {
      switchToPanels();
      expect(screen.getByTestId("add-panel-button")).toBeInTheDocument();
    });

    it("shows empty state when no panels", () => {
      panelsMock.data = [];
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      expect(screen.getByText("No patch panels yet")).toBeInTheDocument();
    });

    it("clicking expand reveals port grid", () => {
      switchToPanels();
      // Click the card header to expand
      const card = screen.getByTestId("panel-card-1");
      const header = card.querySelector("[role='button']")!;
      fireEvent.click(header);
      expect(screen.getByTestId("panel-ports-1")).toBeInTheDocument();
    });

    it("edit button opens panel edit panel", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("panel-edit-1"));
      expect(screen.getByTestId("panel-edit-panel")).toBeInTheDocument();
      expect(screen.getByText("Edit Panel")).toBeInTheDocument();
    });

    it("new panel button opens add panel", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("add-panel-button"));
      expect(screen.getByTestId("panel-edit-panel")).toBeInTheDocument();
      // "New Panel" appears in both the button and the panel header
      expect(screen.getAllByText("New Panel").length).toBe(2);
    });

    it("save calls create for new panels", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("add-panel-button"));
      const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "PP-03" } });
      fireEvent.click(screen.getByTestId("panel-save-button"));
      expect(createPanelMock.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "PP-03" }),
        expect.any(Object),
      );
    });

    it("save calls update for existing panels", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("panel-edit-1"));
      fireEvent.click(screen.getByTestId("panel-save-button"));
      expect(updatePanelMock.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        expect.any(Object),
      );
    });

    it("delete button calls delete mutation", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("panel-edit-1"));
      fireEvent.click(screen.getByTestId("panel-delete-button"));
      expect(deletePanelMock.mutate).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it("save button is disabled when panel name is empty", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("add-panel-button"));
      const saveBtn = screen.getByTestId("panel-save-button");
      expect(saveBtn).toBeDisabled();
    });

    it("close button closes panel edit", () => {
      switchToPanels();
      fireEvent.click(screen.getByTestId("panel-edit-1"));
      expect(screen.getByTestId("panel-edit-panel")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Close"));
      expect(screen.queryByTestId("panel-edit-panel")).not.toBeInTheDocument();
    });
  });

  describe("Cable form field interactions", () => {
    function openAddCable() {
      renderModule();
      fireEvent.click(screen.getByTestId("add-cable-button"));
    }

    it("cable type select works", () => {
      openAddCable();
      const select = screen.getByLabelText("Cable Type") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "cat6a" } });
      expect(select.value).toBe("cat6a");
    });

    it("status select works", () => {
      openAddCable();
      const select = screen.getByLabelText("Status") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "faulty" } });
      expect(select.value).toBe("faulty");
    });

    it("length input works with empty value", () => {
      openAddCable();
      const input = screen.getByLabelText("Length (m)") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
    });

    it("length input works with numeric value", () => {
      openAddCable();
      const input = screen.getByLabelText("Length (m)") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "5.5" } });
      expect(input.value).toBe("5.5");
    });

    it("speed input works with empty value", () => {
      openAddCable();
      const input = screen.getByLabelText("Speed (Mbps)") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
    });

    it("speed input works with numeric value", () => {
      openAddCable();
      const input = screen.getByLabelText("Speed (Mbps)") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "1000" } });
      expect(input.value).toBe("1000");
    });

    it("color input works", () => {
      openAddCable();
      const input = screen.getByLabelText("Color") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "red" } });
      expect(input.value).toBe("red");
    });

    it("poe select works", () => {
      openAddCable();
      const select = screen.getByLabelText("PoE") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "true" } });
      expect(select.value).toBe("true");
    });

    it("dest label input works", () => {
      openAddCable();
      const input = screen.getByLabelText("Dest Label") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Room 102" } });
      expect(input.value).toBe("Room 102");
    });

    it("patch panel select works", () => {
      openAddCable();
      const select = screen.getByLabelText("Patch Panel") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "1" } });
      expect(select.value).toBe("1");
    });

    it("patch panel select can be cleared", () => {
      openAddCable();
      const select = screen.getByLabelText("Patch Panel") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "1" } });
      fireEvent.change(select, { target: { value: "" } });
      expect(select.value).toBe("");
    });

    it("panel port input works with empty value", () => {
      openAddCable();
      const input = screen.getByLabelText("Panel Port") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
    });

    it("panel port input works with numeric value", () => {
      openAddCable();
      const input = screen.getByLabelText("Panel Port") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "5" } });
      expect(input.value).toBe("5");
    });

    it("notes input works", () => {
      openAddCable();
      const input = screen.getByLabelText("Notes") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "test note" } });
      expect(input.value).toBe("test note");
    });
  });

  describe("Panel form field interactions", () => {
    function openAddPanel() {
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      fireEvent.click(screen.getByTestId("add-panel-button"));
    }

    it("port count input works", () => {
      openAddPanel();
      const input = screen.getByLabelText("Port Count") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "48" } });
      expect(input.value).toBe("48");
    });

    it("panel type select works", () => {
      openAddPanel();
      const select = screen.getByLabelText("Type") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "fiber" } });
      expect(select.value).toBe("fiber");
    });

    it("location input works", () => {
      openAddPanel();
      const input = screen.getByLabelText("Location") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Basement" } });
      expect(input.value).toBe("Basement");
    });

    it("notes input works", () => {
      openAddPanel();
      const input = screen.getByLabelText("Notes") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "test" } });
      expect(input.value).toBe("test");
    });
  });

  describe("Sort behavior", () => {
    it("clicking same column header toggles sort direction", () => {
      renderModule();
      const labelHeader = screen.getByText(/^Label/);
      fireEvent.click(labelHeader);
      fireEvent.click(labelHeader);
      const rows = screen.getAllByTestId(/^cable-row-/);
      expect(rows.length).toBe(3);
    });

    it("clicking different column header changes sort field", () => {
      renderModule();
      const speedHeader = screen.getByText(/^Speed/);
      fireEvent.click(speedHeader);
      const rows = screen.getAllByTestId(/^cable-row-/);
      expect(rows.length).toBe(3);
    });

    it("clicking Source header sorts by source", () => {
      renderModule();
      fireEvent.click(screen.getByText(/^Source/));
      expect(screen.getAllByTestId(/^cable-row-/).length).toBe(3);
    });

    it("clicking Destination header sorts by destination", () => {
      renderModule();
      fireEvent.click(screen.getByText(/^Destination/));
      expect(screen.getAllByTestId(/^cable-row-/).length).toBe(3);
    });

    it("clicking Length header sorts by length", () => {
      renderModule();
      fireEvent.click(screen.getByText(/^Length/));
      expect(screen.getAllByTestId(/^cable-row-/).length).toBe(3);
    });

    it("clicking Status header sorts by status", () => {
      renderModule();
      fireEvent.click(screen.getByText(/^Status/));
      expect(screen.getAllByTestId(/^cable-row-/).length).toBe(3);
    });

    it("sort indicator shows ascending arrow for active column", () => {
      renderModule();
      // Label is default sort field
      expect(screen.getByText(/Label.*\u2191/)).toBeInTheDocument();
    });

    it("sort indicator shows descending arrow after second click", () => {
      renderModule();
      fireEvent.click(screen.getByText(/^Label/));
      expect(screen.getByText(/Label.*\u2193/)).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles cable with no source device name falling back to mac", () => {
      cablesMock.data = [{
        id: 10,
        source_device_mac: "ff:ff:ff:ff:ff:ff",
        source_port: 1,
        dest_device_mac: null,
        dest_port: null,
        dest_label: "",
        patch_panel_id: null,
        patch_panel_port: null,
        cable_type: "cat6",
        length_m: null,
        color: "",
        label: "C-010",
        speed: null,
        poe: false,
        status: "active",
        notes: "",
        source_device_name: null,
        dest_device_name: null,
        patch_panel_name: null,
      }];
      renderModule();
      expect(screen.getByText("ff:ff:ff:ff:ff:ff")).toBeInTheDocument();
    });

    it("displays speed in Mbps format for speeds under 1000", () => {
      cablesMock.data = [{
        id: 13,
        source_device_mac: null,
        source_port: null,
        dest_device_mac: null,
        dest_port: null,
        dest_label: "Test",
        patch_panel_id: null,
        patch_panel_port: null,
        cable_type: "cat5e",
        length_m: null,
        color: "",
        label: "C-013",
        speed: 100,
        poe: false,
        status: "active",
        notes: "",
        source_device_name: null,
        dest_device_name: null,
        patch_panel_name: null,
      }];
      renderModule();
      expect(screen.getByText("100M")).toBeInTheDocument();
    });

    it("handles cable with patch panel but no port number", () => {
      cablesMock.data = [{
        id: 11,
        source_device_mac: null,
        source_port: null,
        dest_device_mac: null,
        dest_port: null,
        dest_label: "",
        patch_panel_id: 1,
        patch_panel_port: null,
        cable_type: "cat6",
        length_m: null,
        color: "",
        label: "C-011",
        speed: null,
        poe: false,
        status: "active",
        notes: "",
        source_device_name: null,
        dest_device_name: null,
        patch_panel_name: "PP-01",
      }];
      renderModule();
      expect(screen.getByText("PP-01")).toBeInTheDocument();
    });

    it("handles cable with patch panel id but no panel name", () => {
      cablesMock.data = [{
        id: 12,
        source_device_mac: null,
        source_port: null,
        dest_device_mac: null,
        dest_port: null,
        dest_label: "",
        patch_panel_id: 99,
        patch_panel_port: 3,
        cable_type: "cat6",
        length_m: null,
        color: "",
        label: "C-012",
        speed: null,
        poe: false,
        status: "active",
        notes: "",
        source_device_name: null,
        dest_device_name: null,
        patch_panel_name: null,
      }];
      panelsMock.data = [];
      renderModule();
      expect(screen.getByText("Panel 99 #3")).toBeInTheDocument();
    });

    it("handles panel card expand via keyboard Enter", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      const card = screen.getByTestId("panel-card-1");
      const header = card.querySelector("[role='button']")!;
      fireEvent.keyDown(header, { key: "Enter" });
      expect(screen.getByTestId("panel-ports-1")).toBeInTheDocument();
    });

    it("handles panel card expand via keyboard Space", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      const card = screen.getByTestId("panel-card-2");
      const header = card.querySelector("[role='button']")!;
      fireEvent.keyDown(header, { key: " " });
      expect(screen.getByTestId("panel-ports-2")).toBeInTheDocument();
    });

    it("panel with zero ports shows 0% fill", () => {
      panelsMock.data = [{
        id: 5,
        name: "Empty Panel",
        port_count: 0,
        panel_type: "keystone",
        rack_mounted: false,
        rack_item_id: null,
        location: "",
        notes: "",
        assigned_ports: 0,
      }];
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      expect(screen.getByText("Empty Panel")).toBeInTheDocument();
      expect(screen.getByText("0/0")).toBeInTheDocument();
    });

    it("backdrop click closes cable edit panel", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-1"));
      expect(screen.getByTestId("cable-edit-panel")).toBeInTheDocument();
      const backdrop = screen.getByRole("presentation");
      fireEvent.click(backdrop);
      expect(screen.queryByTestId("cable-edit-panel")).not.toBeInTheDocument();
    });

    it("edit panel for cable with all null values populates defaults", () => {
      cablesMock.data = [{
        id: 20,
        source_device_mac: null,
        source_port: null,
        dest_device_mac: null,
        dest_port: null,
        dest_label: "",
        patch_panel_id: null,
        patch_panel_port: null,
        cable_type: "cat6",
        length_m: null,
        color: "",
        label: "",
        speed: null,
        poe: false,
        status: "disconnected",
        notes: "",
        source_device_name: null,
        dest_device_name: null,
        patch_panel_name: null,
      }];
      renderModule();
      fireEvent.click(screen.getByTestId("cable-row-20"));
      const labelInput = screen.getByLabelText("Label") as HTMLInputElement;
      expect(labelInput.value).toBe("");
      const typeSelect = screen.getByLabelText("Cable Type") as HTMLSelectElement;
      expect(typeSelect.value).toBe("cat6");
    });

    it("panel without location does not show separator", () => {
      panelsMock.data = [{
        id: 3,
        name: "No Loc",
        port_count: 12,
        panel_type: "fixed",
        rack_mounted: false,
        rack_item_id: null,
        location: "",
        notes: "",
        assigned_ports: 0,
      }];
      renderModule();
      fireEvent.click(screen.getByTestId("tab-panels"));
      const card = screen.getByTestId("panel-card-3");
      expect(card.textContent).not.toContain(" / ");
    });
  });
});
