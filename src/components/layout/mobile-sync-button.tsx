"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function MobileSyncButton() {
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
        "md:hidden fixed top-4 right-4 z-[9999] w-10 h-10 rounded-full bg-surface-section/80 backdrop-blur-md border-none flex items-center justify-center text-text-secondary shadow-[0_4px_20px_rgba(0,0,0,0.4)] active:scale-95 transition-all cursor-pointer",
        isSyncing && "pointer-events-none opacity-50"
      )}
      title="Sincronizar base de dados"
    >
      <RefreshCw size={16} className={cn("text-brand-primary", isSyncing && "animate-spin")} />
    </button>
  );
}
