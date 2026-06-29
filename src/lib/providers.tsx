"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AgendaProvider } from "./contexts/agenda-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 60, // 1 hour
            gcTime: 1000 * 60 * 60 * 2, // 2 hours
            refetchOnWindowFocus: false, // Avoid excessive refetching on window focus
            refetchOnReconnect: true,
          },
        },
      })
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => console.log("SW registered: ", registration))
        .catch((error) => console.log("SW registration failed: ", error));
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AgendaProvider>
        {children}
      </AgendaProvider>
    </QueryClientProvider>
  );
}
