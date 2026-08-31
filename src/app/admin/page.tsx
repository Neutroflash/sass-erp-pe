import { redirect } from "next/navigation";
import { getCurrentPlatformAdmin } from "@/lib/auth";

// admin.flashstock.pe/ (raíz) no tiene contenido propio — solo decide a dónde mandar según haya
// sesión o no. Server Component: el chequeo real de acceso sigue viviendo en (protected)/layout.tsx.
export default async function AdminRootPage() {
  const admin = await getCurrentPlatformAdmin();
  redirect(admin ? "/tenants" : "/ingresar");
}
