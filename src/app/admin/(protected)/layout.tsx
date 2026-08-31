import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentPlatformAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
      <header className="mb-8 flex items-center justify-between border-b border-border/80 pb-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-yellow-400/80">Plataforma SaaS</span>
          <h1 className="text-lg font-bold text-foreground">{admin.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <nav className="mb-6 flex gap-4 text-sm">
        <Link href="/tenants" className="text-muted-foreground hover:text-foreground">
          Negocios
        </Link>
        <Link href="/subscriptions" className="text-muted-foreground hover:text-foreground">
          Suscripciones
        </Link>
      </nav>
      {children}
    </div>
  );
}
