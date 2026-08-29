import { CartHydration } from "@/components/providers/CartHydration";

export default function TenantSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CartHydration />
      {children}
    </>
  );
}
