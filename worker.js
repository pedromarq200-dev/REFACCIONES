// Worker de la app: sirve los archivos estáticos de siempre, y además corre cada hora (ver
// wrangler.jsonc → triggers.crons) un respaldo a GitHub y, si está configurado, una actualización
// de las hojas de Google Sheets que se comparten con los clientes (ver README.md, "Compartir con
// tus clientes por Google Sheets").
//
// Necesita estos secretos configurados en Cloudflare (nunca van en este archivo ni en el repo):
//   wrangler secret put SUPABASE_SERVICE_ROLE_KEY     ← Panel de Supabase > Settings > API > service_role
//   wrangler secret put GITHUB_TOKEN                  ← Token de GitHub con permiso de escritura al repo de respaldos
//   wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL   ← "client_email" del JSON de la cuenta de servicio de Google
//   wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY     ← "private_key" del mismo JSON (el bloque completo, con los \n)
// Y dos variables normales (sí pueden ir en wrangler.jsonc, no son secretas):
//   GITHUB_REPO   ← ej. "pedromarq200-dev/refacciones-respaldos"
//   GITHUB_BRANCH ← ej. "main"
//
// Los dos secretos de Google son opcionales: si no están configurados, la actualización a Google
// Sheets simplemente se omite (sin tronar el respaldo a GitHub, que es independiente).

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(hacerRespaldo(env));
    ctx.waitUntil(sincronizarGoogleSheets(env));
  },
};

// Tablas que se respaldan completas. Los archivos (fotos/PDFs de órdenes de compra, evidencias de
// entrega, documentos adicionales) NO se incluyen aquí — viven en Supabase Storage, no en estas
// tablas, y este respaldo por ahora solo cubre los datos, no los archivos.
const TABLAS_A_RESPALDAR = ["notas_venta", "clientes", "sucursales", "negocio_config"];

async function hacerRespaldo(env) {
  const faltantes = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GITHUB_TOKEN", "GITHUB_REPO"]
    .filter(k => !env[k]);
  if (faltantes.length) {
    throw new Error(`Respaldo no configurado, faltan estas variables/secretos: ${faltantes.join(", ")}`);
  }

  const respaldo = { generado_en: new Date().toISOString() };
  for (const tabla of TABLAS_A_RESPALDAR) {
    respaldo[tabla] = await leerTablaSupabase(env, tabla);
  }

  await subirArchivoAGitHub(env, JSON.stringify(respaldo, null, 2));
}

async function leerTablaSupabase(env, tabla) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${tabla}?select=*`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resp.ok) {
    throw new Error(`No se pudo leer la tabla "${tabla}" de Supabase: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

