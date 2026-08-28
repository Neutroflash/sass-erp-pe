// Landing pública del SaaS (tusaas.pe) — no confundir con la tienda de un tenant, que vive bajo
// el route group (tenant) y se resuelve por subdominio/dominio propio (ver middleware.ts).
export default function MarketingHomePage() {
  return (
    <main>
      <h1>SaaS E-Commerce & ERP para pymes en Perú</h1>
      <p>Inventario, ventas, tienda en línea y facturación electrónica SUNAT — todo en un panel.</p>
    </main>
  );
}
