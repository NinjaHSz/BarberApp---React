"use client";

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { Children, cloneElement, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Crown, 
  Scissors 
} from "lucide-react";
import "./desktop-dock.css";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Painel" },
  { href: "/agenda", icon: Calendar, label: "Agenda" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/planos", icon: Crown, label: "Planos" },
  { href: "/barbeiros", icon: Scissors, label: "Barbeiros" },
];

interface DockItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  mouseX: any;
  spring: any;
  distance: number;
  magnification: number;
  baseItemSize: number;
  label: string;
  isActive: boolean;
}

function DockItem({ 
  children, 
  className = "", 
  onClick, 
  mouseX, 
  spring, 
  distance, 
  magnification, 
  baseItemSize, 
  label,
  isActive
}: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val: number) => {
    const rect = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      width: baseItemSize
    };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size
      }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${isActive ? "active" : ""} ${className}`}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
      aria-label={label}
    >
      {Children.map(children, child => cloneElement(child as React.ReactElement, { isHovered }))}
    </motion.div>
  );
}

function DockLabel({ children, ...rest }: { children: React.ReactNode; isHovered?: any }) {
  const { isHovered } = rest;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on("change", (latest: number) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className="dock-label"
          role="tooltip"
          style={{ x: "-50%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children }: { children: React.ReactNode }) {
  return <div className="dock-icon">{children}</div>;
}

export function DesktopDock() {
  const pathname = usePathname();
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const spring = { mass: 0.1, stiffness: 150, damping: 12 };
  const magnification = 64;
  const distance = 160;
  const panelHeight = 56;
  const baseItemSize = 42;

  const maxHeight = useMemo(
    () => magnification + magnification / 2 + 4,
    [magnification]
  );
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <div className="hidden md:flex">
      <motion.div style={{ height, scrollbarWidth: "none" }} className="dock-outer">
        <motion.div
          onMouseMove={({ pageX }) => {
            isHovered.set(1);
            mouseX.set(pageX);
          }}
          onMouseLeave={() => {
            isHovered.set(0);
            mouseX.set(Infinity);
          }}
          className="dock-panel"
          style={{ height: panelHeight }}
          role="toolbar"
          aria-label="Desktop application dock"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} passHref legacyBehavior>
                <DockItem
                  onClick={() => {}}
                  mouseX={mouseX}
                  spring={spring}
                  distance={distance}
                  magnification={magnification}
                  baseItemSize={baseItemSize}
                  label={item.label}
                  isActive={isActive}
                >
                  <DockIcon>
                    <Icon size={20} />
                  </DockIcon>
                  <DockLabel>{item.label}</DockLabel>
                </DockItem>
              </Link>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
