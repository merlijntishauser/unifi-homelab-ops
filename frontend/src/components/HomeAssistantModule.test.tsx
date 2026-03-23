import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomeAssistantModule from "./HomeAssistantModule";

describe("HomeAssistantModule", () => {
  it("renders the main title", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText("UniFi Network Map")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<HomeAssistantModule />);
    expect(
      screen.getByText(/Bring your UniFi network topology into Home Assistant/),
    ).toBeInTheDocument();
  });

  it("renders the integration badge", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText("Home Assistant Integration")).toBeInTheDocument();
  });

  it("renders all six feature cards", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText("Interactive Network Map")).toBeInTheDocument();
    expect(screen.getByText("Live Updates")).toBeInTheDocument();
    expect(screen.getByText("VLAN Visualization")).toBeInTheDocument();
    expect(screen.getByText("Automation Sensors")).toBeInTheDocument();
    expect(screen.getByText("Multiple Themes")).toBeInTheDocument();
    expect(screen.getByText("Device Filtering")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<HomeAssistantModule />);
    expect(
      screen.getByText(/Real-time SVG visualization/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/WebSocket push with HTTP polling fallback/),
    ).toBeInTheDocument();
  });

  it("renders the 'What you get' heading", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText("What you get")).toBeInTheDocument();
  });

  it("renders all four requirements", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText("Home Assistant 2024.12+")).toBeInTheDocument();
    expect(screen.getByText("UniFi Dream Machine or controller")).toBeInTheDocument();
    expect(screen.getByText("Local UniFi account (not cloud)")).toBeInTheDocument();
    expect(screen.getByText("HACS installed")).toBeInTheDocument();
  });

  it("renders the Requirements heading", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText("Requirements")).toBeInTheDocument();
  });

  it("renders Install via HACS link with correct href", () => {
    render(<HomeAssistantModule />);
    const hacsLink = screen.getByText("Install via HACS").closest("a");
    expect(hacsLink).toHaveAttribute(
      "href",
      "https://my.home-assistant.io/redirect/hacs_repository/?owner=merlijntishauser&repository=unifi-network-maps-ha&category=integration",
    );
    expect(hacsLink).toHaveAttribute("target", "_blank");
    expect(hacsLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders View on GitHub link with correct href", () => {
    render(<HomeAssistantModule />);
    const githubLink = screen.getByText("View on GitHub").closest("a");
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/merlijntishauser/unifi-network-maps-ha",
    );
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the Report an issue link with correct href", () => {
    render(<HomeAssistantModule />);
    const issueLink = screen.getByText("Report an issue").closest("a");
    expect(issueLink).toHaveAttribute(
      "href",
      "https://github.com/merlijntishauser/unifi-network-maps-ha/issues",
    );
  });

  it("renders the contribute link with correct href", () => {
    render(<HomeAssistantModule />);
    const contributeLink = screen.getByText("contribute").closest("a");
    expect(contributeLink).toHaveAttribute(
      "href",
      "https://github.com/merlijntishauser/unifi-network-maps-ha/pulls",
    );
  });

  it("renders the MIT license text", () => {
    render(<HomeAssistantModule />);
    expect(screen.getByText(/Open source under MIT license/)).toBeInTheDocument();
  });
});
