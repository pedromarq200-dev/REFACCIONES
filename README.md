# Control de Notas de Venta

Plataforma web para generar notas de venta de autopartes (con el mismo formato que ya usas), imprimirlas para
firma de recibido, y llevar el control de entregas — accesible desde el celular o cualquier computadora, con
los mismos datos sincronizados en todos los dispositivos.

## Cómo está armado

- **Frontend**: páginas web simples (`index.html`, `style.css`, `app.js`), sin instalación ni build.
- **Base de datos y login**: [Supabase](https://supabase.com) (gratis, sin tarjeta). Ahí viven tus notas,
  compartidas entre todos los dispositivos donde inicies sesión.
- **Hospedaje**: GitHub Pages (gratis), usando este mismo repositorio, para tener una URL fija.

## Paso 1 — Crear tu proyecto en Supabase

1. Entra a https://supabase.com y crea una cuenta gratuita (con tu correo o con GitHub).
2. Crea un nuevo proyecto (elige cualquier nombre y una contraseña de base de datos; guárdala, no la
   necesitarás en el día a día).
3. Espera 1-2 minutos a que el proyecto termine de crearse.
4. En el menú izquierdo ve a **SQL Editor** → **New query**, pega todo el contenido del archivo
   [`schema.sql`](./schema.sql) de este repositorio, y da click en **Run**. Esto crea las tablas de notas y
   la configuración del negocio, con los permisos correctos.
5. Ve a **Settings** → **API**. Copia:
   - **Project URL**
   - **anon public key**
6. Abre el archivo [`config.js`](./config.js) de este repositorio y reemplaza los dos valores de ejemplo con
   los que copiaste. Guarda y sube el cambio (commit + push).
7. Si ya tenías el proyecto configurado desde antes (`schema.sql` ya corrido) y solo necesitas agregar el
   catálogo de Clientes, corre en el mismo SQL Editor el contenido de
   [`schema_clientes.sql`](./schema_clientes.sql) — no hace falta repetir todo `schema.sql`.
8. Para agregar las sucursales por cliente (a dónde puedes entregar a cada uno), corre también
   [`schema_sucursales.sql`](./schema_sucursales.sql).
9. Para que se guarde e imprima junto con la nota la orden de compra original (PDF o foto) cuando
   la importes, corre también [`schema_orden_compra.sql`](./schema_orden_compra.sql).
10. Para poder tomar una foto con la cámara como evidencia de entrega, corre también
    [`schema_evidencia_entrega.sql`](./schema_evidencia_entrega.sql).

## Paso 2 — Crear tu usuario (y los de tus empleados, si aplica)

Por seguridad, no hay pantalla pública para "crear cuenta": los usuarios se crean desde el panel de Supabase.

1. En Supabase, ve a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Escribe tu correo y una contraseña. Marca la opción de **Auto Confirm User** (para no tener que confirmar
   por correo).
3. Repite por cada persona que necesite acceso (por ejemplo, un empleado que reciba mercancía).

Con ese correo y contraseña iniciarás sesión en la app, desde el celular o la computadora.

## Paso 3 — Publicar la app con una URL fija (Netlify)

La app está publicada con **Netlify**, conectado directamente a este repositorio de GitHub: cada vez que se
sube un cambio a la rama `claude/sales-notes-system-urcre3`, Netlify la vuelve a publicar sola, sin hacer
nada manual.

URL actual: **https://jade-florentine-2a193d.netlify.app**

Abre esa URL desde tu celular o computadora — ahí inicias sesión con el usuario que creaste en el paso 2.

Puedes agregar esa URL a la pantalla de inicio de tu celular (desde el navegador: "Agregar a pantalla de
inicio") para que se sienta como una app normal. En iPhone, ese ícono de pantalla de inicio no puede abrir
el diálogo de impresión (es una limitación del propio iPhone, no hay forma de arreglarla con código); si
intentas imprimir desde ahí, la app te ofrece un botón para abrir esa misma nota en Safari, donde sí se
puede imprimir sin problema.

## Uso del día a día

1. **+ Nueva Nota** — dos formas de llenarla:
   - **Importar desde PDF o foto**: si el cliente te manda la orden de compra en PDF, o solo una foto/imagen
     (como las de Martínez Abarca), dale clic a "📄 Importar datos" y los campos se llenan solos (folio, O/I,
     placas, vehículo y las piezas con su precio). Con PDF también detecta cliente/sucursal y RFC
     automáticamente; con fotos, el reconocimiento de texto (OCR) es menos preciso — sellos, firmas o mala
     calidad de foto pueden hacer que falte algún dato (revísalo siempre antes de guardar, la app te avisa
     cuando viene de una foto para que lo revises con más cuidado). Si el nombre de empresa + sucursal que
     trae el encabezado del PDF (ej. "Auto Plus Universidad") coincide con un cliente y una sucursal ya
     registrados en **Clientes**, se usa la razón social, el RFC y la dirección completa de esa sucursal; si
     no encuentra la sucursal, te avisa para que lo revises a mano. Algunos PDF de Auto Plus son en realidad
     una foto/escaneo de la orden (sin texto real) — en ese caso la app lo detecta sola y lo lee con el mismo
     OCR que usa para fotos; en ese formato, el campo "Ubicacion" del documento (ej. "Equipo 4") indica la
     sucursal: "Equipo 4" se entrega en Santo Domingo, y cualquier otro valor (Equipo 1, "Fuera Taller", etc.)
     se entrega por default en San Nicolás. Si el documento trae un proveedor distinto al nombre del negocio
     (campo "Proveedor" de la orden), no se importa nada y se muestra un aviso de que esa orden no pertenece
     a este negocio.
   - **A mano**, copiando los datos de la orden de compra del cliente:
     - **Cliente / RFC / Domicilio**: al elegir un cliente ya dado de alta en la pestaña **Clientes** (basta
       con empezar a escribir su nombre), se llenan solos el nombre completo (razón social) y el RFC. Si ese
       cliente tiene más de una sucursal registrada, aparece la pregunta de a cuál entregar; al elegirla,
       **Domicilio** se llena con la dirección completa (calle, número, colonia, municipio y código postal)
       y **Entrega** con el nombre corto de la sucursal. Si solo tiene una sucursal, la usa directo sin
       preguntar; si no tiene ninguna registrada, la pregunta ni siquiera aparece y usa el domicilio general
       del cliente.
     - **O/I**: número de orden interna del cliente.
     - **Folio de compra**: folio de la orden de compra (ej. OCUNI-218).
     - **Placas** y **Entrega**: dónde se entrega la mercancía.
     - Por cada pieza: cantidad, descripción (agrega el modelo/año del vehículo) y precio sin IVA. El importe
       con IVA y el total se calculan solos.
2. Al guardar, se prepara la vista de impresión con el mismo formato de tu nota física, lista para que el
   cliente firme de recibido, y aparece un botón rojo abajo, "🖨️ Toca aquí para imprimir" — dale clic ahí
   (en vez de imprimirse solo) para que se abra el diálogo de impresión; en el celular (sobre todo iPhone)
   es necesario este paso extra porque, si no, el navegador bloquea la impresión. Si estás usando la app
   desde el ícono de la pantalla de inicio (no desde Safari), ese botón cambia por uno para abrir la nota
   en Safari, ya que desde el ícono el iPhone no permite imprimir de ninguna forma. Si la nota se creó
   importando un PDF o foto de la orden de compra, esa orden se imprime junto con la nota (en una hoja
   aparte, después). Si la orden se importó como foto (ej. Martínez Abarca), se convierte sola a PDF antes
   de guardarla, para que siempre quede como un PDF normal, fácil de ver e imprimir. Esto aplica también al
   reimprimir la nota desde **Notas de Venta** o **Entregas** más adelante. Además, en esas mismas
   pantallas aparece un botón 📎 "Ver orden de compra" (solo si la nota tiene una adjunta) para verla sin
   necesidad de imprimir.
3. **Notas de Venta**: se muestra un resumen por cliente (número de notas, cuántas pendientes y el total).
   Da clic en un cliente para desglosar sus notas y ahí buscar, reimprimir, editar o eliminar cualquiera.
   Si buscas algo (folio, placas, orden de ingreso, etc.) el desglose del cliente correspondiente se abre
   solo. Se actualiza en vivo si otra persona crea o modifica una nota desde otro dispositivo.
4. **Entregas**: notas pendientes de entrega. El botón **Marcar entregada** es para cuando no hay
   foto (ej. desde una computadora) o quieres registrar también quién recibió y notas a mano.

   Para dejar evidencia con foto, no hace falta buscar la nota primero: arriba, en cualquier
   pantalla, está el botón **📷 Subir evidencia**. Ahí puedes elegir una sola foto o varias de un
   jalón (tomadas en el momento o ya guardadas) — las procesa una por una y avisa cuando termina.
   Por cada foto, la app la empareja sola con la nota correspondiente y la marca como entregada con
   la fecha de hoy, sin tener que encontrarla primero en la lista. Cada nota impresa trae un código
   QR arriba a la derecha (junto a fecha/cliente/RFC) — leerlo es casi instantáneo y muy confiable, así que es
   la primera forma en que la app intenta reconocer la foto; si esa nota se imprimió antes de tener
   QR, o la foto no salió clara, cae de vuelta a leer el folio como texto. Si subiste solo una foto
   y no logra reconocerla, te pide el folio a mano; si subiste varias, las que no pudo reconocer
   quedan listadas al final para volver a subirlas de una en una. Esa foto queda adjunta a esa nota
   para siempre — para verla después, ve a **Notas de Venta**, abre esa nota y da clic al ícono 📷.
5. **Clientes**: catálogo de clientes con sus datos fiscales (razón social, RFC, régimen fiscal, uso CFDI,
   forma y método de pago, domicilio, etc. — los mismos catálogos del SAT). Al guardar un cliente nuevo, el
   formulario se queda abierto para que agregues de una vez sus **sucursales** (a dónde le puedes entregar) —
   esas mismas sucursales son las que se te ofrecen al elegir ese cliente en una nota.
6. **🏢 Empresa**: control visual con el monto de venta (con IVA incluido) por cliente, dividido en
   entregado y pendiente — tarjetas con los totales generales y una gráfica de barras (una por cliente,
   ordenada de mayor a menor). El botón "Ver tabla" cambia a una tabla con los mismos números, por si la
   prefieres.
7. **Ajustes**: exportar un respaldo en JSON, y el nombre del negocio que aparece en las notas impresas
   (se sincroniza para todos).
8. Todos los campos de texto de la nota (cliente, domicilio, placas, descripción de las piezas, etc.) se
   guardan en MAYÚSCULAS automáticamente, aunque la orden de compra del cliente venga en minúsculas.
9. Cuando se publica una mejora nueva, aparece un aviso abajo a la derecha ("Nueva actualización disponible").
   Dale clic para recargar la app y ver los cambios — no es necesario que lo hagas manualmente.

## Nota para quien mantenga el código

Cada vez que se publique un cambio, hay que actualizar el valor de `version.json` (cualquier texto distinto
al anterior, por ejemplo la fecha/hora del cambio). Así es como la app detecta que hay una versión nueva y
muestra el aviso de actualización a quienes la tengan abierta.

Al mismo tiempo, hay que actualizar ese mismo texto en el `?v=...` de `style.css` y `app.js` en
`index.html`. Sin eso, el navegador (o Cloudflare) puede seguir sirviendo la versión vieja de esos dos
archivos aunque `version.json` ya haya cambiado y el aviso de actualización haya salido — dando la
impresión de que el cambio nunca se aplicó, aunque sí esté publicado.

Los archivos `qrcode-generator.min.js` (generar el QR del folio) y `jsqr.min.js` (leerlo) están incluidos
directamente en el repositorio en vez de cargarse desde un servicio externo, para no depender de que ese
servicio esté disponible. Son librerías públicas y gratuitas (licencia MIT): [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
y [jsQR](https://github.com/cozmo/jsQR).

## Seguridad

- Solo quien tenga usuario y contraseña (creados por ti en Supabase) puede ver o modificar las notas.
- El "anon key" en `config.js` es público a propósito (así funciona Supabase); la protección real la dan las
  políticas de la base de datos definidas en `schema.sql`, que exigen haber iniciado sesión.
