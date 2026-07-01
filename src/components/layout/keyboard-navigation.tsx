"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardNavigation() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.hasAttribute("contenteditable"))
      ) {
        return;
      }

      switch (e.key) {
        case "1":
          router.push("/");
          break;
        case "2":
          router.push("/agenda");
          break;
        case "3":
          router.push("/clientes");
          break;
        case "4":
          router.push("/planos");
          break;
        case "5":
          router.push("/barbeiros");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
