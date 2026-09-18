# Control de Notas de Venta

Sistema simple para generar notas de venta de autopartes (con el mismo formato que ya usas), imprimirlas para
firma de recibido, y llevar el control de qué notas ya se entregaron y cuáles están pendientes.

No requiere instalación ni servidor: es una página web que corre directamente en tu navegador. Toda la
información se guarda en este navegador (localStorage), por lo que es importante exportar respaldos con
frecuencia desde la pestaña **Ajustes**.

## Cómo usarlo

1. Abre `index.html` con doble clic (se abre en tu navegador).
2. En **+ Nueva Nota** llena los datos. Los que copias de la orden de compra de tu cliente son:
   - **Cliente / Domicilio**: nombre de la empresa y sucursal (ej. Auto Plus / Universidad).
   - **O/I**: número de orden interna del cliente.
   - **Folio de compra**: el folio de la orden de compra (ej. OCUNI-218).
   - **Placas** y **Entrega**: dónde se entrega la mercancía.
   - Por cada pieza: cantidad, descripción (agrega el modelo/año del vehículo) y precio sin IVA. El importe
     con IVA y el total se calculan solos.
3. Al guardar, se abre automáticamente la vista de impresión con el mismo formato de tu nota física, lista
   para imprimir y que el cliente firme de recibido.
4. En **Notas de Venta** puedes buscar, reimprimir, editar o eliminar cualquier nota.
5. En **Entregas** ves todas las notas pendientes de entrega. Cuando el cliente firma la nota física, da clic
   en "Marcar entregada" y registra la fecha y quién recibió.
6. En **Ajustes** puedes exportar un respaldo en JSON (recomendado hacerlo seguido) o importarlo en otra
   computadora/navegador.

## Notas

- El nombre del negocio (arriba a la izquierda) es editable y se usa en la nota impresa y en el texto del
  pagaré.
- El % de IVA es editable por nota (16% por default).
- Si necesitas usar el sistema desde varios dispositivos al mismo tiempo (por ejemplo, tú y un empleado en
  otra computadora viendo las mismas notas en tiempo real), este enfoque local no lo permite: habría que
  agregar un servidor con base de datos compartida. Avísame si llegas a necesitar eso.
