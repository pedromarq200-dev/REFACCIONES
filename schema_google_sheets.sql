-- Agrega el campo opcional "google_sheet_id" a Clientes: el ID (o se pega la URL completa, la
-- app saca el ID solita) de la hoja de Google Sheets que se comparte con ese cliente, para que el
-- Worker la mantenga actualizada sola cada hora. Ver README.md, "Compartir con tus clientes por
-- Google Sheets".
alter table clientes add column if not exists google_sheet_id text;
