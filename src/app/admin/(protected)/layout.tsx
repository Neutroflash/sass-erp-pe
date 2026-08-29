import { redirect } from "next/navigation";
import { getCurrentPlatformAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/LogoutButton";

// Guarda todo /admin/(protected)/** — /admin/ingresar vive fuera de este grupo a propósito,
// mismo criterio que /sites/[tenant]/ingresar respecto de /panel/layout.tsx: si estuviera adentro,
// este mismo guard la volvería a interceptar y el redirect entraría en loop contra sí mismo.
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) {
    redirect("/ingresar");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-yellow-400/80">Plataforma SaaS</span>
          <h1 className="text-lg font-bold text-zinc-100">{admin.name}</h1>
        </div>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
