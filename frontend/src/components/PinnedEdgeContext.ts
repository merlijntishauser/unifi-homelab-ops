import { createContext } from "react";

export const PinnedEdgeContext = createContext<{
  pinnedId: string | null;
  setPinnedId: (id: string | null) => void;
}>({ pinnedId: null, setPinnedId: () => {} });
