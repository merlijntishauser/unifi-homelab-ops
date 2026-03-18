import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RackPlannerModule from "./RackPlannerModule";
import { api } from "../api/client";

const racksMock = vi.hoisted(() => ({
  data: undefined as Array<Record<string, unknown>> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const rackMock = vi.hoisted(() => ({
  data: undefined as Record<string, unknown> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const createRackMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const deleteRackMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const addItemMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const deleteItemMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const moveItemMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

const importMock = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useRacks: () => racksMock,
    useRack: () => rackMock,
    useCreateRack: () => createRackMock,
    useDeleteRack: () => deleteRackMock,
    useAddRackItem: () => addItemMock,
    useDeleteRackItem: () => deleteItemMock,
    useMoveRackItem: () => moveItemMock,
    useImportRackFromTopology: () => importMock,
  };
});

vi.mock("../api/client", async () => {
  const actual = await vi.importActual("../api/client");
  return {
    ...actual,
    api: {
      ...(actual as Record<string, unknown>).api,
      getRackBom: vi.fn().mockResolvedValue({
        rack_name: "Main Rack",
        entries: [
          { item_type: "switch", label: "USW-24", quantity: 1, notes: "" },
        ],
      }),
    },
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
        <RackPlannerModule />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleRacks = [
  { id: 1, name: "Main Rack", size: "19-inch", height_u: 12, location: "Office", item_count: 3, used_u: 5, total_power: 45.2 },
  { id: 2, name: "Closet Rack", size: "10-inch", height_u: 6, location: "", item_count: 1, used_u: 1, total_power: 12.0 },
];

const sampleRack = {
  id: 1,
  name: "Main Rack",
  size: "19-inch",
  height_u: 12,
  location: "Office",
  total_power: 45.2,
  used_u: 2,
  items: [
    {
      id: 10,
      position_u: 1,
      height_u: 1,
      device_type: "switch",
      label: "USW-24-PoE",
      power_watts: 30.0,
      device_mac: null,
      notes: "",
      device_name: null,
      device_model: null,
      device_status: null,
    },
    {
      id: 11,
      position_u: 3,
      height_u: 2,
      device_type: "gateway",
      label: "UDM-Pro",
      power_watts: 15.2,
      device_mac: "aa:bb:cc",
      notes: "Main gateway",
      device_name: "Gateway",
      device_model: "UDM-Pro",
      device_status: "online",
    },
  ],
};

beforeEach(() => {
  racksMock.data = [...sampleRacks];
  racksMock.isLoading = false;
  racksMock.error = null;
  rackMock.data = undefined;
  rackMock.isLoading = false;
  rackMock.error = null;
  createRackMock.mutate = vi.fn();
  deleteRackMock.mutate = vi.fn();
  addItemMock.mutate = vi.fn();
  deleteItemMock.mutate = vi.fn();
  moveItemMock.mutate = vi.fn();
  importMock.mutate = vi.fn();
});

describe("RackPlannerModule", () => {
  describe("RackOverview", () => {
    it("renders rack overview when no rack is selected", () => {
      renderModule();
      expect(screen.getByText("Rack Planner")).toBeInTheDocument();
      expect(screen.getByTestId("new-rack-button")).toBeInTheDocument();
    });

    it("renders rack cards with mocked data", () => {
      renderModule();
      expect(screen.getByTestId("rack-card-1")).toBeInTheDocument();
      expect(screen.getByTestId("rack-card-2")).toBeInTheDocument();
      expect(screen.getByText("Main Rack")).toBeInTheDocument();
      expect(screen.getByText("Closet Rack")).toBeInTheDocument();
    });

    it("displays rack size, height, and location on cards", () => {
      renderModule();
      expect(screen.getByText(/19-inch \/ 12U/)).toBeInTheDocument();
      expect(screen.getByText(/Office/)).toBeInTheDocument();
    });

    it("displays power draw on cards", () => {
      renderModule();
      expect(screen.getByText("45.2W")).toBeInTheDocument();
      expect(screen.getByText("12.0W")).toBeInTheDocument();
    });

    it("displays device count on cards", () => {
      renderModule();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("shows fill bar percentage", () => {
      renderModule();
      expect(screen.getByText("5/12U (42%)")).toBeInTheDocument();
    });

    it("clicking a rack card opens the editor", () => {
      rackMock.data = { ...sampleRack };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
      // Should show editor toolbar with Back button
      expect(screen.getByTestId("back-button")).toBeInTheDocument();
    });

    it("shows empty state when no racks", () => {
      racksMock.data = [];
      renderModule();
      expect(screen.getByText("No racks yet")).toBeInTheDocument();
      expect(screen.getByText("Create Your First Rack")).toBeInTheDocument();
    });

    it("shows loading state when racks are loading", () => {
      racksMock.data = undefined;
      racksMock.isLoading = true;
      renderModule();
      expect(screen.getByText("Loading racks...")).toBeInTheDocument();
    });

    it("shows error state when racks query fails", () => {
      racksMock.data = undefined;
      racksMock.error = new Error("Connection refused");
      renderModule();
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });

    it("shows error fallback for non-Error objects", () => {
      racksMock.data = undefined;
      racksMock.error = { message: "" } as Error;
      renderModule();
      expect(screen.getByText("Failed to load racks")).toBeInTheDocument();
    });

    it("New Rack button exists and toggles form", () => {
      renderModule();
      const btn = screen.getByTestId("new-rack-button");
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(screen.getByTestId("new-rack-form")).toBeInTheDocument();
    });

    it("New Rack form can be cancelled", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));
      expect(screen.getByTestId("new-rack-form")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByTestId("new-rack-form")).not.toBeInTheDocument();
    });

    it("New Rack form Create button is disabled when name is empty", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));
      const createBtn = screen.getByText("Create");
      expect(createBtn).toBeDisabled();
    });

    it("New Rack form submits with valid data", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));
      const nameInput = screen.getByPlaceholderText("e.g. Main Rack");
      fireEvent.change(nameInput, { target: { value: "Test Rack" } });
      fireEvent.click(screen.getByText("Create"));
      expect(createRackMock.mutate).toHaveBeenCalledWith(
        { name: "Test Rack", size: "19-inch", height_u: 12, location: "" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });

  describe("RackEditor", () => {
    function openEditor() {
      rackMock.data = { ...sampleRack };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
    }

    it("shows back button that returns to overview", () => {
      openEditor();
      expect(screen.getByTestId("back-button")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("back-button"));
      // Should return to overview
      expect(screen.getByText("Rack Planner")).toBeInTheDocument();
    });

    it("shows rack name and details in toolbar", () => {
      openEditor();
      expect(screen.getByText("Main Rack")).toBeInTheDocument();
      expect(screen.getByText(/19-inch \/ 12U \/ 45.2W/)).toBeInTheDocument();
    });

    it("shows rack grid with rack items", () => {
      openEditor();
      expect(screen.getByTestId("rack-grid")).toBeInTheDocument();
      expect(screen.getByTestId("rack-item-10")).toBeInTheDocument();
      expect(screen.getByTestId("rack-item-11")).toBeInTheDocument();
      expect(screen.getByText("USW-24-PoE")).toBeInTheDocument();
      expect(screen.getByText("UDM-Pro")).toBeInTheDocument();
    });

    it("shows empty slots as dashed borders", () => {
      openEditor();
      // Slot at U2 should be empty (item at 1, item at 3-4, rest empty)
      expect(screen.getByTestId("empty-slot-2")).toBeInTheDocument();
    });

    it("shows power watts on items", () => {
      openEditor();
      expect(screen.getByText("30.0W")).toBeInTheDocument();
      expect(screen.getByText("15.2W")).toBeInTheDocument();
    });

    it("has Add Item button that shows form", () => {
      openEditor();
      const btn = screen.getByTestId("add-item-button");
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(screen.getByTestId("add-item-form")).toBeInTheDocument();
    });

    it("has Import from Topology button", () => {
      openEditor();
      const btn = screen.getByTestId("import-button");
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(importMock.mutate).toHaveBeenCalledWith(1);
    });

    it("has Bill of Materials button", async () => {
      openEditor();
      const btn = screen.getByTestId("bom-button");
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByTestId("bom-view")).toBeInTheDocument();
      });
      expect(screen.getByText("Bill of Materials: Main Rack")).toBeInTheDocument();
    });

    it("has Delete Rack button", () => {
      openEditor();
      const btn = screen.getByTestId("delete-rack-button");
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(deleteRackMock.mutate).toHaveBeenCalledWith(1, expect.objectContaining({ onSuccess: expect.any(Function) }));
    });

    it("can delete an item via the delete button", () => {
      openEditor();
      const deleteBtn = screen.getByLabelText("Delete USW-24-PoE");
      fireEvent.click(deleteBtn);
      expect(deleteItemMock.mutate).toHaveBeenCalledWith({ rackId: 1, itemId: 10 });
    });

    it("Add Item form submits with valid data", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const labelInput = screen.getByPlaceholderText("e.g. USW-24-PoE");
      fireEvent.change(labelInput, { target: { value: "New Switch" } });
      fireEvent.click(screen.getByText("Add"));
      expect(addItemMock.mutate).toHaveBeenCalledWith(
        {
          rackId: 1,
          data: {
            label: "New Switch",
            device_type: "other",
            height_u: 1,
            position_u: 1,
            power_watts: 0,
            notes: "",
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("Add Item form cancel hides the form", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      expect(screen.getByTestId("add-item-form")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByTestId("add-item-form")).not.toBeInTheDocument();
    });

    it("shows loading state while rack is loading", () => {
      rackMock.data = undefined;
      rackMock.isLoading = true;
      racksMock.data = [...sampleRacks];
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
      expect(screen.getByText("Loading rack...")).toBeInTheDocument();
    });

    it("BOM view can be closed", async () => {
      openEditor();
      fireEvent.click(screen.getByTestId("bom-button"));
      await waitFor(() => {
        expect(screen.getByTestId("bom-view")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Close"));
      expect(screen.queryByTestId("bom-view")).not.toBeInTheDocument();
    });

    it("BOM view shows entries table", async () => {
      openEditor();
      fireEvent.click(screen.getByTestId("bom-button"));
      await waitFor(() => {
        expect(screen.getByText("USW-24")).toBeInTheDocument();
      });
    });

    it("BOM view shows empty state when no entries", async () => {
      vi.mocked(api.getRackBom).mockResolvedValueOnce({
        rack_name: "Main Rack",
        entries: [],
      });
      openEditor();
      fireEvent.click(screen.getByTestId("bom-button"));
      await waitFor(() => {
        expect(screen.getByTestId("bom-view")).toBeInTheDocument();
      });
      expect(screen.getByText("No items in rack.")).toBeInTheDocument();
    });

    it("drag start sets data transfer on rack item", () => {
      openEditor();
      const item = screen.getByTestId("rack-item-10");
      const setData = vi.fn();
      fireEvent.dragStart(item, {
        dataTransfer: { effectAllowed: "", setData },
      });
      expect(setData).toHaveBeenCalledWith("text/plain", "10");
    });

    it("drag over on empty slot runs without error", () => {
      openEditor();
      const slot = screen.getByTestId("empty-slot-2");
      // dragOver handler calls e.preventDefault() and sets dropEffect.
      // jsdom does not provide dataTransfer on synthetic drag events,
      // so we create a minimal event manually.
      const event = new Event("dragover", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { dropEffect: "" },
      });
      slot.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it("drop on empty slot moves item to new position", () => {
      openEditor();
      // First drag start an item to set dragItemId
      const item = screen.getByTestId("rack-item-10");
      fireEvent.dragStart(item, {
        dataTransfer: { effectAllowed: "", setData: vi.fn() },
      });
      // Then drop on empty slot 2
      const slot = screen.getByTestId("empty-slot-2");
      fireEvent.drop(slot, {
        dataTransfer: { getData: () => "10" },
      });
      expect(moveItemMock.mutate).toHaveBeenCalledWith({
        rackId: 1,
        itemId: 10,
        positionU: 2,
      });
    });

    it("drop on different position triggers move for another item", () => {
      rackMock.data = {
        ...sampleRack,
        height_u: 12,
        items: [
          {
            id: 20,
            position_u: 5,
            height_u: 1,
            device_type: "switch",
            label: "Test Switch",
            power_watts: 10,
            device_mac: null,
            notes: "",
            device_name: null,
            device_model: null,
            device_status: null,
          },
        ],
      };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));

      const dragItem = screen.getByTestId("rack-item-20");
      fireEvent.dragStart(dragItem, {
        dataTransfer: { effectAllowed: "", setData: vi.fn() },
      });
      const emptySlot = screen.getByTestId("empty-slot-4");
      fireEvent.drop(emptySlot, {
        dataTransfer: { getData: () => "20" },
      });
      expect(moveItemMock.mutate).toHaveBeenCalledWith({
        rackId: 1,
        itemId: 20,
        positionU: 4,
      });
    });

    it("drop resets drag when dragged item is not found in rack", () => {
      openEditor();
      // Drag item 10
      const item = screen.getByTestId("rack-item-10");
      fireEvent.dragStart(item, {
        dataTransfer: { effectAllowed: "", setData: vi.fn() },
      });
      // Mutate the mock so item 10 is no longer in the items list
      // This simulates the item being deleted while dragging
      (rackMock.data as Record<string, unknown>).items = [
        { ...sampleRack.items[1] },
      ];
      // Force re-render by updating the mock and triggering state change
      // The drop handler captures rack from the closure, but we changed rackMock.data
      // which is returned by useRack(). Since the mock returns the same object reference,
      // the component won't re-render. Instead, we need the drop handler to use the
      // current rack. The handleDrop closure captures rack at render time.
      // So we need to trigger a re-render first.
      // Toggle add form to trigger re-render
      fireEvent.click(screen.getByTestId("add-item-button"));
      // Now drop on an empty slot -- item 10 won't be found
      const slot = screen.getByTestId("empty-slot-2");
      fireEvent.drop(slot, {
        dataTransfer: { getData: () => "10" },
      });
      expect(moveItemMock.mutate).not.toHaveBeenCalled();
    });

    it("drop without prior drag start does not call move", () => {
      openEditor();
      // Drop on empty slot without starting a drag (dragItemId is null)
      const slot = screen.getByTestId("empty-slot-2");
      fireEvent.drop(slot, {
        dataTransfer: { getData: () => "" },
      });
      expect(moveItemMock.mutate).not.toHaveBeenCalled();
    });

    it("hides item power display when power_watts is 0", () => {
      rackMock.data = {
        ...sampleRack,
        items: [
          {
            id: 30,
            position_u: 1,
            height_u: 1,
            device_type: "shelf",
            label: "Empty Shelf",
            power_watts: 0,
            device_mac: null,
            notes: "",
            device_name: null,
            device_model: null,
            device_status: null,
          },
        ],
      };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
      expect(screen.getByText("Empty Shelf")).toBeInTheDocument();
      // No wattage text should appear for this item
      expect(screen.queryByText("0.0W")).not.toBeInTheDocument();
    });

    it("renders rack with no items (all empty slots)", () => {
      rackMock.data = {
        ...sampleRack,
        height_u: 4,
        items: [],
      };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
      expect(screen.getByTestId("empty-slot-1")).toBeInTheDocument();
      expect(screen.getByTestId("empty-slot-2")).toBeInTheDocument();
      expect(screen.getByTestId("empty-slot-3")).toBeInTheDocument();
      expect(screen.getByTestId("empty-slot-4")).toBeInTheDocument();
    });

    it("Add Item form allows changing all fields", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const form = screen.getByTestId("add-item-form");

      // Change label
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), {
        target: { value: "Custom Device" },
      });

      // Change device type
      const typeSelect = form.querySelector("select")!;
      fireEvent.change(typeSelect, { target: { value: "gateway" } });

      // Get all number inputs: height_u, position_u, power_watts
      const numberInputs = form.querySelectorAll<HTMLInputElement>("input[type='number']");
      // height_u (index 0), position_u (index 1), power_watts (index 2)
      fireEvent.change(numberInputs[0], { target: { value: "2" } });
      fireEvent.change(numberInputs[1], { target: { value: "3" } });
      fireEvent.change(numberInputs[2], { target: { value: "25.5" } });

      // Change notes -- last text input in the form
      const textInputs = form.querySelectorAll<HTMLInputElement>("input[type='text']");
      fireEvent.change(textInputs[1], { target: { value: "Test note" } });

      fireEvent.click(screen.getByText("Add"));
      expect(addItemMock.mutate).toHaveBeenCalledWith(
        {
          rackId: 1,
          data: {
            label: "Custom Device",
            device_type: "gateway",
            height_u: 2,
            position_u: 3,
            power_watts: 25.5,
            notes: "Test note",
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("Add Item form height defaults to 1 on invalid input", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const form = screen.getByTestId("add-item-form");
      const numberInputs = form.querySelectorAll<HTMLInputElement>("input[type='number']");
      // Set height to invalid value (NaN from parseInt)
      fireEvent.change(numberInputs[0], { target: { value: "" } });
      expect(numberInputs[0].value).toBe("1");
    });

    it("Add Item form position defaults to 1 on invalid input", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const form = screen.getByTestId("add-item-form");
      const numberInputs = form.querySelectorAll<HTMLInputElement>("input[type='number']");
      // Set position to invalid value (NaN from parseInt)
      fireEvent.change(numberInputs[1], { target: { value: "" } });
      expect(numberInputs[1].value).toBe("1");
    });

    it("Add Item form power defaults to 0 on invalid input", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const form = screen.getByTestId("add-item-form");
      const numberInputs = form.querySelectorAll<HTMLInputElement>("input[type='number']");
      // Set power to invalid value (NaN from parseFloat)
      fireEvent.change(numberInputs[2], { target: { value: "" } });
      expect(numberInputs[2].value).toBe("0");
    });

    it("Add Item form Add button is disabled when label is empty", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const addBtn = screen.getByText("Add");
      expect(addBtn).toBeDisabled();
    });

    it("Add Item form does not submit with whitespace-only label", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), {
        target: { value: "   " },
      });
      fireEvent.click(screen.getByText("Add"));
      expect(addItemMock.mutate).not.toHaveBeenCalled();
    });

    it("createRack onSuccess hides the form", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));
      fireEvent.change(screen.getByPlaceholderText("e.g. Main Rack"), {
        target: { value: "New Rack" },
      });
      fireEvent.click(screen.getByText("Create"));
      // Extract the onSuccess callback and call it
      const call = createRackMock.mutate.mock.calls[0];
      const onSuccess = call[1].onSuccess;
      act(() => onSuccess());
      expect(screen.queryByTestId("new-rack-form")).not.toBeInTheDocument();
    });

    it("addItem onSuccess hides the add form", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), {
        target: { value: "Item" },
      });
      fireEvent.click(screen.getByText("Add"));
      // Extract the onSuccess callback and call it
      const call = addItemMock.mutate.mock.calls[0];
      const onSuccess = call[1].onSuccess;
      act(() => onSuccess());
      expect(screen.queryByTestId("add-item-form")).not.toBeInTheDocument();
    });

    it("deleteRack onSuccess navigates back", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("delete-rack-button"));
      const call = deleteRackMock.mutate.mock.calls[0];
      const onSuccess = call[1].onSuccess;
      // Reset rack overview data so we can verify navigation
      rackMock.data = undefined;
      act(() => onSuccess());
      expect(screen.getByText("Rack Planner")).toBeInTheDocument();
    });

    it("renders device type labels for various types", () => {
      rackMock.data = {
        ...sampleRack,
        height_u: 8,
        items: [
          { id: 40, position_u: 1, height_u: 1, device_type: "ups", label: "CyberPower", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null },
          { id: 41, position_u: 2, height_u: 1, device_type: "patch-panel", label: "PP-24", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null },
          { id: 42, position_u: 3, height_u: 1, device_type: "ap", label: "U6-LR", power_watts: 8, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null },
          { id: 43, position_u: 4, height_u: 1, device_type: "unknown-type", label: "Mystery Box", power_watts: 5, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null },
        ],
      };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
      expect(screen.getByText("CyberPower")).toBeInTheDocument();
      expect(screen.getByText("PP-24")).toBeInTheDocument();
      expect(screen.getByText("U6-LR")).toBeInTheDocument();
      expect(screen.getByText("Mystery Box")).toBeInTheDocument();
    });

    it("handles multi-U item occupying middle slots", () => {
      // Create overlapping items scenario to trigger the else-if branch (line 610-612)
      // Item A occupies U1-U2, Item B occupies U2-U3 (overlapping at U2)
      // When iterating top-down from U=4: U4 empty, U3 top of B (skip to U1),
      // U1 bottom of A -> else if branch triggered
      rackMock.data = {
        ...sampleRack,
        height_u: 4,
        items: [
          { id: 50, position_u: 1, height_u: 2, device_type: "switch", label: "Overlap-A", power_watts: 10, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null },
          { id: 51, position_u: 2, height_u: 2, device_type: "gateway", label: "Overlap-B", power_watts: 20, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null },
        ],
      };
      renderModule();
      fireEvent.click(screen.getByTestId("rack-card-1"));
      // Both items should render (Overlap-B at top U=3, Overlap-A top U=2 but U=2 was handled by B's skip)
      // The grid should render without crashing
      expect(screen.getByTestId("rack-grid")).toBeInTheDocument();
    });

    it("NewRackForm allows changing size and height fields", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));

      // Change size
      const sizeSelect = screen.getByDisplayValue("19-inch");
      fireEvent.change(sizeSelect, { target: { value: "10-inch" } });

      // Change height
      const heightInput = screen.getByDisplayValue("12");
      fireEvent.change(heightInput, { target: { value: "24" } });

      // Change location
      fireEvent.change(screen.getByPlaceholderText("e.g. Office closet"), {
        target: { value: "Server Room" },
      });

      // Change name and submit
      fireEvent.change(screen.getByPlaceholderText("e.g. Main Rack"), {
        target: { value: "Big Rack" },
      });
      fireEvent.click(screen.getByText("Create"));
      expect(createRackMock.mutate).toHaveBeenCalledWith(
        { name: "Big Rack", size: "10-inch", height_u: 24, location: "Server Room" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("AddItemForm Add click with empty label exercises onClick guard", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      // The Add button is disabled when label is empty. The onClick handler has
      // a defensive if(label.trim()) guard. Since React blocks click events on
      // disabled buttons, we extract the handler via the fiber to exercise it.
      const addBtn = screen.getByText("Add") as HTMLButtonElement;
      const fiberKey = Object.keys(addBtn).find((k) => k.startsWith("__reactFiber"));
      expect(fiberKey).toBeDefined();
      const fiber = (addBtn as unknown as Record<string, unknown>)[fiberKey!] as Record<string, Record<string, unknown>>;
      const onClick = fiber.memoizedProps?.onClick as (() => void) | undefined;
      expect(onClick).toBeDefined();
      onClick!();
      expect(addItemMock.mutate).not.toHaveBeenCalled();
    });

    it("NewRackForm does not submit when name is whitespace only", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));
      fireEvent.change(screen.getByPlaceholderText("e.g. Main Rack"), {
        target: { value: "   " },
      });
      fireEvent.click(screen.getByText("Create"));
      expect(createRackMock.mutate).not.toHaveBeenCalled();
    });

    it("NewRackForm height defaults to 6 on invalid input", () => {
      renderModule();
      fireEvent.click(screen.getByTestId("new-rack-button"));
      const heightInput = screen.getByDisplayValue("12");
      fireEvent.change(heightInput, { target: { value: "abc" } });
      fireEvent.change(screen.getByPlaceholderText("e.g. Main Rack"), {
        target: { value: "Test" },
      });
      fireEvent.click(screen.getByText("Create"));
      expect(createRackMock.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ height_u: 6 }),
        expect.any(Object),
      );
    });
  });

  describe("RackCard", () => {
    it("opens editor on keyboard Enter", () => {
      rackMock.data = { ...sampleRack };
      renderModule();
      const card = screen.getByTestId("rack-card-1");
      fireEvent.keyDown(card, { key: "Enter" });
      expect(screen.getByTestId("back-button")).toBeInTheDocument();
    });

    it("opens editor on keyboard Space", () => {
      rackMock.data = { ...sampleRack };
      renderModule();
      const card = screen.getByTestId("rack-card-1");
      fireEvent.keyDown(card, { key: " " });
      expect(screen.getByTestId("back-button")).toBeInTheDocument();
    });

    it("does not open editor on other keys", () => {
      rackMock.data = { ...sampleRack };
      renderModule();
      const card = screen.getByTestId("rack-card-1");
      fireEvent.keyDown(card, { key: "Tab" });
      expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
    });

    it("handles height_u of 0 without error", () => {
      racksMock.data = [
        { id: 3, name: "Zero Rack", size: "10-inch", height_u: 0, location: "", item_count: 0, used_u: 0, total_power: 0 },
      ];
      renderModule();
      expect(screen.getByText("0/0U (0%)")).toBeInTheDocument();
    });

    it("shows location when provided", () => {
      renderModule();
      // rack 1 has location "Office", rack 2 has empty location
      expect(screen.getByText(/Office/)).toBeInTheDocument();
    });
  });

  describe("popstate navigation", () => {
    it("returns to overview on browser back (popstate)", () => {
      rackMock.data = { ...sampleRack };
      renderModule();
      // Navigate to editor
      fireEvent.click(screen.getByTestId("rack-card-1"));
      expect(screen.getByTestId("back-button")).toBeInTheDocument();

      // Simulate browser back
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(screen.getByText("Rack Planner")).toBeInTheDocument();
    });
  });
});
