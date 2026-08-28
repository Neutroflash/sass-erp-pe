import { NextResponse } from "next/server";
import { clearTenantSessionCookies } from "@/lib/session-cookies";

export async function POST() {
  clearTenantSessionCookies();
  return NextResponse.json({ message: "Sesión cerrada" });
}
