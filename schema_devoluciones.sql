-- Agrega el campo "devoluciones" a Notas de venta: un historial (en JSON) de las devoluciones
-- parciales que se le registren a esa nota -- cuando el cliente regresa una o varias piezas sin
-- cancelar la nota completa. Cada devolución resta su importe del total de la nota (ver
-- totalesDeNota en app.js) y se puede reimprimir como comprobante firmable. Ver README.md /
-- app.js, "Devoluciones por nota".
alter table notas_venta add column if not exists devoluciones jsonb not null default '[]';