// Sube el respaldo a un solo archivo fijo (respaldos/notas-venta.json) que se sobreescribe en
// cada corrida — el historial de commits del repo ya sirve como el historial de respaldos, sin
// ir acumulando un archivo nuevo por cada hora que pasa.
async function subirArchivoAGitHub(env, contenidoJson) {
  const ruta = "respaldos/notas-venta.json";
  const rama = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${ruta}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "refacciones-respaldo-worker",
  };

  // El API de GitHub exige el sha del archivo actual para poder actualizarlo (si no, piensa que
  // se quiere crear uno nuevo y truena si ya existe). En la primerísima corrida el archivo aún no
  // existe (404) y no hace falta mandar ningún sha.
  let shaActual;
  const respActual = await fetch(`${url}?ref=${rama}`, { headers });
  if (respActual.ok) {
    shaActual = (await respActual.json()).sha;
  } else if (respActual.status !== 404) {
    throw new Error(`No se pudo consultar el respaldo anterior en GitHub: ${respActual.status} ${await respActual.text()}`);
  }

  const resp = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Respaldo automático ${new Date().toISOString()}`,
      content: base64Utf8(contenidoJson),
      branch: rama,
      ...(shaActual ? { sha: shaActual } : {}),
    }),
  });
  if (!resp.ok) {
    throw new Error(`No se pudo subir el respaldo a GitHub: ${resp.status} ${await resp.text()}`);
  }
}

function base64Utf8(str) {
  // Por bloques de 32k para no reventar el límite de argumentos de fromCharCode cuando el
  // respaldo crezca (con el negocio creciendo, tarde o temprano pesa más que unos cuantos KB).
  const bytes = new TextEncoder().encode(str);
  const tamanoBloque = 0x8000;
  let binario = "";
  for (let i = 0; i < bytes.length; i += tamanoBloque) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanoBloque));
  }
  return btoa(binario);
}

// ===================== Google Sheets: estado de cuenta por cliente =====================
// Por cada cliente que tenga configurado un "google_sheet_id" (campo opcional en Clientes), se
// reescribe su hoja con sus notas actuales — así el cliente ve, sin que nadie lo actualice a
// mano, si una nota se canceló/devolvió, sigue pendiente, ya se entregó o ya se pagó. Esto es lo
// que evita el problema original: cobrar algo que ya se había cancelado porque la hoja compartida
// se había quedado desactualizada.
async function sincronizarGoogleSheets(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_KEY) return; // opcional, sin configurar todavía

  const [clientesTabla, notasTabla] = await Promise.all([
    leerTablaSupabase(env, "clientes"),
    leerTablaSupabase(env, "notas_venta"),
  ]);
  const clientesConHoja = clientesTabla.filter(c => c.google_sheet_id);
  if (!clientesConHoja.length) return;

  const token = await obtenerTokenGoogle(env);

  for (const cliente of clientesConHoja) {
    const nombreCliente = (cliente.razon_social || cliente.clave || "").trim().toUpperCase();
    const notasCliente = notasTabla.filter(n => (n.cliente || "").trim().toUpperCase() === nombreCliente);
    try {
      await escribirHojaCliente(token, cliente.google_sheet_id, filasParaHojaCliente(notasCliente));
    } catch (err) {
      // Un cliente con la hoja mal compartida (o borrada) no debe tumbar la actualización de los
      // demás — se deja registrado en los Logs del Worker para revisarlo después.
      console.error(`No se pudo actualizar la hoja de "${nombreCliente}" (${cliente.google_sheet_id}):`, err.message);
    }
  }
}

// Una fila por pieza (igual que el desglose de Estado de cuenta dentro de la app), con el
// estatus bien claro — "Cancelada" incluida a propósito, en vez de desaparecer la nota, para que
// el cliente la vea y no la vaya a pagar por error.
function filasParaHojaCliente(notasCliente) {
  const encabezados = ["Folio", "Fecha", "Vehículo", "Descripción", "Cantidad", "Precio unitario", "Importe", "Estatus", "Pagado"];
  const filas = [encabezados];
  notasCliente
    .slice()
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
    .forEach(nota => {
      const estatus = nota.cancelada ? "Cancelada" : (nota.estatus === "entregada" ? "Entregada" : "Pendiente");
      const items = Array.isArray(nota.items) ? nota.items : [];
      items.forEach(it => {
        const cantidad = Number(it.cantidad) || 0;
        const precio = Number(it.precioSinIva) || 0;
        filas.push([
          nota.folio_interno || "",
          nota.fecha || "",
          nota.vehiculo || "",
          it.descripcion || "",
          cantidad,
          precio,
          Number((cantidad * precio).toFixed(2)),
          estatus,
          nota.pagado ? "Sí" : "No",
        ]);
      });
    });
  return filas;
}

// Limpia la pestaña "Notas" (por si la corrida anterior dejó más filas de las que ahora hacen
// falta) y escribe el contenido actual de un jalón.
async function escribirHojaCliente(token, sheetId, filas) {
  const hoja = "Notas";
  const headers = { Authorization: `Bearer ${token}` };

  const respLimpiar = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(hoja + "!A1:Z5000")}:clear`,
    { method: "POST", headers }
  );
  if (!respLimpiar.ok) {
    throw new Error(`No se pudo limpiar la hoja antes de escribir: ${respLimpiar.status} ${await respLimpiar.text()}`);
  }

  const respEscribir = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(hoja + "!A1")}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ values: filas }),
    }
  );
  if (!respEscribir.ok) {
    throw new Error(`No se pudo escribir en la hoja: ${respEscribir.status} ${await respEscribir.text()}`);
  }
}

// Google exige un token de acceso (OAuth2) para poder escribir, y para conseguirlo con una
// cuenta de servicio hay que armar y firmar un JWT con su llave privada (flujo estándar de
// Google, documentado en https://developers.google.com/identity/protocols/oauth2/service-account).
// Cloudflare Workers no tiene las librerías de Node para esto, pero sí trae el Web Crypto API
// (SubtleCrypto), que alcanza para firmar en RS256 sin depender de ningún paquete externo.
async function obtenerTokenGoogle(env) {
  const ahora = Math.floor(Date.now() / 1000);
  const encabezado = { alg: "RS256", typ: "JWT" };
  const reclamos = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  };
  const sinFirmar = `${base64UrlJson(encabezado)}.${base64UrlJson(reclamos)}`;
  const firma = await firmarRS256(env.GOOGLE_SERVICE_ACCOUNT_KEY, sinFirmar);
  const jwt = `${sinFirmar}.${firma}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    throw new Error(`No se pudo obtener el token de Google: ${resp.status} ${await resp.text()}`);
  }
  return (await resp.json()).access_token;
}

function base64UrlJson(obj) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function base64UrlBytes(bytes) {
  const tamanoBloque = 0x8000;
  let binario = "";
  for (let i = 0; i < bytes.length; i += tamanoBloque) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanoBloque));
  }
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function firmarRS256(llavePrivadaPem, datos) {
  const llave = await importarLlavePrivada(llavePrivadaPem);
  const firma = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, llave, new TextEncoder().encode(datos));
  return base64UrlBytes(new Uint8Array(firma));
}

async function importarLlavePrivada(pem) {
  // El secreto se guarda tal cual viene en el JSON de Google, con saltos de línea \n reales
  // (Cloudflare los conserva) o escapados como texto "\\n" (si se pegó de un solo renglón) —
  // cualquiera de los dos formatos se limpia igual, dejando solo el contenido en base64.
  const limpio = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const binario = atob(limpio);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return crypto.subtle.importKey("pkcs8", bytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
