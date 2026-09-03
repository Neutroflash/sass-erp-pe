# Inventario de demostración

`inventario-demo.csv` es un inventario **de demostración**, listo para cargar desde
`/panel/inventario` → **Importar**.

## Qué es y qué no es

Los productos, unidades y precios públicos están tomados de una captura del sistema que usa hoy un
negocio textil en fase beta — sirven para que ese negocio reconozca su propio catálogo en pantalla
en vez de ver "Producto de prueba 1". Todo lo demás es inventado, y conviene tenerlo claro antes de
sacar conclusiones de una demo:

- **El stock es ficticio.** En el inventario original casi todo está en cero o en negativo
  (`-25`, `-18.5`, `-50.5`): saldos acumulados por un sistema que permite vender sin existencias.
  Un inventario así no permite demostrar una venta, así que acá lleva cantidades positivas
  plausibles. **No son las existencias reales de nadie.**
- **Los costos son inventados.** La captura no los muestra (esa columna no estaba a la vista). Están
  puestos alrededor del 60-65% del precio para que el margen del panel muestre algo razonable.
- **La afectación al IGV es una suposición, y es la que hay que confirmar.** El sistema original
  marca `Tiene Igv (Venta): No` en **todas** sus filas. Acá van todos como **gravados**, porque
  telas, agujas y alfileres no figuran en el Apéndice I del TUO de la Ley del IGV — no son bienes
  exonerados. Lo más probable es que ese "No" signifique "mi sistema no discrimina el IGV" (típico
  de un negocio en RUS), no que los bienes estén exonerados.

  **Esto hay que preguntárselo al negocio antes de emitir un solo comprobante**, porque decide si
  cada boleta lleva IGV o no. Si la respuesta es que sí están exonerados, es cambiar una columna:
  el importador traduce `Sí`/`No` a gravado/exonerado automáticamente (y avisa cuando lo hace).

## Las dos filas agrupadas

Las últimas seis filas usan la columna `Grupo` para demostrar la respuesta a una pregunta concreta
del negocio: *"tela toalla en colores llanos se registra normal, ¿pero los estampados que solo se
diferencian por código?"*.

Se cargan como **dos productos con tres variantes cada uno** ("Tela toalla llana" y "Tela toalla
estampada"), no como seis productos sueltos. Es la diferencia entre un catálogo navegable y una
lista alfabética de 200 filas donde cada estampado se pierde — que es exactamente el problema que
tiene hoy.

## Formato

El importador acepta las columnas con los nombres del sistema de origen (`Cód. Interno`,
`P.Público`, `Tiene Igv (Venta)`), separador `;` o `,`, decimales con coma o punto, y `S/` en los
precios. No hace falta reformatear el export antes de subirlo.
