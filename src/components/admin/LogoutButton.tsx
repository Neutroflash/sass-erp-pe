"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/ingresar");
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
