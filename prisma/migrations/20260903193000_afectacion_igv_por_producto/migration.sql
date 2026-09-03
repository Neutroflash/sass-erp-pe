-- Afectación al IGV por producto (catálogo 07 de SUNAT).
--
-- Por qué: hasta acá el proyecto asumía que todo lo que vende un negocio es gravado al 18%. Un
-- negocio que vende productos del Apéndice I del TUO de la Ley del IGV (exonerados) emite
-- comprobantes con IGV cero y bajo un esquema de impuesto distinto — facturarlos como gravados le
-- cobra al cliente un impuesto que no corresponde y declara una base imponible inexistente.
--
-- '10' (gravado - operación onerosa) es exactamente el comportamiento anterior, así que ningún
-- producto ni comprobante ya cargado cambia de significado con esta migración.

ALTER TABLE "product_variants"
  ADD COLUMN "tax_affectation_code" TEXT NOT NULL DEFAULT '10';

-- Congelado en el ítem, igual que unit_code: un comprobante emitido debe seguir declarando la
-- afectación con la que se envió a SUNAT aunque el producto se reclasifique después.
ALTER TABLE "invoice_items"
  ADD COLUMN "tax_affectation_code" TEXT NOT NULL DEFAULT '10';
