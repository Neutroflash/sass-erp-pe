import { prisma } from "./prisma";
import { DEFAULT_TENANT_FEATURES, parseTenantFeatures, TenantFeatures } from "@/domain/tenant-features";

/**
 * Server-only. Trae la matriz de features real de un tenant. Si el tenant no existe (llamado con
 * un id inválido/borrado), cae al default en vez de lanzar — quien llama ya debería haber
 * confirmado que el tenant existe (getCurrentTenant() usa notFound() para eso); esto es una red
 * de seguridad, no el punto donde se valida la existencia del tenant.
 */
export async function getTenantFeatures(tenantId: string): Promise<TenantFeatures> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { features: true } });
  if (!tenant) return DEFAULT_TENANT_FEATURES;
  return parseTenantFeatures(tenant.features);
}

/** Verifica un solo módulo — úsalo en Server Components, Server Actions y Route Handlers por
 * igual, es la única función que debería consultarse para decidir "¿este tenant tiene X activo?". */
export async function hasFeature(tenantId: string, featureKey: keyof TenantFeatures): Promise<boolean> {
  const features = await getTenantFeatures(tenantId);
  return features[featureKey];
}
