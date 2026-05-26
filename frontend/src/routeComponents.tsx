import { lazy } from "react";

export const FirewallModule = lazy(() => import("./components/FirewallModule"));
export const TopologyModule = lazy(() => import("./components/TopologyModule"));
export const MetricsModule = lazy(() => import("./components/MetricsModule"));
export const HealthModule = lazy(() => import("./components/HealthModule"));
export const DocumentationModule = lazy(() => import("./components/DocumentationModule"));
export const RackPlannerModule = lazy(() => import("./components/RackPlannerModule"));
export const HomeAssistantModule = lazy(() => import("./components/HomeAssistantModule"));
export const CablingModule = lazy(() => import("./components/CablingModule"));
