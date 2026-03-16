import { useEffect, useState } from "react";

function matchQuery(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchQuery(query));

  useEffect(() => {
    const mql = window.matchMedia(query);
    function handler(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** True when viewport is below the `lg` breakpoint (< 1024px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}

/** True when viewport is below the `md` breakpoint (< 768px). */
export function useIsPhone(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
