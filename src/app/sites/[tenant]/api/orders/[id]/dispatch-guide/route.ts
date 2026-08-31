import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { issueDispatchGuide, GreNotConfiguredError } from "@/domain/dispatch-guides/issue-dispatch-guide";

const schema = z.object({
  destinatario: z.object({
    documentTypeCode: z.string().min(1),
    documentNumber: z.string().trim().min(1),
    name: z.string().trim().min(2),
  }),
  fechaTraslado: z.string().datetime().or(z.string().min(10)),
  pesoTotalKg: z.number().positive(),
  origen: z.object({ ubigeo: z.string().length(6), address: z.string().trim().min(3) }),
  destino: z.object({ ubigeo: z.string().length(6), address: z.string().trim().min(3) }),
  vehiculoPlaca: z.string().trim().min(4),
  chofer: z.object({
    documentNumber: z.string().trim().min(1),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    license: z.string().trim().min(1),
  }),
});

// Gateada por `sunatInvoicing` — misma dependencia real (certificado digital del tenant) que la
// facturación, no un módulo aparte. Motivo de traslado fijo "01" (venta) y modalidad "transporte
// privado" — ver el comentario grande en domain/dispatch-guides/xml-builder.ts sobre el alcance v1.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "sunatInvoicing");
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const order = await withTenantRLS(prisma, auth.tenantId, (tx) =>
    tx.order.findFirst({
      where: { id: params.id, tenantId: auth.tenantId },
      include: { items: { include: { variant: { select: { name: true, sku: true } } } }, dispatchGuide: true },
    }),
  );
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (order.dispatchGuide) {
    return NextResponse.json({ error: "Esta orden ya tiene una guía de remisión" }, { status: 409 });
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { businessName: true } });

  try {
    const guide = await issueDispatchGuide(prisma, {
      tenantId: auth.tenantId,
      orderId: order.id,
      destinatario: parsed.data.destinatario,
      motivoTrasladoCodigo: "01",
      fechaTraslado: new Date(parsed.data.fechaTraslado),
      pesoTotalKg: parsed.data.pesoTotalKg,
      origen: parsed.data.origen,
      destino: parsed.data.destino,
      vehiculoPlaca: parsed.data.vehiculoPlaca,
      chofer: parsed.data.chofer,
      lineas: order.items.map((item) => ({
        variantId: item.variantId,
        description: `${item.variant.name} (${item.variant.sku})`,
        quantity: item.quantity,
        unitCode: "NIU",
      })),
      emisorBusinessName: tenant.businessName,
    });
    return NextResponse.json({ dispatchGuide: { id: guide.id, series: guide.series, number: guide.number, numTicket: guide.numTicket } }, { status: 201 });
  } catch (err) {
    if (err instanceof GreNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(`[dispatch-guide] no se pudo emitir para la orden ${order.id}:`, err);
    return NextResponse.json({ error: "No se pudo emitir la guía de remisión" }, { status: 502 });
  }
}
