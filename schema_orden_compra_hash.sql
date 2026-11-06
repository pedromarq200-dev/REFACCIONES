-- Agrega el campo "orden_compra_hash" a Notas de venta: una huella digital (SHA-256) del PDF/foto
-- de la orden de compra que se importó para esa nota. Sirve para detectar si el mismo documento ya
-- se usó antes en otra nota (ej. se vuelve a subir por error el mismo PDF), y avisar antes de
-- continuar. Ver README.md / app.js, "procesarPdfSeleccionado".
alter table notas_venta add column if not exists orden_compra_hash text;
