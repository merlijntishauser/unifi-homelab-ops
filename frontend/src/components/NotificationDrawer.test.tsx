import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationDrawer from "./NotificationDrawer";
import type { AppNotification } from "../api/types";

function makeNotification(overrides?: Partial<AppNotification>): AppNotification {
  return {
    id: 1,
    device_mac: "aa:bb:cc:dd:ee:01",
    check_id: "cpu_high",
    severity: "warning",
    title: "High CPU Usage",
    message: "CPU usage exceeded 80%",
    created_at: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    resolved_at: null,
    dismissed: false,
    ...overrides,
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onDismiss: vi.fn(),
  onDismissAll: vi.fn(),
  onNavigateToDevice: vi.fn(),
};

describe("NotificationDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <NotificationDrawer notifications={[]} {...defaultProps} open={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders drawer when open", () => {
    render(<NotificationDrawer notifications={[]} {...defaultProps} />);
    expect(screen.getByRole("complementary", { name: "Notifications" })).toBeInTheDocument();
  });

  it("shows empty state when no notifications", () => {
    render(<NotificationDrawer notifications={[]} {...defaultProps} />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("renders notification cards", () => {
    render(
      <NotificationDrawer notifications={[makeNotification()]} {...defaultProps} />,
    );
    expect(screen.getByText("High CPU Usage")).toBeInTheDocument();
    expect(screen.getByText("CPU usage exceeded 80%")).toBeInTheDocument();
  });

  it("shows notification count badge", () => {
    render(
      <NotificationDrawer notifications={[makeNotification()]} {...defaultProps} />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <NotificationDrawer notifications={[]} {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <NotificationDrawer notifications={[]} {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close notifications" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <NotificationDrawer
        notifications={[makeNotification({ id: 42 })]}
        {...defaultProps}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss High CPU Usage" }));
    expect(onDismiss).toHaveBeenCalledWith(42);
  });

  it("calls onDismissAll when dismiss all button is clicked", () => {
    const onDismissAll = vi.fn();
    render(
      <NotificationDrawer
        notifications={[makeNotification()]}
        {...defaultProps}
        onDismissAll={onDismissAll}
      />,
    );
    fireEvent.click(screen.getByText("Dismiss all"));
    expect(onDismissAll).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigateToDevice when notification is clicked", () => {
    const onNavigateToDevice = vi.fn();
    render(
      <NotificationDrawer
        notifications={[makeNotification({ device_mac: "aa:01" })]}
        {...defaultProps}
        onNavigateToDevice={onNavigateToDevice}
      />,
    );
    fireEvent.click(screen.getByText("High CPU Usage").closest("[role=button]")!);
    expect(onNavigateToDevice).toHaveBeenCalledWith("aa:01");
  });

  it("calls onNavigateToDevice on Enter key", () => {
    const onNavigateToDevice = vi.fn();
    render(
      <NotificationDrawer
        notifications={[makeNotification({ device_mac: "aa:01" })]}
        {...defaultProps}
        onNavigateToDevice={onNavigateToDevice}
      />,
    );
    fireEvent.keyDown(screen.getByText("High CPU Usage").closest("[role=button]")!, { key: "Enter" });
    expect(onNavigateToDevice).toHaveBeenCalledWith("aa:01");
  });

  it("calls onNavigateToDevice on Space key", () => {
    const onNavigateToDevice = vi.fn();
    render(
      <NotificationDrawer
        notifications={[makeNotification({ device_mac: "aa:01" })]}
        {...defaultProps}
        onNavigateToDevice={onNavigateToDevice}
      />,
    );
    fireEvent.keyDown(screen.getByText("High CPU Usage").closest("[role=button]")!, { key: " " });
    expect(onNavigateToDevice).toHaveBeenCalledWith("aa:01");
  });

  it("does not navigate on other keys", () => {
    const onNavigateToDevice = vi.fn();
    render(
      <NotificationDrawer
        notifications={[makeNotification({ device_mac: "aa:01" })]}
        {...defaultProps}
        onNavigateToDevice={onNavigateToDevice}
      />,
    );
    fireEvent.keyDown(screen.getByText("High CPU Usage").closest("[role=button]")!, { key: "Tab" });
    expect(onNavigateToDevice).not.toHaveBeenCalled();
  });

  it("shows resolved label for resolved notifications", () => {
    render(
      <NotificationDrawer
        notifications={[makeNotification({ resolved_at: new Date().toISOString() })]}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("dims resolved notifications", () => {
    render(
      <NotificationDrawer
        notifications={[makeNotification({ resolved_at: new Date().toISOString() })]}
        {...defaultProps}
      />,
    );
    const card = screen.getByText("High CPU Usage").closest("[role=button]");
    expect(card?.className).toContain("opacity-50");
  });

  it("sorts notifications by created_at descending", () => {
    const older = makeNotification({ id: 1, title: "Older", created_at: new Date(Date.now() - 3600000).toISOString() });
    const newer = makeNotification({ id: 2, title: "Newer", created_at: new Date(Date.now() - 60000).toISOString() });
    render(
      <NotificationDrawer
        notifications={[older, newer]}
        {...defaultProps}
      />,
    );
    const cards = screen.getAllByRole("button", { name: /Dismiss (Newer|Older)/ });
    expect(cards[0]).toHaveAttribute("aria-label", "Dismiss Newer");
    expect(cards[1]).toHaveAttribute("aria-label", "Dismiss Older");
  });

  it("formats relative time for recent notifications", () => {
    render(
      <NotificationDrawer
        notifications={[makeNotification({ created_at: new Date(Date.now() - 120000).toISOString() })]}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("2m ago")).toBeInTheDocument();
  });

  it("formats relative time for hour-old notifications", () => {
    render(
      <NotificationDrawer
        notifications={[makeNotification({ created_at: new Date(Date.now() - 3600000).toISOString() })]}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("1h ago")).toBeInTheDocument();
  });

  it("formats relative time for day-old notifications", () => {
    render(
      <NotificationDrawer
        notifications={[makeNotification({ created_at: new Date(Date.now() - 86400000).toISOString() })]}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("1d ago")).toBeInTheDocument();
  });

  it("formats relative time for very recent notifications", () => {
    render(
      <NotificationDrawer
        notifications={[makeNotification({ created_at: new Date().toISOString() })]}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("does not show dismiss all when empty", () => {
    render(<NotificationDrawer notifications={[]} {...defaultProps} />);
    expect(screen.queryByText("Dismiss all")).not.toBeInTheDocument();
  });

  it("renders severity dots based on severity", () => {
    const { container } = render(
      <NotificationDrawer
        notifications={[makeNotification({ severity: "critical" })]}
        {...defaultProps}
      />,
    );
    const dangerDot = container.querySelector(".bg-status-danger");
    expect(dangerDot).toBeInTheDocument();
  });

  it("renders warning severity dot", () => {
    const { container } = render(
      <NotificationDrawer
        notifications={[makeNotification({ severity: "warning" })]}
        {...defaultProps}
      />,
    );
    const warningDot = container.querySelector(".bg-status-warning");
    expect(warningDot).toBeInTheDocument();
  });

  it("renders info severity dot as gray", () => {
    const { container } = render(
      <NotificationDrawer
        notifications={[makeNotification({ severity: "info" })]}
        {...defaultProps}
      />,
    );
    const grayDot = container.querySelector(".bg-gray-400");
    expect(grayDot).toBeInTheDocument();
  });
});
