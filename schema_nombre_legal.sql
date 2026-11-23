-- Agrega "nombre_legal" a la configuración del negocio: el nombre/razón social con el que ya te
-- conocen tus proveedores (el que traen sus órdenes de compra en el campo "Proveedor"), aparte del
-- nombre/marca que se ve en tus notas y documentos (ej. si cambias la marca a "CollisionPro" pero
-- tus proveedores te siguen conociendo como tu nombre legal). Sin esto, cambiar el nombre/marca del
-- negocio rompía el aviso de "esta orden no parece ser para tu negocio" al importar una orden de
-- compra. Ver README.md / app.js, "nombreLegalInput".
alter table negocio_config add column if not exists nombre_legal text;
