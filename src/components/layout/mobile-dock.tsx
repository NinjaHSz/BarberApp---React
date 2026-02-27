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
    <div className="md:hidden fixed bottom-6 left-0 right-0 z-[100] px-4 flex justify-center">
      <div className="bg-surface-section/80 backdrop-blur-3xl px-6 py-3 rounded-[2.5rem] flex items-center justify-between w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent" />
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative py-1",
                isActive ? "text-white" : "text-text-muted"
              )}
            >
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300",
                isActive ? "bg-brand-primary/10 scale-110" : "bg-transparent hover:bg-white/5"
              )}>
                <item.icon size={22} className={cn(isActive && "text-brand-primary")} />
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
