import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import SuspenseRoute from "./components/SuspenseRoute";
import {
  FirewallModule,
  TopologyModule,
  MetricsModule,
  HealthModule,
  DocumentationModule,
  RackPlannerModule,
  HomeAssistantModule,
  CablingModule,
} from "./routeComponents";

// Each module route gets its own errorElement so a crash in one module renders
// inside the shell (nav stays usable) rather than blanking the whole app.
function moduleRoute(path: string, element: ReactNode): RouteObject {
  return {
    path,
    element: <SuspenseRoute>{element}</SuspenseRoute>,
    errorElement: <RouteErrorBoundary />,
  };
}

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    // Fallback for errors in the shell itself (toolbar, sidebar, etc.).
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/health" replace /> },
      moduleRoute("firewall", <FirewallModule />),
      moduleRoute("topology", <TopologyModule />),
      moduleRoute("metrics", <MetricsModule />),
      moduleRoute("health", <HealthModule />),
      moduleRoute("docs", <DocumentationModule />),
      moduleRoute("rack-planner", <RackPlannerModule />),
      moduleRoute("cabling", <CablingModule />),
      moduleRoute("home-assistant", <HomeAssistantModule />),
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
