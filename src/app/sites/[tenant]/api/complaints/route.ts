import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { enforceRateLimit } from "@/lib/rate-limit";
import { submitComplaint } from "@/domain/complaints/submit-complaint";
import { notifyComplaintSubmitted } from "@/domain/complaints/notify-complaint-submitted";

const complaintSchema = z.object({
  type: z.enum(["RECLAMO", "QUEJA"]),
  consumerName: z.string().trim().min(2),
  consumerDocType: z.enum(["DNI", "CE", "PASAPORTE"]),
  consumerDocNumber: z.string().trim().min(6),
  consumerAddress: z.string().trim().min(5),
  consumerPhone: z.string().trim().optional(),
  consumerEmail: z.string().email(),
  productDescription: z.string().trim().min(3),
  claimedAmount: z.number().positive().optional(),
  purchaseDate: z.coerce.date().optional(),
  detail: z.string().trim().min(10),
  request: z.string().trim().min(5),
});

// Público, sin guard de publicStorefront a propósito: el Libro de Reclamaciones es obligatorio
// para cualquier negocio que vende a consumidores, incluso uno "solo POS" con la tienda pública
// desactivada — ver el comentario en schema.prisma sobre Complaint.
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { scope: "complaints", limit: 10, windowSeconds: 3600 });
  if (limited) return limited;

  const tenant = await getCurrentTenant();

  const parsed = complaintSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const complaint = await submitComplaint(prisma, tenant.id, parsed.data);
  await notifyComplaintSubmitted(prisma, tenant.id, complaint);

  return NextResponse.json({ folio: complaint.folio }, { status: 201 });
}
