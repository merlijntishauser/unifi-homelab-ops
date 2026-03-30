/* eslint-disable react-refresh/only-export-components */
import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import SuspenseRoute from "./components/SuspenseRoute";

const FirewallModule = lazy(() => import("./components/FirewallModule"));
const TopologyModule = lazy(() => import("./components/TopologyModule"));
const MetricsModule = lazy(() => import("./components/MetricsModule"));
const HealthModule = lazy(() => import("./components/HealthModule"));
const DocumentationModule = lazy(() => import("./components/DocumentationModule"));
const RackPlannerModule = lazy(() => import("./components/RackPlannerModule"));
const HomeAssistantModule = lazy(() => import("./components/HomeAssistantModule"));
const CablingModule = lazy(() => import("./components/CablingModule"));

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/health" replace /> },
      { path: "firewall", element: <SuspenseRoute><FirewallModule /></SuspenseRoute> },
      { path: "topology", element: <SuspenseRoute><TopologyModule /></SuspenseRoute> },
      { path: "metrics", element: <SuspenseRoute><MetricsModule /></SuspenseRoute> },
      { path: "health", element: <SuspenseRoute><HealthModule /></SuspenseRoute> },
      { path: "docs", element: <SuspenseRoute><DocumentationModule /></SuspenseRoute> },
      { path: "rack-planner", element: <SuspenseRoute><RackPlannerModule /></SuspenseRoute> },
      { path: "cabling", element: <SuspenseRoute><CablingModule /></SuspenseRoute> },
      { path: "home-assistant", element: <SuspenseRoute><HomeAssistantModule /></SuspenseRoute> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
