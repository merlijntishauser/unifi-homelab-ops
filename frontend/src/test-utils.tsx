import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface RenderWithQueryOptions extends Omit<RenderOptions, "wrapper"> {
  /** Wrap in MemoryRouter. Defaults to true. Set false when the component under test renders its own router. */
  withRouter?: boolean;
  initialEntries?: string[];
}

export function renderWithQuery(ui: ReactElement, options?: RenderWithQueryOptions) {
  const { withRouter = true, initialEntries, ...renderOptions } = options ?? {};
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    if (withRouter) {
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      );
    }
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

export { createTestQueryClient };
