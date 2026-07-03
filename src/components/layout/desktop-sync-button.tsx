"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function DesktopSyncButton() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await queryClient.invalidateQueries();
    await new Promise(r => setTimeout(r, 800));
    setIsSyncing(false);
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={cn(
        "hidden md:flex fixed bottom-6 left-6 z-[100] w-12 h-12 rounded-full items-center justify-center glass-card hover:bg-surface-subtle text-brand-primary hover:text-white transition-all cursor-pointer shadow-lg border-none bg-transparent",
        isSyncing && "pointer-events-none opacity-50"
      )}
      title="Sincronizar base de dados"
    >
      <RefreshCw size={20} className={cn(isSyncing && "animate-spin")} />
    </button>
  );
}
