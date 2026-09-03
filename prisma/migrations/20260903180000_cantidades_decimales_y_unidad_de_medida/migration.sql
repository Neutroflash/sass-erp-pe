-- Cantidades con decimales y unidad de medida por producto.
--
-- Por qué: un negocio que vende telas despacha 3.5 metros. Con `integer` no hay forma de
-- representar esa venta, ni su stock, ni su comprobante ante SUNAT.
--
-- `integer` → `numeric(12,3)` es un ensanchamiento: todo valor existente entra sin pérdida y
-- Postgres lo hace sin reescribir la tabla fila por fila en un ALTER de este tipo, así que es
-- seguro sobre datos ya cargados. La operación inversa (volver a integer) sí perdería datos —
-- por eso no hay migración de vuelta.

-- Stock e inventario
ALTER TABLE "product_variants"
  ALTER COLUMN "stock" TYPE DECIMAL(12,3),
  ALTER COLUMN "stock" SET DEFAULT 0,
  ALTER COLUMN "reserved_stock" TYPE DECIMAL(12,3),
  ALTER COLUMN "reserved_stock" SET DEFAULT 0;

-- Unidad de medida del producto (catálogo 03 de SUNAT). NIU = unidad: el valor con el que
-- se comportaba todo hasta ahora, así que los productos existentes no cambian de significado.
ALTER TABLE "product_variants"
  ADD COLUMN "unit_code" TEXT NOT NULL DEFAULT 'NIU';

-- Kardex
ALTER TABLE "stock_movements"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3);

-- Ventas
ALTER TABLE "order_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3);

-- Comprobantes: la unidad se congela en el ítem, igual que la descripción y el precio, para que
-- un comprobante ya emitido siga diciendo lo mismo que se le envió a SUNAT.
ALTER TABLE "invoice_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3),
  ADD COLUMN "unit_code" TEXT NOT NULL DEFAULT 'NIU';

-- Guías de remisión
ALTER TABLE "dispatch_guide_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3);
