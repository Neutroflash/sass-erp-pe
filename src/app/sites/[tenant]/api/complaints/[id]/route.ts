import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { respondToComplaint } from "@/domain/complaints/respond-complaint";

const responseSchema = z.object({ response: z.string().trim().min(3) });

// OWNER-only, igual que Configuración: responder un reclamo es una acción legal del negocio, no
// una tarea operativa del día a día que un SELLER deba poder hacer.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = responseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await respondToComplaint(prisma, auth.tenantId, params.id, parsed.data.response);
  if (!updated) {
    return NextResponse.json({ error: "Reclamo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ message: "Respuesta guardada" });
}
