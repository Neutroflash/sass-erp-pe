import { CheckoutClient } from "./CheckoutClient";

// El guard de publicStorefront vive en (storefront)/layout.tsx, no acá.
export default function CheckoutPage() {
  return <CheckoutClient />;
}
