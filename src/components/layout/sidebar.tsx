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
import { JarvisAssistant } from "@/components/layout/jarvis-assistant";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agenda", icon: Calendar, label: "Agenda" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/planos", icon: Crown, label: "Planos" },
  { href: "/saidas", icon: MinusCircle, label: "Saídas" },
  { href: "/cartoes", icon: CreditCard, label: "Cartões" },
  { href: "/ajustes", icon: Settings, label: "Ajustes" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col h-full bg-surface-section transition-all duration-300 w-20 hover:w-64 group/sidebar z-50 overflow-hidden border-none text-white">
      {/* Brand Section */}
      <div className="h-24 flex items-center group-hover/sidebar:justify-start transition-all overflow-hidden shrink-0">
        <div className="w-20 shrink-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-2xl bg-surface-page">
            <img 
              src="/logo.png" 
              alt="Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=L&background=09090B&color=D4D4D8`;
              }}
            />
          </div>
        </div>
        <div className="flex flex-col opacity-0 group-hover/sidebar:opacity-100 transition-opacity whitespace-nowrap">
          <h1 className="text-[10px] font-black text-white uppercase tracking-tighter truncate max-w-[140px]">
            LUCAS DO CORTE
          </h1>
          <p className="text-[8px] text-brand-primary font-black uppercase tracking-widest">
            Premium Unit
          </p>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-0 space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center h-12 px-0 group-hover/sidebar:px-4 transition-all duration-200 relative",
                isActive ? "bg-surface-subtle text-white" : "text-text-secondary hover:bg-white/5 hover:text-white"
              )}
            >
              <div className="w-20 shrink-0 flex items-center justify-center">
                <item.icon size={20} className={cn(isActive && "text-brand-primary")} />
              </div>
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                {item.label}
              </span>
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-brand-primary rounded-r-full group-hover/sidebar:h-8 transition-all" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Jarvis Integrated Button */}
      <div className="mt-auto shrink-0 pb-6">
        <JarvisAssistant />
      </div>
    </aside>
  );
}
