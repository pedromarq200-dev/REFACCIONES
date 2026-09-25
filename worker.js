// Worker de la app: sirve los archivos estáticos de siempre, y además corre un respaldo
// automático cada hora (ver wrangler.jsonc → triggers.crons) que sube una copia de la base de
// datos a un repositorio privado de GitHub, fuera de Supabase.
//
// Necesita dos secretos configurados en Cloudflare (nunca van en este archivo ni en el repo):
//   wrangler secret put SUPABASE_SERVICE_ROLE_KEY   ← Panel de Supabase > Settings > API > service_role
//   wrangler secret put GITHUB_TOKEN                ← Token de GitHub con permiso de escritura al repo de respaldos
// Y dos variables normales (sí pueden ir en wrangler.jsonc, no son secretas):
//   GITHUB_REPO   ← ej. "pedromarq200-dev/refacciones-respaldos"
//   GITHUB_BRANCH ← ej. "main"

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(hacerRespaldo(env));
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
