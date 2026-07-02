"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Crown, 
  Scissors 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/agenda", icon: Calendar, label: "Agenda" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/planos", icon: Crown, label: "Planos" },
  { href: "/barbeiros", icon: Scissors, label: "Barbeiros" },
];

export function MobileDock() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="md:hidden fixed bottom-3 left-0 right-0 z-[100] px-4 flex justify-center">
      <div className="bg-surface-section/80 backdrop-blur-3xl px-3 py-1 rounded-[1.5rem] flex items-center justify-between w-full max-w-[280px] shadow-[0_15px_35px_rgba(0,0,0,0.5)] relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent" />
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center transition-all duration-300 relative py-0.5",
                isActive ? "text-white" : "text-text-muted"
              )}
            >
              <div className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300",
                isActive ? "bg-brand-primary/10 scale-110" : "bg-transparent hover:bg-white/5"
              )}>
                <item.icon size={18} className={cn(isActive && "text-brand-primary")} />
              </div>
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 bg-brand-primary rounded-full animate-in fade-in zoom-in duration-300" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
