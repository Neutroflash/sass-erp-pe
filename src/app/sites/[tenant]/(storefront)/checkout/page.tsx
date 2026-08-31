import { getCurrentTenant } from "@/lib/tenant-context";
import { requirePublicStorefront } from "@/lib/feature-guards";
import { CheckoutClient } from "./CheckoutClient";

export default async function CheckoutPage() {
  const tenant = await getCurrentTenant();
  await requirePublicStorefront(tenant.id);

  return <CheckoutClient />;
}
