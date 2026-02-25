"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Crown, 
  MinusCircle, 
  CreditCard,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/agenda", icon: Calendar, label: "Agenda" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/planos", icon: Crown, label: "Planos" },
  { href: "/saidas", icon: MinusCircle, label: "Saídas" },
];

export function MobileDock() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[400px]">
      <div className="bg-surface-section/80 backdrop-blur-2xl px-4 py-3 rounded-[2rem] flex items-center justify-around shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent" />
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative py-1 px-3 rounded-2xl",
                isActive ? "text-white" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <div className={cn(
                "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300",
                isActive ? "bg-brand-primary/10 scale-110" : "bg-transparent"
              )}>
                <item.icon size={20} className={cn(isActive && "text-brand-primary")} />
              </div>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-brand-primary rounded-full animate-in fade-in zoom-in duration-300" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
