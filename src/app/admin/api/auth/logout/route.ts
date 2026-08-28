import { NextResponse } from "next/server";
import { clearPlatformAdminSessionCookies } from "@/lib/session-cookies";

export async function POST() {
  clearPlatformAdminSessionCookies();
  return NextResponse.json({ message: "Sesión cerrada" });
}
