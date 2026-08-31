"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

// Mismo patrón que components/admin/LogoutButton.tsx: fetch relativo a "/api/auth/logout" — el
// middleware ya reescribió el origen de este request a {slug}.flashstock.pe, así que resuelve a
// /sites/{slug}/api/auth/logout, que borra la cookie de sesión de USER (no la de PlatformAdmin).
export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/ingresar");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
      )}
    >
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </button>
  );
}
