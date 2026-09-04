-- Borrar un negocio quedaba bloqueado por sus reparticiones de pago.
--
-- `Tenant` elimina en cascada sus `orders`, pero `payment_allocations.order_id` estaba en RESTRICT,
-- así que la eliminación fallaba a mitad de camino y dejaba el tenant a medio borrar. Encontrado
-- porque el teardown de los tests de la nota de deuda no podía limpiar su propio negocio.
--
-- Cascade es además lo correcto semánticamente: una repartición es un detalle del pedido, no un
-- registro independiente — sin el pedido no significa nada. En la operación normal nada borra
-- pedidos (se cancelan), así que esto solo aplica al borrado de un negocio completo.
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_order_id_fkey";
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
