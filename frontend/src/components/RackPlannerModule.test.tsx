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

const updateItemMock = vi.hoisted(() => ({
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
    useUpdateRackItem: () => updateItemMock,
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
      getAvailableDevices: vi.fn().mockResolvedValue([
        { mac: "aa:bb:cc:dd:ee:01", name: "USW-Lite-8", model: "USW-Lite-8-PoE", type: "switch" },
        { mac: "aa:bb:cc:dd:ee:02", name: "U6-Pro", model: "U6-Pro", type: "ap" },
      ]),
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
      width_fraction: 1.0,
      position_x: 0.0,
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
      width_fraction: 1.0,
      position_x: 0.0,
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
  updateItemMock.mutate = vi.fn();
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

    it("has Add from Topology button that toggles device picker", () => {
      openEditor();
      const btn = screen.getByTestId("import-button");
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toBe("Add from Topology");
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
            width_fraction: 1.0,
            position_x: 0.0,
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("shows error when add item fails", () => {
      addItemMock.mutate.mockImplementationOnce((_data: unknown, opts: { onError?: (err: Error) => void }) => {
        opts.onError?.(new Error("409: Rack is full"));
      });
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.click(screen.getByText("Custom"));
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), { target: { value: "Test" } });
      fireEvent.click(screen.getByText("Add"));
      expect(screen.getByText("409: Rack is full")).toBeInTheDocument();
    });

    it("clears error on cancel", () => {
      addItemMock.mutate.mockImplementationOnce((_data: unknown, opts: { onError?: (err: Error) => void }) => {
        opts.onError?.(new Error("409: Rack is full"));
      });
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.click(screen.getByText("Custom"));
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), { target: { value: "Test" } });
      fireEvent.click(screen.getByText("Add"));
      expect(screen.getByText("409: Rack is full")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      fireEvent.click(screen.getByTestId("add-item-button"));
      expect(screen.queryByText("409: Rack is full")).not.toBeInTheDocument();
    });

    it("shows error when add item fails with non-Error object", () => {
      addItemMock.mutate.mockImplementationOnce((_data: unknown, opts?: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
        opts?.onError?.("something broke");
      });
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.click(screen.getByText("Custom"));
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), { target: { value: "Test" } });
      fireEvent.click(screen.getByText("Add"));
      expect(screen.getByText("Failed to add item")).toBeInTheDocument();
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
        positionX: 0.0,
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
            width_fraction: 1.0,
            position_x: 0.0,
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
        positionX: 0.0,
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

    it("drop on same position does not call move", () => {
      openEditor();
      // Drag item 10 (at position_u: 1)
      const item = screen.getByTestId("rack-item-10");
      fireEvent.dragStart(item, {
        dataTransfer: { effectAllowed: "", setData: vi.fn() },
      });
      // Drop on the same item's container (position_u: 1) -- event bubbles up to the slot's onDrop
      fireEvent.drop(item, {
        dataTransfer: { getData: () => "10" },
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
            width_fraction: 1.0,
            position_x: 0.0,
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
      fireEvent.click(screen.getByText("Custom"));
      const form = screen.getByTestId("add-item-form");

      // Change label
      fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), {
        target: { value: "Custom Device" },
      });

      // Change device type
      const typeSelect = screen.getByLabelText("Type") as HTMLSelectElement;
      fireEvent.change(typeSelect, { target: { value: "gateway" } });

      // Change height
      fireEvent.change(screen.getByLabelText("Height (U)"), { target: { value: "2" } });

      // Change width to half to also test width/posX
      fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.5" } });

      // Position X dropdown should now be visible -- choose Right (0.5)
      fireEvent.change(screen.getByTestId("add-item-position-x"), { target: { value: "0.5" } });

      // Change position U and power
      fireEvent.change(screen.getByLabelText("Position (U)"), { target: { value: "3" } });
      fireEvent.change(screen.getByLabelText("Power (W)"), { target: { value: "25.5" } });

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
            width_fraction: 0.5,
            position_x: 0.5,
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("Add Item form height defaults to 0 on invalid input", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      // Set height to invalid value (NaN from parseFloat)
      fireEvent.change(screen.getByLabelText("Height (U)"), { target: { value: "" } });
      expect((screen.getByLabelText("Height (U)") as HTMLInputElement).value).toBe("0");
    });

    it("Add Item form height input has step 0.5", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      const heightInput = screen.getByLabelText("Height (U)") as HTMLInputElement;
      expect(heightInput.step).toBe("0.5");
    });

    it("Add Item form position defaults to 1 on invalid input", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      // Set position to invalid value (NaN from parseInt)
      fireEvent.change(screen.getByLabelText("Position (U)"), { target: { value: "" } });
      expect((screen.getByLabelText("Position (U)") as HTMLInputElement).value).toBe("1");
    });

    it("Add Item form power defaults to 0 on invalid input", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      // Set power to invalid value (NaN from parseFloat)
      fireEvent.change(screen.getByLabelText("Power (W)"), { target: { value: "" } });
      expect((screen.getByLabelText("Power (W)") as HTMLInputElement).value).toBe("0");
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

    it("UniFi Device tab shows searchable device list", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      // Default tab is UniFi Device
      expect(screen.getByText("UniFi Device")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search devices...")).toBeInTheDocument();
      expect(screen.getByText("Cloud Gateway Fiber")).toBeInTheDocument();
    });

    it("UniFi Device search filters the list", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.change(screen.getByPlaceholderText("Search devices..."), { target: { value: "lite 8" } });
      expect(screen.getByText("Switch Lite 8 PoE")).toBeInTheDocument();
      expect(screen.queryByText("Cloud Gateway Fiber")).not.toBeInTheDocument();
    });

    it("UniFi Device search shows empty state", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.change(screen.getByPlaceholderText("Search devices..."), { target: { value: "zzzznonexistent" } });
      expect(screen.getByText("No matching devices")).toBeInTheDocument();
    });

    it("Selecting a UniFi device fills the custom form", () => {
      openEditor();
      fireEvent.click(screen.getByTestId("add-item-button"));
      fireEvent.click(screen.getByText("Cloud Gateway Fiber"));
      // Should switch to Custom tab with pre-filled values
      expect(screen.getByDisplayValue("Cloud Gateway Fiber")).toBeInTheDocument();
    });

    it("clicking item label opens edit form in side panel", () => {
      openEditor();
      const label = screen.getByText("USW-24-PoE");
      fireEvent.click(label);
      expect(screen.getByTestId("edit-item-form")).toBeInTheDocument();
      expect(screen.getByText(/Edit: USW-24-PoE/)).toBeInTheDocument();
      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    it("edit form pre-fills with item values and defaults to Custom tab", () => {
      openEditor();
      fireEvent.click(screen.getByText("USW-24-PoE"));
      // Should be on Custom tab with pre-filled values
      expect(screen.getByDisplayValue("USW-24-PoE")).toBeInTheDocument();
      expect(screen.getByDisplayValue("30")).toBeInTheDocument(); // power_watts
    });

    it("edit form cancel closes the edit panel", () => {
      openEditor();
      fireEvent.click(screen.getByText("USW-24-PoE"));
      expect(screen.getByTestId("edit-item-form")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByTestId("edit-item-form")).not.toBeInTheDocument();
    });

    it("edit form save calls updateRackItem and closes panel on success", () => {
      openEditor();
      fireEvent.click(screen.getByText("USW-24-PoE"));
      expect(screen.getByTestId("edit-item-form")).toBeInTheDocument();
      // Submit the edit form via Save button
      fireEvent.click(screen.getByText("Save"));
      expect(updateItemMock.mutate).toHaveBeenCalledTimes(1);
      const call = updateItemMock.mutate.mock.calls[0];
      expect(call[0]).toMatchObject({ rackId: 1, itemId: 10 });
      // Trigger onSuccess to close the edit panel
      act(() => call[1].onSuccess());
      expect(screen.queryByTestId("edit-item-form")).not.toBeInTheDocument();
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
          { id: 40, position_u: 1, height_u: 1, device_type: "ups", label: "CyberPower", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          { id: 41, position_u: 2, height_u: 1, device_type: "patch-panel", label: "PP-24", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          { id: 42, position_u: 3, height_u: 1, device_type: "ap", label: "U6-LR", power_watts: 8, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          { id: 43, position_u: 4, height_u: 1, device_type: "unknown-type", label: "Mystery Box", power_watts: 5, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
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
          { id: 50, position_u: 1, height_u: 2, device_type: "switch", label: "Overlap-A", power_watts: 10, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          { id: 51, position_u: 2, height_u: 2, device_type: "gateway", label: "Overlap-B", power_watts: 20, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
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

    describe("DevicePicker", () => {
      it("clicking 'Add from Topology' toggles the device picker panel", async () => {
        openEditor();
        const btn = screen.getByTestId("import-button");
        expect(btn.textContent).toBe("Add from Topology");

        // Open device picker
        fireEvent.click(btn);
        expect(btn.textContent).toBe("Hide Devices");

        // Close device picker
        fireEvent.click(btn);
        expect(btn.textContent).toBe("Add from Topology");
      });

      it("shows loading state while fetching devices", () => {
        // Make getAvailableDevices return a promise that never resolves during this test
        vi.mocked(api.getAvailableDevices).mockReturnValueOnce(new Promise(() => {}));
        openEditor();
        fireEvent.click(screen.getByTestId("import-button"));
        expect(screen.getByText("Loading devices...")).toBeInTheDocument();
      });

      it("shows available devices after loading", async () => {
        openEditor();
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(screen.getByText("Available Devices")).toBeInTheDocument();
        });
        expect(screen.getByText("USW-Lite-8")).toBeInTheDocument();
        expect(screen.getByText("U6-Pro")).toBeInTheDocument();
        expect(screen.getByText(/Switch -- USW-Lite-8-PoE/)).toBeInTheDocument();
        expect(screen.getByText(/Access Point -- U6-Pro/)).toBeInTheDocument();
      });

      it("shows 'all devices placed' when no devices are available", async () => {
        vi.mocked(api.getAvailableDevices).mockResolvedValueOnce([]);
        openEditor();
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(screen.getByText("All devices already placed in this rack.")).toBeInTheDocument();
        });
      });

      it("clicking 'Add to Rack' calls addItem.mutate with correct data", async () => {
        openEditor();
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(screen.getByText("USW-Lite-8")).toBeInTheDocument();
        });
        const addButtons = screen.getAllByText("Add to Rack");
        fireEvent.click(addButtons[0]);
        // The rack has items at U1 (1U) and U3-U4 (2U). Free slots start at U2.
        expect(addItemMock.mutate).toHaveBeenCalledWith(
          {
            rackId: 1,
            data: {
              position_u: 2,
              label: "USW-Lite-8",
              device_type: "switch",
              device_mac: "aa:bb:cc:dd:ee:01",
              height_u: 1,
              width_fraction: 1.0,
              position_x: 0.0,
            },
          },
          expect.objectContaining({ onError: expect.any(Function) }),
        );
      });

      it("fetches from the correct API endpoint with rackId", async () => {
        openEditor();
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(api.getAvailableDevices).toHaveBeenCalledWith(1);
        });
      });

      it("handles API error gracefully by showing empty state", async () => {
        vi.mocked(api.getAvailableDevices).mockRejectedValueOnce(new Error("Network error"));
        openEditor();
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(screen.getByText("All devices already placed in this rack.")).toBeInTheDocument();
        });
      });

      it("places device at U1 when rack is fully empty", async () => {
        rackMock.data = {
          ...sampleRack,
          height_u: 4,
          items: [],
        };
        renderModule();
        fireEvent.click(screen.getByTestId("rack-card-1"));
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(screen.getByText("USW-Lite-8")).toBeInTheDocument();
        });
        const addButtons = screen.getAllByText("Add to Rack");
        fireEvent.click(addButtons[0]);
        expect(addItemMock.mutate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ position_u: 1 }),
          }),
          expect.objectContaining({ onError: expect.any(Function) }),
        );
      });

      it("shows error when topology add fails on full rack", async () => {
        addItemMock.mutate.mockImplementationOnce((_data: unknown, opts?: { onError?: (err: unknown) => void }) => {
          opts?.onError?.("no room");
        });
        rackMock.data = {
          ...sampleRack,
          height_u: 2,
          items: [
            { id: 60, position_u: 1, height_u: 1, device_type: "switch", label: "A", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
            { id: 61, position_u: 2, height_u: 1, device_type: "switch", label: "B", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          ],
        };
        renderModule();
        fireEvent.click(screen.getByTestId("rack-card-1"));
        fireEvent.click(screen.getByTestId("import-button"));
        await waitFor(() => {
          expect(screen.getByText("USW-Lite-8")).toBeInTheDocument();
        });
        fireEvent.click(screen.getAllByText("Add to Rack")[0]);
        expect(screen.getByText("Rack is full")).toBeInTheDocument();
      });
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

    describe("half-U items", () => {
      it("renders a 0.5U item in the rack grid", () => {
        rackMock.data = {
          ...sampleRack,
          height_u: 4,
          items: [
            { id: 90, position_u: 1, height_u: 0.5, device_type: "patch-panel", label: "Half-U Panel", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          ],
        };
        renderModule();
        fireEvent.click(screen.getByTestId("rack-card-1"));
        expect(screen.getByTestId("rack-item-90")).toBeInTheDocument();
        expect(screen.getByText("Half-U Panel")).toBeInTheDocument();
      });

      it("submits 0.5U height from add item form", () => {
        openEditor();
        fireEvent.click(screen.getByTestId("add-item-button"));
        fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), { target: { value: "Half Device" } });
        fireEvent.change(screen.getByLabelText("Height (U)"), { target: { value: "0.5" } });
        fireEvent.click(screen.getByText("Add"));
        expect(addItemMock.mutate).toHaveBeenCalledWith(
          {
            rackId: 1,
            data: expect.objectContaining({
              label: "Half Device",
              height_u: 0.5,
            }),
          },
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
    });

    describe("fractional width items", () => {
      it("renders half-width items side by side at the same U position", () => {
        rackMock.data = {
          ...sampleRack,
          height_u: 4,
          items: [
            { id: 70, position_u: 1, height_u: 1, device_type: "switch", label: "Left Half", power_watts: 10, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 0.5, position_x: 0.0 },
            { id: 71, position_u: 1, height_u: 1, device_type: "switch", label: "Right Half", power_watts: 10, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 0.5, position_x: 0.5 },
          ],
        };
        renderModule();
        fireEvent.click(screen.getByTestId("rack-card-1"));
        expect(screen.getByTestId("rack-item-70")).toBeInTheDocument();
        expect(screen.getByTestId("rack-item-71")).toBeInTheDocument();
        expect(screen.getByText("Left Half")).toBeInTheDocument();
        expect(screen.getByText("Right Half")).toBeInTheDocument();

        // Check that fractional items have absolute positioning with correct width/left
        const leftItem = screen.getByTestId("rack-item-70");
        expect(leftItem.style.width).toBe("50%");
        expect(leftItem.style.left).toBe("0%");
        const rightItem = screen.getByTestId("rack-item-71");
        expect(rightItem.style.width).toBe("50%");
        expect(rightItem.style.left).toBe("50%");
      });

      it("does not apply absolute positioning to full-width items", () => {
        openEditor();
        const item = screen.getByTestId("rack-item-10");
        expect(item.style.width).toBe("");
        expect(item.style.left).toBe("");
      });
    });

    it("renders device panels with light theme colors when not dark", () => {
      document.documentElement.classList.remove("dark");
      openEditor();
      const item = screen.getByTestId("rack-item-10");
      // Light theme uses lighter gradient faces
      expect(item.style.background).toContain("linear-gradient");
      // Restore dark class
      document.documentElement.classList.add("dark");
    });

    describe("0U items", () => {
      it("shows 0U items in a separate side-mounted section", () => {
        rackMock.data = {
          ...sampleRack,
          height_u: 4,
          items: [
            { id: 80, position_u: 1, height_u: 1, device_type: "switch", label: "Normal Switch", power_watts: 10, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
            { id: 81, position_u: 1, height_u: 0, device_type: "ups", label: "Side UPS", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          ],
        };
        renderModule();
        fireEvent.click(screen.getByTestId("rack-card-1"));

        expect(screen.getByTestId("zero-u-section")).toBeInTheDocument();
        expect(screen.getByText("Side-mounted (0U)")).toBeInTheDocument();
        expect(screen.getByTestId("rack-item-81")).toBeInTheDocument();
        expect(screen.getByText("Side UPS")).toBeInTheDocument();
        // Normal item should also be in the grid
        expect(screen.getByTestId("rack-item-80")).toBeInTheDocument();
      });

      it("does not show 0U section when there are no 0U items", () => {
        openEditor();
        expect(screen.queryByTestId("zero-u-section")).not.toBeInTheDocument();
      });

      it("0U items do not occupy rack grid slots", () => {
        rackMock.data = {
          ...sampleRack,
          height_u: 2,
          items: [
            { id: 82, position_u: 1, height_u: 0, device_type: "ups", label: "Side Rail PDU", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null, width_fraction: 1.0, position_x: 0.0 },
          ],
        };
        renderModule();
        fireEvent.click(screen.getByTestId("rack-card-1"));

        // Both U slots should be empty since the 0U item doesn't occupy them
        expect(screen.getByTestId("empty-slot-1")).toBeInTheDocument();
        expect(screen.getByTestId("empty-slot-2")).toBeInTheDocument();
      });
    });

    describe("AddItemForm width and position X", () => {
      function openAddForm() {
        openEditor();
        fireEvent.click(screen.getByTestId("add-item-button"));
      }

      it("shows width dropdown with Full, Half, Quarter options", () => {
        openAddForm();
        const widthSelect = screen.getByTestId("add-item-width") as HTMLSelectElement;
        expect(widthSelect).toBeInTheDocument();
        const options = Array.from(widthSelect.options).map((o) => o.text);
        expect(options).toEqual(["Full (1U)", "Half (1/2)", "Quarter (1/4)"]);
      });

      it("does not show Position X dropdown when width is Full", () => {
        openAddForm();
        expect(screen.queryByTestId("add-item-position-x")).not.toBeInTheDocument();
      });

      it("shows Position X dropdown when width is Half", () => {
        openAddForm();
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.5" } });
        const posXSelect = screen.getByTestId("add-item-position-x") as HTMLSelectElement;
        expect(posXSelect).toBeInTheDocument();
        const options = Array.from(posXSelect.options).map((o) => o.text);
        // Half-width can be at Left (0.0), Center-Left (0.25), or Center-Right (0.5)
        expect(options).toEqual(["Left", "Center-Left", "Center-Right"]);
      });

      it("shows all Position X options for Quarter width", () => {
        openAddForm();
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.25" } });
        const posXSelect = screen.getByTestId("add-item-position-x") as HTMLSelectElement;
        const options = Array.from(posXSelect.options).map((o) => o.text);
        expect(options).toEqual(["Left", "Center-Left", "Center-Right", "Right"]);
      });

      it("resets Position X to 0.0 when width changes and current position is invalid", () => {
        openAddForm();
        // Set quarter width and choose Right (0.75)
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.25" } });
        fireEvent.change(screen.getByTestId("add-item-position-x"), { target: { value: "0.75" } });

        // Change to half width -- 0.75 is invalid for half (0.75 + 0.5 > 1.0)
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.5" } });
        const posXSelect = screen.getByTestId("add-item-position-x") as HTMLSelectElement;
        expect(posXSelect.value).toBe("0");
      });

      it("preserves Position X when width changes and current position is still valid", () => {
        openAddForm();
        // Set quarter width and choose Center-Right (0.5)
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.25" } });
        fireEvent.change(screen.getByTestId("add-item-position-x"), { target: { value: "0.5" } });

        // Change to half width -- 0.5 is valid for half (0.5 + 0.5 = 1.0)
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.5" } });
        const posXSelect = screen.getByTestId("add-item-position-x") as HTMLSelectElement;
        expect(posXSelect.value).toBe("0.5");
      });

      it("shows 0U note when height is set to 0", () => {
        openAddForm();
        fireEvent.change(screen.getByLabelText("Height (U)"), { target: { value: "0" } });
        expect(screen.getByText("0U items mount on side rails")).toBeInTheDocument();
      });

      it("submits fractional width item with correct data", () => {
        openAddForm();
        fireEvent.change(screen.getByPlaceholderText("e.g. USW-24-PoE"), { target: { value: "Quarter Device" } });
        fireEvent.change(screen.getByTestId("add-item-width"), { target: { value: "0.25" } });
        fireEvent.change(screen.getByTestId("add-item-position-x"), { target: { value: "0.75" } });
        fireEvent.click(screen.getByText("Add"));
        expect(addItemMock.mutate).toHaveBeenCalledWith(
          {
            rackId: 1,
            data: expect.objectContaining({
              label: "Quarter Device",
              width_fraction: 0.25,
              position_x: 0.75,
            }),
          },
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
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
