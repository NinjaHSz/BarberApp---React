"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AgendaProvider } from "./contexts/agenda-context";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

function RealtimeSubscriber({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload) => {
          console.log("[REALTIME] Alteração detectada no banco:", payload);
          queryClient.invalidateQueries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Data is immediately considered stale
            gcTime: 1000 * 60 * 5, // Garbage collect cache after 5 minutes
            refetchOnWindowFocus: true, // Refetch data when browser tab is focused
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
      <RealtimeSubscriber>
        <AgendaProvider>
          {children}
        </AgendaProvider>
      </RealtimeSubscriber>
    </QueryClientProvider>
  );
}
