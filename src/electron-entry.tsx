// Pure client-side entry for the Electron build.
// No SSR, no TanStack Start — uses RouterProvider + hash history so file:// works.
import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.electron.gen";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
