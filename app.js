// ===================== Cliente de Supabase =====================
let sb = null;
let errorInicioSupabase = null;
try {
  if (!window.supabase) {
    throw new Error("No se pudo cargar la librería de conexión (supabase-js). Revisa tu conexión a internet, desactiva bloqueadores de anuncios/extensiones para este sitio, y recarga la página.");
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes("PEGA_AQUI") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("PEGA_AQUI")) {
    throw new Error("Falta configurar la URL o la clave de Supabase en config.js.");
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  errorInicioSupabase = err.message;
}

// ===================== Aviso de nueva actualización =====================
(function () {
  let versionCargada = null;
  let avisoMostrado = false;

  async function revisarVersion() {
    if (avisoMostrado) return;
    try {
      const resp = await fetch("version.json?_=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      if (versionCargada === null) {
        versionCargada = data.version;
        return;
      }
      if (data.version !== versionCargada) {
        mostrarAviso();
      }
    } catch {
      // Sin conexión o falla momentánea: se reintenta en el próximo ciclo, sin molestar al usuario.
    }
  }

  function mostrarAviso() {
    avisoMostrado = true;
    const aviso = document.getElementById("avisoActualizacion");
    if (!aviso) return;
    aviso.hidden = false;
    aviso.addEventListener("click", () => location.reload());
  }

  revisarVersion();
  setInterval(revisarVersion, 60000);
})();

let notas = [];
let config = { business_name: "PEDRO DAMIAN MARQUEZ LOZA" };
let sesionActual = null;

// ===================== Utilidades =====================
function money(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function fechaLegible(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Convierte a mayúsculas sin perder la posición del cursor mientras se escribe.
function forzarMayusculas(input) {
  const inicio = input.selectionStart;
  const fin = input.selectionEnd;
  input.value = input.value.toUpperCase();
  if (inicio !== null) input.setSelectionRange(inicio, fin);
}
function siguienteFolio() {
  const nums = notas
    .map(n => parseInt((n.folioInterno || "").replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return "NV-" + String(max + 1).padStart(4, "0");
}
function totalesDeNota(nota) {
  const ivaPct = Number(nota.ivaPct ?? 16);
  const subtotal = nota.items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precioSinIva) || 0), 0);
  const iva = subtotal * (ivaPct / 100);
  const total = subtotal + iva;
  return { subtotal, iva, total, ivaPct };
}

// Convierte una nota de la app (camelCase) al formato de la tabla en Supabase (snake_case).
function notaToRow(nota) {
  return {
    folio_interno: nota.folioInterno,
    fecha: nota.fecha,
    cliente: nota.cliente,
    rfc: nota.rfc,
    domicilio: nota.domicilio,
    oi: nota.oi,
    folio_compra: nota.folioCompra,
    entrega: nota.entrega,
    placas: nota.placas,
    vehiculo: nota.vehiculo,
    items: nota.items,
    iva_pct: nota.ivaPct,
    estatus: nota.estatus,
    fecha_entrega: nota.fechaEntrega,
    recibio_nombre: nota.recibioNombre,
    observaciones_entrega: nota.observacionesEntrega,
    orden_compra_url: nota.ordenCompraUrl || null,
    orden_compra_tipo: nota.ordenCompraTipo || null,
    evidencia_entrega_url: nota.evidenciaEntregaUrl || null,
  };
}
// Convierte una fila de Supabase (snake_case) al formato que usa la app (camelCase).
function rowToNota(row) {
  return {
    id: row.id,
    folioInterno: row.folio_interno,
    fecha: row.fecha,
    cliente: row.cliente,
    rfc: row.rfc,
    domicilio: row.domicilio,
    oi: row.oi,
    folioCompra: row.folio_compra,
    entrega: row.entrega,
    placas: row.placas,
    vehiculo: row.vehiculo,
    items: row.items || [],
    ivaPct: row.iva_pct,
    estatus: row.estatus,
    fechaEntrega: row.fecha_entrega,
    recibioNombre: row.recibio_nombre,
    observacionesEntrega: row.observaciones_entrega,
    ordenCompraUrl: row.orden_compra_url,
    ordenCompraTipo: row.orden_compra_tipo,
    evidenciaEntregaUrl: row.evidencia_entrega_url,
    creadoEn: row.creado_en,
  };
}

function mostrarError(msg) {
  alert(msg);
}

// ===================== Sesión / login =====================
const pantallaLogin = document.getElementById("pantallaLogin");
const topbar = document.getElementById("topbar");
const mainEl = document.getElementById("main");
const formLogin = document.getElementById("formLogin");
const loginError = document.getElementById("loginError");
const sesionEmail = document.getElementById("sesionEmail");

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  if (!sb) {
    loginError.textContent = errorInicioSupabase || "No se pudo iniciar la conexión. Recarga la página.";
    loginError.hidden = false;
    return;
  }
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = "No se pudo iniciar sesión: " + error.message;
    loginError.hidden = false;
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  if (!sb) return;
  await sb.auth.signOut();
});

if (sb) {
  sb.auth.onAuthStateChange((_event, session) => {
    sesionActual = session;
    if (session) {
      pantallaLogin.hidden = true;
      topbar.hidden = false;
      mainEl.hidden = false;
      sesionEmail.textContent = session.user.email;
      iniciarApp();
    } else {
      pantallaLogin.hidden = false;
      topbar.hidden = true;
      mainEl.hidden = true;
    }
  });
} else {
  loginError.textContent = errorInicioSupabase;
  loginError.hidden = false;
}

let appIniciada = false;
async function iniciarApp() {
  if (appIniciada) return;
  appIniciada = true;
  await cargarConfig();
  await cargarNotas();
  await cargarClientes();
  await cargarSucursales();
  suscribirCambiosEnVivo();
  limpiarFormulario();
  renderLista();
}

// ===================== Datos: config del negocio =====================
async function cargarConfig() {
  const { data, error } = await sb.from("negocio_config").select("*").eq("id", 1).single();
  if (!error && data) {
    config = data;
    businessNameInput.value = config.business_name;
  }
}

const businessNameInput = document.getElementById("businessName");
businessNameInput.addEventListener("change", async () => {
  const nombre = businessNameInput.value.trim() || "MI NEGOCIO";
  const { error } = await sb.from("negocio_config").upsert({ id: 1, business_name: nombre });
  if (error) {
    mostrarError("No se pudo guardar el nombre del negocio: " + error.message);
    return;
  }
  config.business_name = nombre;
});

// ===================== Datos: notas =====================
async function cargarNotas() {
  const { data, error } = await sb.from("notas_venta").select("*").order("creado_en", { ascending: false });
  if (error) {
    mostrarError("No se pudieron cargar las notas: " + error.message);
    return;
  }
  notas = (data || []).map(rowToNota);
  renderLista();
  renderEntregas();
}

function suscribirCambiosEnVivo() {
  sb
    .channel("notas_venta_cambios")
    .on("postgres_changes", { event: "*", schema: "public", table: "notas_venta" }, () => {
      cargarNotas();
    })
    .subscribe();
  sb
    .channel("clientes_cambios")
    .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
      cargarClientes();
    })
    .subscribe();
  sb
    .channel("sucursales_cambios")
    .on("postgres_changes", { event: "*", schema: "public", table: "sucursales" }, async () => {
      await cargarSucursales();
      const clienteIdAbierto = document.getElementById("clienteId").value;
      if (clienteIdAbierto && !modalCliente.hidden) renderSucursalesDeCliente(clienteIdAbierto);
    })
    .subscribe();
}

// ===================== Navegación de pestañas =====================
const tabs = document.querySelectorAll(".tab-btn");
const panels = {
  lista: document.getElementById("tab-lista"),
  nueva: document.getElementById("tab-nueva"),
  entregas: document.getElementById("tab-entregas"),
  clientes: document.getElementById("tab-clientes"),
  ajustes: document.getElementById("tab-ajustes"),
};
function irATab(nombre) {
  tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === nombre));
  Object.entries(panels).forEach(([key, el]) => { el.hidden = key !== nombre; });
  if (nombre === "lista") renderLista();
  if (nombre === "entregas") renderEntregas();
  if (nombre === "clientes") renderClientes();
}
tabs.forEach(btn => btn.addEventListener("click", () => irATab(btn.dataset.tab)));

// ===================== Lista de notas =====================
const listaBody = document.getElementById("listaBody");
const listaVacia = document.getElementById("listaVacia");
const buscarInput = document.getElementById("buscar");
const filtroEstatus = document.getElementById("filtroEstatus");

// Clientes con el desglose de notas abierto (se conserva al volver a renderizar, ej. al llegar
// una actualización en vivo de otro dispositivo).
const clientesExpandidos = new Set();

function filaNotaDetalle(nota) {
  const { total } = totalesDeNota(nota);
  const tr = document.createElement("tr");
  tr.className = "fila-nota-detalle";
  tr.innerHTML = `
    <td>${nota.folioInterno}</td>
    <td>${fechaLegible(nota.fecha)}</td>
    <td>${nota.cliente}${nota.domicilio ? " - " + nota.domicilio : ""}</td>
    <td>${nota.oi || ""}</td>
    <td>${nota.placas || ""}</td>
    <td>${nota.folioCompra || ""}</td>
    <td>${money(total)}</td>
    <td><span class="badge ${nota.estatus}">${nota.estatus === "entregada" ? "Entregada" : "Pendiente"}</span></td>
    <td>
      <button class="btn-icono" title="Imprimir" data-accion="imprimir" data-id="${nota.id}">🖨️</button>
      <button class="btn-icono" title="Editar" data-accion="editar" data-id="${nota.id}">✏️</button>
      ${nota.ordenCompraUrl ? `<button class="btn-icono" title="Ver orden de compra" data-accion="ver-orden-compra" data-id="${nota.id}">📎</button>` : ""}
      ${nota.evidenciaEntregaUrl ? `<button class="btn-icono" title="Ver evidencia de entrega" data-accion="ver-evidencia-entrega" data-id="${nota.id}">📷</button>` : ""}
      <button class="btn-icono" title="Eliminar" data-accion="eliminar" data-id="${nota.id}">🗑️</button>
    </td>
  `;
  return tr;
}

function renderLista() {
  const q = (buscarInput.value || "").toLowerCase();
  const est = filtroEstatus.value;
  const filtradas = notas
    .filter(n => est === "todas" || n.estatus === est)
    .filter(n => {
      if (!q) return true;
      return [n.folioInterno, n.cliente, n.placas, n.oi, n.folioCompra]
        .join(" ").toLowerCase().includes(q);
    });

  listaBody.innerHTML = "";
  listaVacia.hidden = notas.length !== 0;

  // Resumen por cliente: una fila por cliente con el total de notas, en vez de listarlas todas.
  // Al hacer clic en un cliente se desglosan sus notas.
  const grupos = new Map();
  filtradas.forEach(nota => {
    const clave = nota.cliente || "(Sin cliente)";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(nota);
  });
  const clientesOrdenados = [...grupos.keys()].sort((a, b) => a.localeCompare(b, "es"));

  clientesOrdenados.forEach(cliente => {
    const notasCliente = grupos.get(cliente);
    const totalCliente = notasCliente.reduce((sum, n) => sum + totalesDeNota(n).total, 0);
    const pendientes = notasCliente.filter(n => n.estatus === "pendiente").length;
    // Mientras se busca algo específico, conviene mostrar el desglose directo en vez de tener
    // que hacer clic para encontrarlo.
    const expandido = clientesExpandidos.has(cliente) || !!q;

    const trResumen = document.createElement("tr");
    trResumen.className = "fila-cliente-resumen";
    trResumen.dataset.cliente = cliente;
    trResumen.innerHTML = `
      <td colspan="3">${expandido ? "▼" : "▶"} ${cliente}</td>
      <td colspan="3">${notasCliente.length} nota${notasCliente.length === 1 ? "" : "s"}${pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? "" : "s"}` : ""}</td>
      <td>${money(totalCliente)}</td>
      <td></td>
      <td></td>
    `;
    listaBody.appendChild(trResumen);

    if (expandido) {
      notasCliente.forEach(nota => listaBody.appendChild(filaNotaDetalle(nota)));
    }
  });
}
buscarInput.addEventListener("input", renderLista);
filtroEstatus.addEventListener("change", renderLista);

listaBody.addEventListener("click", async (e) => {
  const filaResumen = e.target.closest("tr.fila-cliente-resumen");
  if (filaResumen) {
    const cliente = filaResumen.dataset.cliente;
    if (clientesExpandidos.has(cliente)) clientesExpandidos.delete(cliente);
    else clientesExpandidos.add(cliente);
    renderLista();
    return;
  }

  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const nota = notas.find(n => n.id === id);
  if (!nota) return;
  if (btn.dataset.accion === "imprimir") await imprimirNota(nota);
  if (btn.dataset.accion === "editar") cargarNotaEnFormulario(nota);
  if (btn.dataset.accion === "ver-orden-compra") window.open(nota.ordenCompraUrl, "_blank");
  if (btn.dataset.accion === "ver-evidencia-entrega") window.open(nota.evidenciaEntregaUrl, "_blank");
  if (btn.dataset.accion === "eliminar") {
    if (confirm(`¿Eliminar la nota ${nota.folioInterno}? Esta acción no se puede deshacer.`)) {
      const { error } = await sb.from("notas_venta").delete().eq("id", id);
      if (error) { mostrarError("No se pudo eliminar: " + error.message); return; }
      await cargarNotas();
    }
  }
});

// ===================== Formulario Nueva/Editar Nota =====================
const formNota = document.getElementById("formNota");
const itemsBody = document.getElementById("itemsBody");
const formTitulo = document.getElementById("formTitulo");
const subtotalTxt = document.getElementById("subtotalTxt");
const ivaTxt = document.getElementById("ivaTxt");
const totalTxt = document.getElementById("totalTxt");
const ivaPctInput = document.getElementById("ivaPct");

function filaItemVacia(item = { cantidad: 1, descripcion: "", precioSinIva: "" }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="number" min="0" step="1" class="it-cant" value="${item.cantidad}"></td>
    <td><input type="text" class="it-desc" value="${item.descripcion}" placeholder="Ej. FASCIA DELANTERA GROOVE 22-23"></td>
    <td><div class="input-money"><span class="prefijo">$</span><input type="number" min="0" step="0.01" class="it-precio" value="${item.precioSinIva}"></div></td>
    <td class="it-importe">$0.00</td>
    <td><button type="button" class="btn-icono" data-accion="quitar-item">✕</button></td>
  `;
  itemsBody.appendChild(tr);
  recalcularTotales();
}

function recalcularTotales() {
  let subtotal = 0;
  itemsBody.querySelectorAll("tr").forEach(tr => {
    const cant = Number(tr.querySelector(".it-cant").value) || 0;
    const precio = Number(tr.querySelector(".it-precio").value) || 0;
    subtotal += cant * precio;
  });
  const ivaPct = Number(ivaPctInput.value) || 0;
  itemsBody.querySelectorAll("tr").forEach(tr => {
    const cant = Number(tr.querySelector(".it-cant").value) || 0;
    const precio = Number(tr.querySelector(".it-precio").value) || 0;
    tr.querySelector(".it-importe").textContent = money(cant * precio);
  });
  const iva = subtotal * (ivaPct / 100);
  const total = subtotal + iva;
  subtotalTxt.textContent = money(subtotal);
  ivaTxt.textContent = money(iva);
  totalTxt.textContent = money(total);
}

itemsBody.addEventListener("input", (e) => {
  if (e.target.classList.contains("it-desc")) forzarMayusculas(e.target);
  recalcularTotales();
});
ivaPctInput.addEventListener("input", recalcularTotales);

// Los datos de la nota se guardan en mayúsculas, aunque la orden de compra del cliente venga en minúsculas.
["cliente", "rfc", "domicilio", "oi", "folioCompra", "entrega", "placas", "vehiculo"].forEach(id => {
  document.getElementById(id).addEventListener("input", (e) => forzarMayusculas(e.target));
});

// ===================== Sugerencias de cliente (desde el catálogo de Clientes) =====================
const clienteInput = document.getElementById("cliente");
const sugerenciasCliente = document.getElementById("sugerenciasCliente");

function ocultarSugerenciasCliente() {
  sugerenciasCliente.hidden = true;
  sugerenciasCliente.innerHTML = "";
}

function mostrarSugerenciasCliente() {
  const q = clienteInput.value.trim().toLowerCase();
  if (!q || typeof clientes === "undefined" || clientes.length === 0) {
    ocultarSugerenciasCliente();
    return;
  }
  const coincidencias = clientes
    .filter(c => (c.clave || "").toLowerCase().includes(q) || (c.razonSocial || "").toLowerCase().includes(q))
    .slice(0, 8);
  if (coincidencias.length === 0) {
    ocultarSugerenciasCliente();
    return;
  }
  sugerenciasCliente.innerHTML = coincidencias.map(c => `
    <div class="sugerencia-item" data-id="${c.id}">
      <strong>${c.clave || c.razonSocial}</strong>
      ${c.clave ? `<span>${c.razonSocial}</span>` : ""}
    </div>
  `).join("");
  sugerenciasCliente.hidden = false;
}

clienteInput.addEventListener("input", mostrarSugerenciasCliente);
clienteInput.addEventListener("focus", mostrarSugerenciasCliente);

const labelSelectSucursal = document.getElementById("labelSelectSucursal");
const selectSucursal = document.getElementById("selectSucursal");

sugerenciasCliente.addEventListener("mousedown", (e) => {
  // mousedown (no click) para que dispare antes del "blur" del input
  const item = e.target.closest(".sugerencia-item");
  if (!item) return;
  const cliente = clientes.find(c => c.id === item.dataset.id);
  if (!cliente) return;
  clienteInput.value = (cliente.razonSocial || cliente.clave || "").toUpperCase();
  document.getElementById("rfc").value = (cliente.rfc || "").toUpperCase();
  ocultarSugerenciasCliente();

  const sucursalesDeCliente = sucursales.filter(s => s.clienteId === cliente.id && s.activa !== false);
  if (sucursalesDeCliente.length > 1) {
    selectSucursal.innerHTML = `<option value="">Selecciona...</option>` +
      sucursalesDeCliente.map(s => `<option value="${s.id}">${s.nombre}${s.municipio ? " — " + s.municipio : ""}</option>`).join("");
    labelSelectSucursal.hidden = false;
    document.getElementById("domicilio").value = "";
    document.getElementById("entrega").value = "";
  } else {
    labelSelectSucursal.hidden = true;
    if (sucursalesDeCliente.length === 1) {
      document.getElementById("domicilio").value = formatearDomicilio(sucursalesDeCliente[0]) || sucursalesDeCliente[0].nombre;
      document.getElementById("entrega").value = sucursalesDeCliente[0].nombre;
    } else {
      document.getElementById("domicilio").value = formatearDomicilio(cliente);
    }
    document.getElementById("domicilio").focus();
  }
});

selectSucursal.addEventListener("change", () => {
  const s = sucursales.find(x => x.id === selectSucursal.value);
  if (!s) return;
  document.getElementById("domicilio").value = formatearDomicilio(s) || s.nombre;
  document.getElementById("entrega").value = s.nombre;
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".campo-con-sugerencias")) ocultarSugerenciasCliente();
});
itemsBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion='quitar-item']");
  if (!btn) return;
  if (itemsBody.querySelectorAll("tr").length > 1) {
    btn.closest("tr").remove();
    recalcularTotales();
  }
});
document.getElementById("btnAddItem").addEventListener("click", () => filaItemVacia());

// ===================== Importar datos desde el PDF de la orden de compra =====================
const MESES = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 };

function reconstruirLineasPdf(textContent) {
  const filas = [];
  for (const item of textContent.items) {
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    let fila = filas.find(f => Math.abs(f.y - y) <= 2);
    if (!fila) { fila = { y, partes: [] }; filas.push(fila); }
    fila.partes.push({ x, texto: item.str });
  }
  filas.sort((a, b) => b.y - a.y);
  return filas
    .map(f => f.partes.sort((a, b) => a.x - b.x).map(p => p.texto).join(" ").replace(/\s+/g, " ").trim())
    .filter(l => l.length > 0);
}

// Distancia de edición (Levenshtein) de `patron` contra la mejor subcadena de `texto` (permite que
// el patrón empiece y termine en cualquier posición del texto, no solo comparar cadena completa).
// Sirve para ubicar el nombre de un cliente dentro de todo el texto leído por OCR, aunque venga
// rodeado de otras palabras y con errores de lectura.
function distanciaSubcadenaLevenshtein(patron, texto) {
  const n = patron.length;
  const m = texto.length;
  if (n === 0) return 0;
  let anterior = new Array(m + 1).fill(0); // empezar en cualquier posición del texto no cuesta nada
  for (let i = 1; i <= n; i++) {
    const actual = new Array(m + 1).fill(0);
    actual[0] = i;
    for (let j = 1; j <= m; j++) {
      const costoSustitucion = patron[i - 1] === texto[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        anterior[j] + 1,
        actual[j - 1] + 1,
        anterior[j - 1] + costoSustitucion
      );
    }
    anterior = actual;
  }
  return Math.min(...anterior); // también se permite terminar en cualquier posición
}

// Deja solo letras (sin acentos) y números en mayúsculas, para comparar nombres sin que espacios,
// puntuación o acentos mal leídos por el OCR afecten la comparación.
function normalizarTexto(s) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

// Busca, dentro de todo el texto leído (PDF u OCR), el cliente del catálogo cuyo nombre se parezca
// más al texto (tolerante a errores de OCR). Se usa cuando no hay una posición confiable en el
// documento para saber cuál renglón es el nombre del cliente (ej. viene como logo estilizado).
function buscarClienteEnTexto(texto, listaClientes) {
  const textoNorm = normalizarTexto(texto);
  if (!textoNorm || !listaClientes || !listaClientes.length) return null;
  let mejor = null;
  let mejorProporcion = Infinity;
  for (const c of listaClientes) {
    const nombreCompleto = normalizarTexto(c.razonSocial || "");
    // El documento suele traer solo el nombre corto (ej. "AP AUTOPLUS 1"), sin la razón social
    // completa (ej. "AUTO PLUS SA DE CV") — se prueba también sin el tipo de sociedad al final,
    // y la clave corta, por si alguna de las dos se parece más al texto que el nombre completo.
    const nombreSinSufijo = nombreCompleto.replace(/(SADECV|SAPIDECV|SDERLDECV|SDERLMIDECV|SAB|SC|AC)$/, "");
    const clave = normalizarTexto(c.clave || "");
    const candidatos = [nombreCompleto, nombreSinSufijo, clave].filter(n => n.length >= 4);
    for (const nombre of candidatos) {
      const distancia = distanciaSubcadenaLevenshtein(nombre, textoNorm);
      const proporcion = distancia / nombre.length;
      if (proporcion < mejorProporcion) {
        mejorProporcion = proporcion;
        mejor = c;
      }
    }
  }
  return mejorProporcion <= 0.3 ? mejor : null;
}

// Corrige errores de OCR muy comunes (la "M" se confunde con "N", y la "I" de "IZQ" con el número
// "1") en palabras conocidas del vocabulario típico de estas órdenes.
function corregirErroresOCRComunes(texto) {
  return texto
    .replace(/\b1[Z7]Q\b/gi, "IZQ")
    .replace(/\bNARCO\b/gi, "MARCO")
    .replace(/\bCRONO\b/gi, "CROMO")
    .replace(/\bNG\b/g, "MG");
}

function parsearOrdenCompra(lineas) {
  const texto = lineas.join("\n");
  const datos = { items: [] };

  // Folio de compra: formato "OCUNI-218" (Auto Plus, viejo), "No. Orden de Compra: 17214"
  // (Martínez Abarca y otros), o "FOLIO :  61201" (Auto Plus, formato nuevo tipo "AP AUTOPLUS 1").
  const mFolioLetras = texto.match(/\b([A-Z]{2,8}-\d{2,6})\b/);
  // El OCR a veces mete basura entre la etiqueta y el número (ej. lee "Compra:" dos veces y deja
  // "Compra: pra: 17238"), por eso se tolera un poco de texto de por medio antes del número.
  // La palabra "Compra" en sí a veces se lee tan mal que ni queda reconocible (ej. "Ema:") — como
  // "No. Orden de" se lee de forma más confiable, ya no se exige "Compra" también.
  const mFolioNumerico = texto.match(/No[.,]?\s*Orden\s+de\s*[^\d\n]{0,25}(\d{3,8})/i);
  // El separador ":" de este formato a veces lo lee el OCR como "-", o lo pierde por completo.
  const mFolioAutoPlusNuevo = texto.match(/\bFOLIO\s*[:-]?\s*(\d+)/i);
  if (mFolioLetras) datos.folioCompra = mFolioLetras[1];
  else if (mFolioNumerico) datos.folioCompra = mFolioNumerico[1];
  else if (mFolioAutoPlusNuevo) datos.folioCompra = mFolioAutoPlusNuevo[1];

  // O/I: "ORDEN #932" o "ORDEN :  24194" (Auto Plus) o "No. Recepción: 19729" (Martínez Abarca).
  // El separador a veces lo pierde el OCR por completo, así que también se acepta sin separador.
  const mOi = texto.match(/ORDEN\s*[#:-]?\s*(\d+)/i);
  // A veces el OCR mete la fecha entre la etiqueta y el número (ej. "No. Recepción: Fecha:
  // 18/09/2026 19756", porque el renglón de "Fecha" quedó pegado al de "No. Recepción" al leer la
  // imagen) — se salta ese pedazo de fecha explícitamente para no capturar el día/mes/año en vez
  // del número de recepción real.
  const mRecepcion = texto.match(/No[.,]?\s*Recepci[oó]n\s*:?(?:\s*Fecha\s*:?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})?[^\d\n]{0,20}(\d+)/i);
  if (mOi) datos.oi = mOi[1];
  else if (mRecepcion) datos.oi = mRecepcion[1];

  const mPlacas = texto.match(/PLACAS\s*:?\s*([A-Z0-9]{5,9})\b/i);
  if (mPlacas) datos.placas = mPlacas[1];

  const mVehiculo = texto.match(/VEH[ÍI]CULO\s+(.+?)(?:\n|$)/i);
  if (mVehiculo) {
    datos.vehiculo = mVehiculo[1].trim();
  } else {
    // Formato con Marca / Tipo / Modelo / Color por separado en vez de un solo campo "Vehículo"
    // (Auto Plus y Martínez Abarca). El vehículo se arma solo con estos 4 datos, en ese orden
    // (ej. "VOLKSWAGEN JETTA 2019 BLANCO"), sin agregar nada más. El separador ":" en este
    // formato a veces lo lee el OCR como "-" o "—" (em dash).
    // La etiqueta "Tipo:" (junto a la barra vertical que separa las columnas) se lee muy seguido
    // mal por el OCR, como "CIRO:", "CIN:" o "CNO:" — se salta ese texto tanto al buscar Marca
    // (para no capturarlo por error como si fuera la marca) como al buscar Tipo (probando esa
    // etiqueta mal leída como alternativa).
    const mMarca = texto.match(/Marca\s*[:\-—]?\s*(?:(?:DE\s+)?(?:CIRO|CIN|CNO)\s*[:\-—]?\s*)?([A-ZÁÉÍÓÚÑ0-9]+)/i);
    const mTipo = texto.match(/Tipo\s*[:\-—]?\s*([A-ZÁÉÍÓÚÑ0-9](?:[A-ZÁÉÍÓÚÑ0-9-]*[A-ZÁÉÍÓÚÑ0-9])?)/i)
      || texto.match(/\b(?:DE\s+)?(?:CIRO|CIN|CNO)\s*[:\-—]?\s*([A-ZÁÉÍÓÚÑ0-9](?:[A-ZÁÉÍÓÚÑ0-9-]*[A-ZÁÉÍÓÚÑ0-9])?)/i);
    const mModelo = texto.match(/Modelo\s*[:\-—]?\s*(\d{4})/i);
    const mColor = texto.match(/Color\s*[:\-—]?\s*([A-ZÁÉÍÓÚÑ]+)/i);
    // El truco de saltarse "CIRO:"/"CIN:"/"CNO:" a veces termina capturando, para Tipo, el mismo
    // valor que ya se tomó para Marca (cuando el OCR dejó las dos etiquetas juntas y sus dos
    // valores juntos después) — en ese caso se descarta ese valor repetido en vez de duplicarlo.
    const valorTipo = mTipo?.[1] && mTipo[1].toUpperCase() !== (mMarca?.[1] || "").toUpperCase() ? mTipo[1] : null;
    const partes = [mMarca?.[1], valorTipo, mModelo?.[1], mColor?.[1]].filter(Boolean);
    if (partes.length) datos.vehiculo = partes.join(" ");
  }

  const mFecha = texto.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i) || texto.match(/Fecha\s*:?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (mFecha) {
    if (mFecha[2] && MESES[mFecha[2].toLowerCase()]) {
      const mes = MESES[mFecha[2].toLowerCase()];
      datos.fecha = `${mFecha[3]}-${String(mes).padStart(2, "0")}-${String(mFecha[1]).padStart(2, "0")}`;
    } else if (/^\d+$/.test(mFecha[2])) {
      datos.fecha = `${mFecha[3]}-${String(mFecha[2]).padStart(2, "0")}-${String(mFecha[1]).padStart(2, "0")}`;
    }
  }

  // Proveedor al que está dirigida la orden ("PROVEEDOR > NOMBRE" o "Proveedor: ..."), para confirmar que la orden es tuya.
  const mProveedor = texto.match(/NOMBRE\s+(.+?)(?:\s+VEH[ÍI]CULO|\n|$)/i) ||
    texto.match(/Proveedor\s*:?\s*(.+?)(?:\s+\||\s+Marca\s*:|\n|$)/i);
  if (mProveedor) datos.proveedorNombre = mProveedor[1].trim();

  // El RFC del cliente (quien emite la orden) aparece primero, en el encabezado, antes de la sección PROVEEDOR.
  const mRfcCliente = texto.match(/RFC\s+([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3})/i);
  if (mRfcCliente) datos.rfcCliente = mRfcCliente[1].toUpperCase();

  // Formato "AP AUTOPLUS 1": el campo "Ubicacion" indica a qué sucursal entregar (ej. "Equipo 4").
  // Solo "Equipo 4" tiene un mapeo conocido (Santo Domingo); cualquier otro valor (Equipo 1,
  // "Fuera Taller", etc.) se entrega por default en San Nicolás.
  const mUbicacion = texto.match(/Ubicaci[oó]n\s*:?\s*(.+?)(?:\n|$)/i);
  if (mUbicacion) {
    const valorUbicacion = mUbicacion[1].trim().toUpperCase();
    // El OCR a veces pierde la "E" de "Equipo" (o el separador ":"); por eso se busca "QUIPO 4"
    // en vez de exigir el texto exacto "EQUIPO 4".
    datos.domicilio = /QUIPO\s*4\b/.test(valorUbicacion) ? "SANTO DOMINGO" : "SAN NICOLAS";
  }

  // El nombre del cliente suele aparecer como línea propia justo debajo del folio,
  // antes de la línea con la dirección completa (que empieza igual y trae "·"). Solo aplica al
  // formato tipo Auto Plus (folio con letras); en formatos tipo Martínez Abarca no hay forma
  // confiable de adivinar el cliente por texto, así que se deja para elegir a mano.
  if (mFolioLetras) {
    const idxFolio = lineas.findIndex(l => l.includes(mFolioLetras[1]));
    for (let i = idxFolio + 1; i < Math.min(idxFolio + 4, lineas.length); i++) {
      const l = lineas[i];
      if (l && !l.includes("·") && l.length < 60 && !/^(PROVEEDOR|UNIDAD|NO\.|NOMBRE|RFC|ATENCIÓN)/i.test(l)) {
        const palabras = l.trim().split(/\s+/);
        if (palabras.length >= 2) {
          datos.domicilio = palabras[palabras.length - 1];
          datos.cliente = palabras.slice(0, -1).join(" ");
        } else {
          datos.cliente = l.trim();
        }
        break;
      }
    }
  }

  // Renglones de piezas. Formatos posibles (el "$" es opcional, no todos lo traen):
  // - Con número de renglón e cantidad por separado: "1 DESCRIPCION 1 $1,188.00 $1,188.00" (Auto Plus, viejo).
  // - Solo con cantidad: "1 DESCRIPCION 1,470.00 1,470.00" (Martínez Abarca y otros).
  // - Cantidad con decimales y fecha de entrega al final: "1.00 DESCRIPCION $1,798.00 $1,798.00 21 sep. 26"
  //   (Auto Plus, formato nuevo tipo "AP AUTOPLUS 1").
  const reItemConIndice = /^(\d+)\s+(.+?)\s+(\d+)\s+\$?\s?([\d,]+\.\d{2})\s+\$?\s?([\d,]+\.\d{2})$/;
  const reItemSoloCantidad = /^(\d+)\s+(.+?)\s+\$?\s?([\d,]+\.\d{2})\s+\$?\s?([\d,]+\.\d{2})$/;
  const reItemConFechaEntrega = /^(\d+(?:\.\d+)?)\s+(.+?)\s+\$?\s?([\d,]+\.\d{2})\s+\$?\s?([\d,]+\.\d{2})\s+\S.*$/;
  for (const linea of lineas) {
    // Los renglones de SubTotal/IVA/Total a veces se leen con basura pegada que por accidente
    // parece un renglón de pieza (ej. "A IVA16%: 224.00") — se descartan antes de intentarlo.
    if (/\b(SUB\s*TOTAL|TOTAL|IVA)\b/i.test(linea)) continue;
    const m5 = linea.match(reItemConIndice);
    if (m5) {
      datos.items.push({
        cantidad: Number(m5[3]) || 1,
        descripcion: m5[2].trim(),
        precioSinIva: Number(m5[4].replace(/,/g, "")) || 0,
      });
      continue;
    }
    const m4 = linea.match(reItemSoloCantidad);
    if (m4) {
      datos.items.push({
        cantidad: Number(m4[1]) || 1,
        descripcion: m4[2].trim(),
        precioSinIva: Number(m4[3].replace(/,/g, "")) || 0,
      });
      continue;
    }
    const mFecha2 = linea.match(reItemConFechaEntrega);
    if (mFecha2) {
      datos.items.push({
        cantidad: Number(mFecha2[1]) || 1,
        descripcion: mFecha2[2].trim(),
        precioSinIva: Number(mFecha2[3].replace(/,/g, "")) || 0,
      });
      continue;
    }
    // Último intento: el precio unitario a veces se lee corrupto (ej. "$1,408.00" como "$1.40800"),
    // pero el importe total casi siempre se lee bien. Se toma el ÚLTIMO número con dos decimales de
    // la línea como importe, y de ahí se calcula el precio unitario (importe ÷ cantidad). También
    // tolera que la cantidad (casi siempre "1") se haya leído como una sola letra suelta (ej. "L" o
    // "Y" en vez de "1") — en ese caso Number(...) da NaN y cae al valor por default de 1.
    const mCantidadDesc = linea.match(/^(\d+(?:\.\d+)?|[A-Za-zÑñ])\s+(.+)$/);
    if (mCantidadDesc) {
      const precios = [...mCantidadDesc[2].matchAll(/\d[\d.,]*\.\d{2}/g)];
      if (precios.length > 0) {
        const primerPrecio = precios[0];
        const ultimoPrecio = precios[precios.length - 1][0];
        // Si el precio unitario se corrompió tanto que ni siquiera se reconoce como número con
        // decimales (ej. "$2,240.00" leído como "$224000", sin coma ni punto), puede quedar pegado
        // a la descripción como un número suelto — también se quita.
        const descripcion = mCantidadDesc[2]
          .slice(0, primerPrecio.index)
          .replace(/\s*\$\s*$/, "")
          .replace(/(?:^|\s)\$?\d[\d,]{2,}\s*$/, "")
          .trim();
        const cantidad = Number(mCantidadDesc[1]) || 1;
        const importe = Number(ultimoPrecio.replace(/,/g, ""));
        if (descripcion.length >= 3 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(descripcion) && importe > 0) {
          datos.items.push({
            cantidad,
            descripcion,
            precioSinIva: Math.round((importe / cantidad) * 100) / 100,
          });
        }
      }
    }
  }

  // Último recurso, solo si no se encontró ninguna pieza: a veces algo (ej. un sello encima del
  // texto) separa la descripción de sus precios en dos renglones distintos, en vez de uno solo. Se
  // busca un renglón de solo "cantidad + descripción" (sin ningún precio) y se empareja con el
  // renglón vecino si ese trae un par de precios sueltos.
  if (datos.items.length === 0) {
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      if (/\b(SUB\s*TOTAL|TOTAL|IVA)\b/i.test(linea)) continue;
      const mSoloDesc = linea.match(/^(\d+(?:\.\d+)?|[A-Za-zÑñ])\s+([A-ZÁÉÍÓÚÑáéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ .,/]{2,})$/i);
      if (!mSoloDesc || /\d/.test(mSoloDesc[2])) continue;
      for (const vecina of [lineas[i + 1], lineas[i - 1]]) {
        if (!vecina || /\b(SUB\s*TOTAL|TOTAL|IVA)\b/i.test(vecina)) continue;
        const precios = [...vecina.matchAll(/\d[\d.,]*\.\d{2}/g)];
        if (precios.length === 0) continue;
        const cantidad = Number(mSoloDesc[1]) || 1;
        const importe = Number(precios[precios.length - 1][0].replace(/,/g, ""));
        if (importe > 0) {
          datos.items.push({
            cantidad,
            descripcion: mSoloDesc[2].trim(),
            precioSinIva: Math.round((importe / cantidad) * 100) / 100,
          });
        }
        break;
      }
    }
  }

  // Si no se pudo ubicar el cliente por su posición en el texto (formatos donde el nombre viene
  // como logo/encabezado estilizado, ej. Martínez Abarca), se busca por parecido contra el
  // catálogo de Clientes ya registrado, tolerando errores típicos de OCR.
  if (!datos.cliente && typeof clientes !== "undefined" && clientes.length) {
    const coincidencia = buscarClienteEnTexto(texto, clientes);
    if (coincidencia) datos.cliente = coincidencia.razonSocial || coincidencia.clave;
  }

  datos.items = datos.items.map(it => ({
    ...it,
    descripcion: corregirErroresOCRComunes(it.descripcion),
  }));
  if (datos.vehiculo) datos.vehiculo = corregirErroresOCRComunes(datos.vehiculo);

  return datos;
}

async function extraerDatosPdf(file, onProgreso) {
  if (!window.pdfjsLib) {
    throw new Error("No se pudo cargar el lector de PDF. Revisa tu conexión a internet y recarga la página.");
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buffer = await file.arrayBuffer();
  const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pagina = await doc.getPage(1);
  const contenido = await pagina.getTextContent();
  const lineas = reconstruirLineasPdf(contenido);

  // Algunos PDF son en realidad una foto/escaneo de la orden (una imagen incrustada, sin texto
  // real) — pdf.js no puede extraer nada de esos. En ese caso se dibuja la página en un canvas y
  // se lee con el mismo OCR que se usa para fotos.
  const textoPlano = lineas.join(" ").trim();
  if (textoPlano.length < 20) {
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    return extraerDatosImagen(blob, onProgreso);
  }

  return parsearOrdenCompra(lineas);
}

// Agrupa las palabras reconocidas por OCR en renglones según su posición vertical, igual que se
// hace con el texto del PDF, para poder usar el mismo analizador de texto.
//
// En documentos con renglones muy juntos (ej. la tabla de piezas de Martínez Abarca, con ~20px
// entre renglones), agrupar por "banda fija" alrededor de un ancla (como se hacía antes) mezclaba
// renglones vecinos, porque el texto y los precios de un mismo renglón a veces caen en Y distintas
// dentro de esa misma banda. En vez de eso, se ordenan todas las palabras por su Y y se empieza un
// renglón nuevo cada vez que hay un salto vertical grande (>8px) entre una palabra y la siguiente —
// esto sigue uniendo las palabras de un mismo renglón aunque su Y varíe un poco, sin saltarse a la
// fila de abajo.
function reconstruirLineasOCR(words) {
  const candidatos = words
    .filter(w => w.text && w.text.trim())
    .map(w => ({ texto: w.text, x: w.bbox.x0, yc: (w.bbox.y0 + w.bbox.y1) / 2 }))
    .sort((a, b) => a.yc - b.yc);
  const filas = [];
  let filaActual = null;
  let ultimoYc = null;
  for (const w of candidatos) {
    if (filaActual === null || (w.yc - ultimoYc) > 8) {
      filaActual = [];
      filas.push(filaActual);
    }
    filaActual.push(w);
    ultimoYc = w.yc;
  }
  return filas
    .map(f => f.sort((a, b) => a.x - b.x).map(p => p.texto).join(" ").replace(/\s+/g, " ").trim())
    .filter(l => l.length > 0);
}

async function ejecutarOcr(file, psm, onProgreso) {
  const worker = await window.Tesseract.createWorker("spa", 1, {
    logger: (m) => {
      if (onProgreso && m.status === "recognizing text") onProgreso(Math.round((m.progress || 0) * 100));
    },
  });
  if (psm) await worker.setParameters({ tessedit_pageseg_mode: psm });
  try {
    const resultado = await worker.recognize(file);
    return reconstruirLineasOCR(resultado.data.words || []);
  } finally {
    await worker.terminate();
  }
}

async function extraerDatosImagen(file, onProgreso) {
  if (!window.Tesseract) {
    throw new Error("No se pudo cargar el lector de imágenes (OCR). Revisa tu conexión a internet y recarga la página.");
  }
  // Primera pasada con el modo automático de OCR: es el que mejor detecta el logo/encabezado
  // del cliente (necesario para identificarlo en el catálogo), pero a veces se salta el folio de
  // compra si viene en fuente chica, o pierde alguna pieza.
  const lineas = await ejecutarOcr(file, null, onProgreso);
  const datos = parsearOrdenCompra(lineas);

  if (!datos.folioCompra || !datos.oi || datos.items.length === 0) {
    // Segunda pasada en modo "columna única" (PSM 4): lee mejor folios/números pequeños y
    // renglones de piezas, a costa de leer peor el logo. Solo se usa para rellenar lo que faltó
    // en la primera pasada.
    const lineasColumna = await ejecutarOcr(file, "4", onProgreso);
    const datosColumna = parsearOrdenCompra(lineasColumna);
    if (!datos.folioCompra && datosColumna.folioCompra) datos.folioCompra = datosColumna.folioCompra;
    if (!datos.oi && datosColumna.oi) datos.oi = datosColumna.oi;
    if (!datos.domicilio && datosColumna.domicilio) datos.domicilio = datosColumna.domicilio;
    if (datosColumna.items.length > datos.items.length) datos.items = datosColumna.items;
  }

  datos.esImagenOCR = true;
  return datos;
}

const inputPdfOrden = document.getElementById("inputPdfOrden");
const pdfImportMsg = document.getElementById("pdfImportMsg");
const dropzonePdf = document.getElementById("dropzonePdf");

// Orden de compra recién importada (PDF o foto), pendiente de guardarse junto con la nota cuando
// se le dé clic a "Guardar". Se sube a Supabase Storage en cuanto se importa, no hasta guardar,
// para no tener que conservar el archivo original en memoria hasta ese momento.
let ordenCompraPendiente = null; // { url, tipo: "pdf" | "imagen" }

// Convierte una foto (cualquier formato: jpg, png, webp...) en un PDF de una sola página, para
// que la orden de compra siempre se pueda ver/imprimir como PDF, sin importar el formato original.
async function imagenComoPdfBlob(file) {
  if (!window.jspdf) throw new Error("No se pudo cargar el generador de PDF (jsPDF).");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: bitmap.width > bitmap.height ? "landscape" : "portrait",
    unit: "px",
    format: [bitmap.width, bitmap.height],
  });
  pdf.addImage(dataUrl, "JPEG", 0, 0, bitmap.width, bitmap.height);
  return pdf.output("blob");
}

// Recorta la esquina superior derecha de la foto de una nota impresa, que es justo donde va el
// folio (grande y solo). Leer con OCR nada más ese pedacito, sin el resto de la nota alrededor
// (tabla de piezas, domicilio, etc.) para distraer a Tesseract, lee el folio con mucha más certeza.
async function recortarEsquinaSuperiorDerecha(file) {
  const bitmap = await createImageBitmap(file);
  const ancho = Math.round(bitmap.width * 0.55);
  const alto = Math.round(bitmap.height * 0.28);
  const x = bitmap.width - ancho;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext("2d").drawImage(bitmap, x, 0, ancho, alto, 0, 0, ancho, alto);
  return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

async function subirOrdenCompra(file, esImagen) {
  try {
    // Las fotos se convierten a PDF antes de guardarlas, para que siempre se puedan ver/imprimir
    // como un PDF normal (ej. las de Martínez Abarca, que llegan como foto).
    const archivoParaSubir = esImagen ? await imagenComoPdfBlob(file) : file;
    const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    const { error } = await sb.storage.from("ordenes-compra").upload(ruta, archivoParaSubir, { contentType: "application/pdf" });
    if (error) {
      console.error("No se pudo guardar la orden de compra en Storage:", error);
      return { ok: false, error: error.message };
    }
    const { data } = sb.storage.from("ordenes-compra").getPublicUrl(ruta);
    return { ok: true, url: data.publicUrl, tipo: "pdf" };
  } catch (err) {
    console.error("No se pudo guardar la orden de compra en Storage:", err);
    return { ok: false, error: err.message };
  }
}

// Sube la foto tomada con la cámara como evidencia de entrega (se guarda tal cual, sin
// convertir a PDF, ya que solo se necesita poder verla, no imprimirla con formato).
async function subirEvidenciaEntrega(file) {
  try {
    const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from("evidencias-entrega").upload(ruta, file, { contentType: file.type || "image/jpeg" });
    if (error) {
      console.error("No se pudo guardar la evidencia de entrega en Storage:", error);
      return { ok: false, error: error.message };
    }
    const { data } = sb.storage.from("evidencias-entrega").getPublicUrl(ruta);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    console.error("No se pudo guardar la evidencia de entrega en Storage:", err);
    return { ok: false, error: err.message };
  }
}

async function procesarPdfSeleccionado(file) {
  if (!file) return;
  const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const esImagen = file.type.startsWith("image/");
  if (!esPdf && !esImagen) {
    pdfImportMsg.textContent = "Ese archivo no es un PDF ni una imagen. Arrastra o elige el PDF o la foto de la orden de compra.";
    pdfImportMsg.className = "pdf-import-msg error";
    pdfImportMsg.hidden = false;
    return;
  }
  pdfImportMsg.hidden = false;
  pdfImportMsg.className = "pdf-import-msg";
  pdfImportMsg.textContent = esImagen ? "Leyendo la imagen (esto puede tardar unos segundos)... 0%" : "Leyendo el PDF...";
  try {
    const datos = esImagen
      ? await extraerDatosImagen(file, (pct) => { pdfImportMsg.textContent = `Leyendo la imagen (esto puede tardar unos segundos)... ${pct}%`; })
      : await extraerDatosPdf(file, (pct) => { pdfImportMsg.textContent = `Leyendo el PDF (esto puede tardar unos segundos)... ${pct}%`; });

    // Candado: la orden debe estar dirigida a este negocio (PROVEEDOR > NOMBRE), no a alguien más.
    const nombreEsperado = (config.business_name || "PEDRO").trim().split(/\s+/)[0].toUpperCase();
    if (datos.proveedorNombre && !datos.proveedorNombre.toUpperCase().includes(nombreEsperado)) {
      pdfImportMsg.textContent = `⚠️ Esa orden no pertenece a ${config.business_name || "Pedro"}. El proveedor de este PDF es "${datos.proveedorNombre}". No se importó ningún dato — verifica que sea la orden de compra correcta.`;
      pdfImportMsg.className = "pdf-import-msg error";
      pdfImportMsg.hidden = false;
      return;
    }

    // Guarda el archivo original (PDF o foto) para poder imprimirlo junto con la nota más
    // adelante. Si falla (ej. sin conexión, o falta correr schema_orden_compra.sql), no bloquea
    // el resto de la importación, pero se avisa en el mensaje final para que se note.
    const resultadoSubidaArchivo = await subirOrdenCompra(file, esImagen);
    ordenCompraPendiente = resultadoSubidaArchivo.ok ? resultadoSubidaArchivo : null;

    // Cruza el cliente/sucursal detectados en el PDF contra el catálogo de Clientes, para usar
    // la razón social, el RFC y el domicilio completo ya registrados en vez del texto crudo del PDF.
    let clienteCatalogo = null;
    let sucursalCatalogo = null;
    if (datos.cliente) {
      const q = datos.cliente.trim().toLowerCase();
      clienteCatalogo = clientes.find(c =>
        (c.clave || "").trim().toLowerCase() === q ||
        (c.razonSocial || "").trim().toLowerCase() === q ||
        (c.clave && q.includes(c.clave.trim().toLowerCase()))
      ) || null;
    }
    if (clienteCatalogo && datos.domicilio) {
      const qd = datos.domicilio.trim().toLowerCase();
      sucursalCatalogo = sucursales.find(s =>
        s.clienteId === clienteCatalogo.id && (s.nombre || "").trim().toLowerCase() === qd
      ) || null;
    }

    if (datos.fecha) document.getElementById("fecha").value = datos.fecha;
    document.getElementById("cliente").value = clienteCatalogo
      ? (clienteCatalogo.razonSocial || clienteCatalogo.clave).toUpperCase()
      : (datos.cliente ? datos.cliente.toUpperCase() : document.getElementById("cliente").value);
    if (clienteCatalogo?.rfc) document.getElementById("rfc").value = clienteCatalogo.rfc.toUpperCase();
    else if (datos.rfcCliente) document.getElementById("rfc").value = datos.rfcCliente;

    // Sucursales activas del cliente detectado, para replicar el mismo criterio que al elegir
    // cliente a mano: si solo tiene una, se usa directo; si no tiene ninguna, se usa su domicilio
    // general.
    const sucursalesDelCliente = clienteCatalogo
      ? sucursales.filter(s => s.clienteId === clienteCatalogo.id && s.activa !== false)
      : [];

    if (sucursalCatalogo) {
      document.getElementById("domicilio").value = formatearDomicilio(sucursalCatalogo) || sucursalCatalogo.nombre;
      document.getElementById("entrega").value = sucursalCatalogo.nombre;
    } else if (datos.domicilio) {
      // El documento sí traía un nombre de sucursal/domicilio, pero no coincide con ninguna
      // registrada para este cliente — se deja el texto crudo y se avisa para que se revise.
      document.getElementById("domicilio").value = datos.domicilio.toUpperCase();
      document.getElementById("entrega").value = datos.domicilio.toUpperCase();
    } else if (clienteCatalogo && sucursalesDelCliente.length === 1) {
      document.getElementById("domicilio").value = formatearDomicilio(sucursalesDelCliente[0]) || sucursalesDelCliente[0].nombre;
      document.getElementById("entrega").value = sucursalesDelCliente[0].nombre;
    } else if (clienteCatalogo) {
      // El documento no trae domicilio/sucursal (ej. formatos leídos por OCR sin ese dato) —
      // se usa el domicilio general ya registrado para este cliente.
      const domicilioGeneral = formatearDomicilio(clienteCatalogo);
      if (domicilioGeneral) document.getElementById("domicilio").value = domicilioGeneral;
    }

    if (datos.oi) document.getElementById("oi").value = datos.oi.toUpperCase();
    if (datos.folioCompra) document.getElementById("folioCompra").value = datos.folioCompra.toUpperCase();
    if (datos.placas) document.getElementById("placas").value = datos.placas.toUpperCase();
    if (datos.vehiculo) document.getElementById("vehiculo").value = datos.vehiculo.toUpperCase();

    if (datos.items.length > 0) {
      itemsBody.innerHTML = "";
      datos.items.forEach(it => filaItemVacia({ ...it, descripcion: it.descripcion.toUpperCase() }));
    }
    recalcularTotales();

    const camposEncontrados = Object.keys(datos).filter(k => k !== "items" && k !== "esImagenOCR" && datos[k]).length;
    if (camposEncontrados === 0 && datos.items.length === 0) {
      pdfImportMsg.textContent = esImagen
        ? "No se pudo leer ningún dato reconocible en esta imagen (puede ser por baja calidad de foto, sellos o firmas encima del texto). Llena la nota a mano."
        : "No se encontraron datos reconocibles en este PDF. Llena la nota a mano.";
      pdfImportMsg.className = "pdf-import-msg error";
    } else {
      const notaSucursal = sucursalCatalogo
        ? ` Sucursal detectada: ${sucursalCatalogo.nombre}.`
        : (clienteCatalogo && datos.domicilio ? ` No encontré una sucursal registrada llamada "${datos.domicilio.toUpperCase()}" para este cliente — revisa el domicilio.` : "");
      const notaOCR = (esImagen || datos.esImagenOCR) ? " ⚠️ Se leyó con reconocimiento de texto (OCR) — puede tener errores, revisa cada dato con más cuidado que con un PDF." : "";
      const notaArchivo = !resultadoSubidaArchivo.ok
        ? ` ⚠️ No se pudo guardar el archivo original para imprimirlo junto con la nota (${resultadoSubidaArchivo.error}).`
        : "";
      pdfImportMsg.textContent = `✓ Datos importados de "${file.name}" (${datos.items.length} pieza(s)).${notaSucursal}${notaOCR}${notaArchivo} Revisa que todo esté correcto antes de guardar.`;
      pdfImportMsg.className = "pdf-import-msg exito";
    }
    pdfImportMsg.hidden = false;
  } catch (err) {
    pdfImportMsg.textContent = "No se pudo leer el PDF: " + err.message;
    pdfImportMsg.className = "pdf-import-msg error";
    pdfImportMsg.hidden = false;
  }
}

inputPdfOrden.addEventListener("change", async (e) => {
  await procesarPdfSeleccionado(e.target.files[0]);
  inputPdfOrden.value = "";
});

let contadorArrastre = 0;
["dragenter", "dragover"].forEach(evento => {
  dropzonePdf.addEventListener(evento, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzonePdf.classList.add("arrastrando");
  });
});
dropzonePdf.addEventListener("dragenter", () => { contadorArrastre++; });
dropzonePdf.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  contadorArrastre = Math.max(0, contadorArrastre - 1);
  if (contadorArrastre === 0) dropzonePdf.classList.remove("arrastrando");
});
dropzonePdf.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  contadorArrastre = 0;
  dropzonePdf.classList.remove("arrastrando");
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  await procesarPdfSeleccionado(file);
});

// Evita que soltar el archivo fuera del recuadro haga que el navegador lo abra/navegue.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

function limpiarFormulario() {
  formTitulo.textContent = "Nueva nota de venta";
  document.getElementById("notaId").value = "";
  document.getElementById("fecha").value = hoyISO();
  document.getElementById("folioInterno").value = siguienteFolio();
  document.getElementById("cliente").value = "";
  document.getElementById("rfc").value = "";
  document.getElementById("domicilio").value = "";
  document.getElementById("oi").value = "";
  document.getElementById("folioCompra").value = "";
  document.getElementById("entrega").value = "";
  document.getElementById("placas").value = "";
  document.getElementById("vehiculo").value = "";
  ivaPctInput.value = 16;
  itemsBody.innerHTML = "";
  filaItemVacia();
  document.getElementById("labelSelectSucursal").hidden = true;
  ordenCompraPendiente = null;
}

function cargarNotaEnFormulario(nota) {
  formTitulo.textContent = "Editar nota de venta";
  document.getElementById("notaId").value = nota.id;
  document.getElementById("fecha").value = nota.fecha;
  document.getElementById("folioInterno").value = nota.folioInterno;
  document.getElementById("cliente").value = nota.cliente;
  document.getElementById("rfc").value = nota.rfc || "";
  document.getElementById("domicilio").value = nota.domicilio || "";
  document.getElementById("oi").value = nota.oi || "";
  document.getElementById("folioCompra").value = nota.folioCompra || "";
  document.getElementById("entrega").value = nota.entrega || "";
  document.getElementById("placas").value = nota.placas || "";
  document.getElementById("vehiculo").value = nota.vehiculo || "";
  ivaPctInput.value = nota.ivaPct ?? 16;
  itemsBody.innerHTML = "";
  nota.items.forEach(it => filaItemVacia(it));
  recalcularTotales();
  document.getElementById("labelSelectSucursal").hidden = true;
  // Conserva la orden de compra ya adjunta a esta nota, si tiene una; se reemplaza solo si se
  // importa un nuevo archivo mientras se edita.
  ordenCompraPendiente = nota.ordenCompraUrl ? { url: nota.ordenCompraUrl, tipo: nota.ordenCompraTipo } : null;
  irATab("nueva");
}

document.getElementById("btnCancelar").addEventListener("click", () => {
  limpiarFormulario();
  irATab("lista");
});

formNota.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idExistente = document.getElementById("notaId").value;
  const esNueva = !idExistente;

  const items = [...itemsBody.querySelectorAll("tr")].map(tr => ({
    cantidad: Number(tr.querySelector(".it-cant").value) || 0,
    descripcion: tr.querySelector(".it-desc").value.trim().toUpperCase(),
    precioSinIva: Number(tr.querySelector(".it-precio").value) || 0,
  })).filter(it => it.descripcion);

  if (items.length === 0) {
    alert("Agrega al menos una pieza con descripción.");
    return;
  }

  const existente = !esNueva ? notas.find(n => n.id === idExistente) : null;

  const nota = {
    folioInterno: document.getElementById("folioInterno").value,
    fecha: document.getElementById("fecha").value,
    cliente: document.getElementById("cliente").value.trim().toUpperCase(),
    rfc: document.getElementById("rfc").value.trim().toUpperCase(),
    domicilio: document.getElementById("domicilio").value.trim().toUpperCase(),
    oi: document.getElementById("oi").value.trim().toUpperCase(),
    folioCompra: document.getElementById("folioCompra").value.trim().toUpperCase(),
    entrega: document.getElementById("entrega").value.trim().toUpperCase(),
    placas: document.getElementById("placas").value.trim().toUpperCase(),
    vehiculo: document.getElementById("vehiculo").value.trim().toUpperCase(),
    items,
    ivaPct: Number(ivaPctInput.value) || 0,
    estatus: existente?.estatus || "pendiente",
    fechaEntrega: existente?.fechaEntrega || null,
    recibioNombre: existente?.recibioNombre || "",
    observacionesEntrega: existente?.observacionesEntrega || "",
    ordenCompraUrl: ordenCompraPendiente?.url || null,
    ordenCompraTipo: ordenCompraPendiente?.tipo || null,
  };

  const submitBtn = formNota.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    let notaGuardada;
    if (esNueva) {
      const row = { ...notaToRow(nota), creado_por: sesionActual?.user?.email || null };
      const { data, error } = await sb.from("notas_venta").insert(row).select().single();
      if (error) throw error;
      notaGuardada = rowToNota(data);
    } else {
      const { data, error } = await sb.from("notas_venta").update(notaToRow(nota)).eq("id", idExistente).select().single();
      if (error) throw error;
      notaGuardada = rowToNota(data);
    }
    await cargarNotas();
    limpiarFormulario();
    irATab("lista");
    await imprimirNota(notaGuardada);
  } catch (err) {
    mostrarError("No se pudo guardar la nota: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ===================== Impresión =====================
const notaImprimible = document.getElementById("notaImprimible");

// Convierte la primera página de un PDF (por URL) en una imagen, para poder imprimirla igual que
// una foto — mismo mecanismo que ya se usa para leer PDF sin texto (imagen incrustada) con OCR.
async function pdfComoImagenParaImprimir(url) {
  if (!window.pdfjsLib) return null;
  try {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const resp = await fetch(url);
    const buffer = await resp.arrayBuffer();
    const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pagina = await doc.getPage(1);
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function imprimirNota(nota) {
  const { subtotal, iva, total, ivaPct } = totalesDeNota(nota);
  const filas = nota.items.map(it => `
    <tr>
      <td class="centro">${it.cantidad}</td>
      <td>${it.descripcion}</td>
      <td class="num">${money(it.precioSinIva)}</td>
      <td class="num">${money(it.cantidad * it.precioSinIva)}</td>
    </tr>
  `).join("");

  const filasVacias = Array.from({ length: Math.max(0, 8 - nota.items.length) }).map(() => `
    <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
  `).join("");

  notaImprimible.innerHTML = `
    <table class="hoja-datos">
      <tr>
        <td colspan="3" class="titulo-negocio">${config.business_name}</td>
        <td class="celda-label">FOLIO:</td>
        <td colspan="2" class="folio-grande">${nota.folioInterno}</td>
      </tr>
      <tr>
        <td class="celda-label">FECHA:</td>
        <td colspan="5">${fechaLegible(nota.fecha)}</td>
      </tr>
      <tr>
        <td class="celda-label">CLIENTE:</td>
        <td colspan="5">${nota.cliente}</td>
      </tr>
      <tr>
        <td class="celda-label">RFC:</td>
        <td colspan="5">${nota.rfc || ""}</td>
      </tr>
      <tr>
        <td class="celda-label">DOMICILIO:</td>
        <td colspan="5">${nota.domicilio || ""}</td>
      </tr>
      <tr>
        <td class="celda-label">ORDEN DE INGRESO:</td>
        <td colspan="2">${nota.oi || ""}</td>
        <td class="celda-label">FOLIO COMPRA</td>
        <td colspan="2">${nota.folioCompra || ""}</td>
      </tr>
      <tr>
        <td class="celda-label">PLACAS</td>
        <td colspan="2">${nota.placas || ""}</td>
        <td class="celda-label">ENTREGA</td>
        <td colspan="2">${nota.entrega || ""}</td>
      </tr>
      <tr>
        <td class="celda-label">VEHÍCULO</td>
        <td colspan="5">${nota.vehiculo || ""}</td>
      </tr>
    </table>

    <table class="hoja-items">
      <thead>
        <tr>
          <th style="width:70px">CANTIDAD</th>
          <th>DESCRIPCION</th>
          <th style="width:110px">P. UNITARIO</th>
          <th style="width:110px">IMPORTE</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        ${filasVacias}
        <tr>
          <td colspan="2" style="border:none;text-align:right;">Subtotal</td>
          <td style="border:none"></td>
          <td class="num">${money(subtotal)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:none;text-align:right;">IVA (${ivaPct}%)</td>
          <td style="border:none"></td>
          <td class="num">${money(iva)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:none;text-align:right;font-weight:bold">TOTAL</td>
          <td style="border:none"></td>
          <td class="num" style="font-weight:bold">${money(total)}</td>
        </tr>
      </tbody>
    </table>

    <div class="pagare">
      Por el presente pagaré reconozco deber y me obligo a pagar en esta ciudad o en cualquier otra que se me
      requiera de pago a <strong>${config.business_name}</strong> a su orden el día
      ______________ la cantidad de <strong>${money(total)}</strong> de valor recibido en mercancía.
      Este pagaré mercantil está regido por la Ley General de Títulos y Operaciones de Crédito en su artículo 173
      parte final y demás correlativos por no ser pagaré domiciliado.
    </div>

    <div class="firma-box">
      <div class="linea">Firma de quien recibe / Fecha</div>
      <div class="linea">Sello de recepción</div>
    </div>
  `;

  // Si la nota se creó importando una orden de compra, se imprime también, en una hoja aparte
  // después de la nota.
  if (nota.ordenCompraUrl) {
    let src = null;
    if (nota.ordenCompraTipo === "imagen") src = nota.ordenCompraUrl;
    else if (nota.ordenCompraTipo === "pdf") src = await pdfComoImagenParaImprimir(nota.ordenCompraUrl);
    if (src) {
      notaImprimible.insertAdjacentHTML("beforeend", `
        <div class="orden-compra-pagina">
          <img src="${src}" alt="Orden de compra">
        </div>
      `);
      // Sin esperar a que la imagen termine de decodificarse, window.print() puede dispararse
      // antes de que el navegador la haya pintado, dejando esa hoja en blanco.
      const imgOrden = notaImprimible.querySelector(".orden-compra-pagina img");
      if (imgOrden) {
        try { await imgOrden.decode(); } catch {}
      }
    }
  }

  notaImprimible.style.display = "block";
  window.print();
  setTimeout(() => { notaImprimible.style.display = "none"; }, 300);
}

// ===================== Entregas =====================
const entregasPendientes = document.getElementById("entregasPendientes");
const modalEntrega = document.getElementById("modalEntrega");
const formEntrega = document.getElementById("formEntrega");

function renderEntregas() {
  const pendientes = notas.filter(n => n.estatus === "pendiente");

  if (pendientes.length === 0) {
    entregasPendientes.innerHTML = `<p class="vacio">No hay notas pendientes de entrega. 🎉</p>`;
    return;
  }

  entregasPendientes.innerHTML = pendientes.map(nota => {
    const { total } = totalesDeNota(nota);
    return `
      <div class="tarjeta-entrega">
        <div class="info">
          <strong>${nota.folioInterno} — ${nota.cliente}${nota.domicilio ? " (" + nota.domicilio + ")" : ""}</strong>
          <span>Orden de ingreso: ${nota.oi || "-"} · Placas: ${nota.placas || "-"} · Total: ${money(total)} · Entrega en: ${nota.entrega || "-"}</span>
        </div>
        <div>
          <button class="btn-secundario" data-accion="imprimir" data-id="${nota.id}">Imprimir</button>
          ${nota.ordenCompraUrl ? `<button class="btn-secundario" data-accion="ver-orden-compra" data-id="${nota.id}">Ver orden de compra</button>` : ""}
          <button class="btn-primario" data-accion="marcar-entregada" data-id="${nota.id}">Marcar entregada</button>
        </div>
      </div>
    `;
  }).join("");
}

entregasPendientes.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const nota = notas.find(n => n.id === id);
  if (!nota) return;
  if (btn.dataset.accion === "imprimir") await imprimirNota(nota);
  if (btn.dataset.accion === "ver-orden-compra") window.open(nota.ordenCompraUrl, "_blank");
  if (btn.dataset.accion === "marcar-entregada") {
    document.getElementById("entregaNotaId").value = id;
    document.getElementById("fechaEntrega").value = hoyISO();
    document.getElementById("recibioNombre").value = "";
    document.getElementById("observacionesEntrega").value = "";
    modalEntrega.hidden = false;
  }
});

document.getElementById("btnCancelarEntrega").addEventListener("click", () => { modalEntrega.hidden = true; });

formEntrega.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("entregaNotaId").value;
  const { error } = await sb.from("notas_venta").update({
    estatus: "entregada",
    fecha_entrega: document.getElementById("fechaEntrega").value,
    recibio_nombre: document.getElementById("recibioNombre").value.trim(),
    observaciones_entrega: document.getElementById("observacionesEntrega").value.trim(),
  }).eq("id", id);
  if (error) { mostrarError("No se pudo registrar la entrega: " + error.message); return; }
  modalEntrega.hidden = true;
  await cargarNotas();
});

// Busca, dentro del texto leído por OCR de una foto, un folio con el formato NV-0000 (tolerante
// a que el OCR confunda la V por U o se salte el guion) y devuelve la nota que le corresponda.
function buscarNotaPorFolioEnTexto(lineas) {
  const texto = lineas.join(" ").toUpperCase();
  const candidatos = [...texto.matchAll(/\bN[VU][\s-]{0,3}0*(\d{2,6})\b/g)].map(m => parseInt(m[1], 10));
  for (const num of candidatos) {
    const nota = notas.find(n => parseInt((n.folioInterno || "").replace(/\D/g, ""), 10) === num);
    if (nota) return nota;
  }
  return null;
}

// ===================== Evidencia de entrega (general) =====================
// Un solo botón, visible en cualquier pantalla: al subir la foto de una nota ya firmada, la app
// lee sola el folio (impreso en la hoja) y la empareja con la nota correspondiente, en vez de
// tener que buscarla primero en la lista de Entregas.
const btnSubirEvidencia = document.getElementById("btnSubirEvidencia");
const inputEvidenciaGeneral = document.getElementById("inputEvidenciaGeneral");

btnSubirEvidencia.addEventListener("click", () => inputEvidenciaGeneral.click());

inputEvidenciaGeneral.addEventListener("change", async () => {
  const archivos = Array.from(inputEvidenciaGeneral.files || []);
  inputEvidenciaGeneral.value = "";
  if (archivos.length) await procesarEvidenciasGeneral(archivos);
});

// Procesa una o varias fotos, una tras otra (para no saturar el navegador con varios OCR a la
// vez), y al final da un resumen de todas. Con una sola foto se pregunta a mano si no se pudo leer
// el folio o si la nota ya estaba entregada; con varias, eso interrumpiría la carga en lote, así
// que esos casos solo se listan en el resumen para revisarlos después.
async function procesarEvidenciasGeneral(archivos) {
  if (!window.Tesseract) {
    mostrarError("No se pudo cargar el lector de imágenes (OCR). Revisa tu conexión a internet y recarga la página.");
    return;
  }
  const interactivo = archivos.length === 1;
  const textoOriginal = btnSubirEvidencia.textContent;
  btnSubirEvidencia.disabled = true;

  const exitosas = [];
  const sinFolio = [];
  const errores = [];

  try {
    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      const prefijo = archivos.length > 1 ? `Foto ${i + 1}/${archivos.length}: ` : "";
      try {
        btnSubirEvidencia.textContent = `${prefijo}leyendo folio…`;
        // Primero intenta solo con la esquina superior derecha (donde va el folio, grande y
        // solo): es más rápido y bastante más confiable que leer la nota completa. Si esa
        // pasada no encuentra nada (ej. la foto no encuadra bien esa esquina), cae de vuelta a
        // leer la imagen completa, como respaldo.
        let nota = null;
        try {
          const recorte = await recortarEsquinaSuperiorDerecha(file);
          if (recorte) nota = buscarNotaPorFolioEnTexto(await ejecutarOcr(recorte, "6"));
        } catch {
          // Si el recorte falla (ej. formato de imagen no soportado), se sigue con la imagen completa.
        }
        if (!nota) {
          const lineas = await ejecutarOcr(file, null, (pct) => { btnSubirEvidencia.textContent = `${prefijo}leyendo folio… ${pct}%`; });
          nota = buscarNotaPorFolioEnTexto(lineas);
        }

        if (!nota && interactivo) {
          const folioTecleado = prompt("No se pudo leer el folio en la foto. Escríbelo (ej. NV-0007) para buscar la nota:");
          if (folioTecleado) {
            const num = parseInt(folioTecleado.replace(/\D/g, ""), 10);
            nota = notas.find(n => parseInt((n.folioInterno || "").replace(/\D/g, ""), 10) === num);
          }
        }
        if (!nota) {
          sinFolio.push(file.name || `foto ${i + 1}`);
          continue;
        }

        if (nota.estatus === "entregada" && interactivo) {
          if (!confirm(`La nota ${nota.folioInterno} (${nota.cliente}) ya estaba marcada como entregada. ¿Reemplazar su foto de evidencia por esta?`)) continue;
        }

        btnSubirEvidencia.textContent = `${prefijo}subiendo foto…`;
        const resultado = await subirEvidenciaEntrega(file);
        if (!resultado.ok) { errores.push(`${nota.folioInterno}: ${resultado.error}`); continue; }

        const { error } = await sb.from("notas_venta").update({
          estatus: "entregada",
          fecha_entrega: nota.fechaEntrega || hoyISO(),
          evidencia_entrega_url: resultado.url,
        }).eq("id", nota.id);
        if (error) { errores.push(`${nota.folioInterno}: ${error.message}`); continue; }

        exitosas.push(`${nota.folioInterno} (${nota.cliente})`);
      } catch (err) {
        errores.push(`${prefijo || "Foto: "}${err.message}`);
      }
    }
  } finally {
    btnSubirEvidencia.disabled = false;
    btnSubirEvidencia.textContent = textoOriginal;
  }

  if (exitosas.length) await cargarNotas();

  const partes = [];
  if (exitosas.length) partes.push(`✅ Marcadas como entregadas:\n${exitosas.join("\n")}`);
  if (sinFolio.length) partes.push(`⚠️ No se pudo leer el folio en:\n${sinFolio.join("\n")}\n(Súbelas de nuevo, de una en una, para escribir el folio a mano.)`);
  if (errores.length) partes.push(`❌ Con error:\n${errores.join("\n")}`);
  if (partes.length) alert(partes.join("\n\n"));
}

// ===================== Clientes =====================
let clientes = [];

function clienteToRow(c) {
  return {
    clave: c.clave,
    razon_social: c.razonSocial,
    rfc: c.rfc,
    regimen_fiscal: c.regimenFiscal,
    metodo_pago: c.metodoPago,
    uso_cfdi: c.usoCfdi,
    forma_pago: c.formaPago,
    correo: c.correo,
    codigo_postal: c.codigoPostal,
    pais_residencia: c.paisResidencia,
    calle: c.calle,
    numero_exterior: c.numeroExterior,
    numero_interior: c.numeroInterior,
    colonia: c.colonia,
    municipio: c.municipio,
    estado: c.estado,
    alta_pos: c.altaPos,
    activo: c.activo,
    telefono: c.telefono,
  };
}
function rowToCliente(row) {
  return {
    id: row.id,
    clave: row.clave,
    razonSocial: row.razon_social,
    rfc: row.rfc,
    regimenFiscal: row.regimen_fiscal,
    metodoPago: row.metodo_pago,
    usoCfdi: row.uso_cfdi,
    formaPago: row.forma_pago,
    correo: row.correo,
    codigoPostal: row.codigo_postal,
    paisResidencia: row.pais_residencia,
    calle: row.calle,
    numeroExterior: row.numero_exterior,
    numeroInterior: row.numero_interior,
    colonia: row.colonia,
    municipio: row.municipio,
    estado: row.estado,
    altaPos: row.alta_pos,
    activo: row.activo,
    telefono: row.telefono,
  };
}

async function cargarClientes() {
  const { data, error } = await sb.from("clientes").select("*").order("razon_social", { ascending: true });
  if (error) {
    mostrarError("No se pudieron cargar los clientes: " + error.message);
    return;
  }
  clientes = (data || []).map(rowToCliente);
  renderClientes();
}

const clientesBody = document.getElementById("clientesBody");
const clientesVacio = document.getElementById("clientesVacio");
const buscarCliente = document.getElementById("buscarCliente");

function renderClientes() {
  const q = (buscarCliente.value || "").toLowerCase();
  const filtrados = clientes.filter(c => {
    if (!q) return true;
    return [c.clave, c.razonSocial, c.rfc].join(" ").toLowerCase().includes(q);
  });

  clientesBody.innerHTML = "";
  clientesVacio.hidden = clientes.length !== 0;

  filtrados.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.clave || ""}</td>
      <td>${c.razonSocial}</td>
      <td>${c.rfc || ""}</td>
      <td>${c.telefono || ""}</td>
      <td><span class="badge ${c.activo ? "entregada" : "pendiente"}">${c.activo ? "Activo" : "Inactivo"}</span></td>
      <td>
        <button class="btn-icono" title="Editar" data-accion="editar-cliente" data-id="${c.id}">✏️</button>
        <button class="btn-icono" title="Eliminar" data-accion="eliminar-cliente" data-id="${c.id}">🗑️</button>
      </td>
    `;
    clientesBody.appendChild(tr);
  });
}
buscarCliente.addEventListener("input", renderClientes);

clientesBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const cliente = clientes.find(c => c.id === id);
  if (!cliente) return;
  if (btn.dataset.accion === "editar-cliente") abrirModalCliente(cliente);
  if (btn.dataset.accion === "eliminar-cliente") {
    if (confirm(`¿Eliminar al cliente "${cliente.razonSocial}"? Esta acción no se puede deshacer.`)) {
      const { error } = await sb.from("clientes").delete().eq("id", id);
      if (error) { mostrarError("No se pudo eliminar: " + error.message); return; }
      await cargarClientes();
    }
  }
});

const modalCliente = document.getElementById("modalCliente");
const formCliente = document.getElementById("formCliente");
const clienteModalTitulo = document.getElementById("clienteModalTitulo");

function limpiarFormularioCliente() {
  clienteModalTitulo.textContent = "Nuevo cliente";
  document.getElementById("clienteId").value = "";
  document.getElementById("cliClave").value = "";
  document.getElementById("cliRazonSocial").value = "";
  document.getElementById("cliRfc").value = "";
  document.getElementById("cliRegimenFiscal").value = "";
  document.getElementById("cliMetodoPago").value = "PUE";
  document.getElementById("cliUsoCfdi").value = "";
  document.getElementById("cliFormaPago").value = "";
  document.getElementById("cliCorreo").value = "";
  document.getElementById("cliCp").value = "";
  document.getElementById("cliPais").value = "México";
  document.getElementById("cliCalle").value = "";
  document.getElementById("cliNumExt").value = "";
  document.getElementById("cliNumInt").value = "";
  document.getElementById("cliColonia").value = "";
  document.getElementById("cliMunicipio").value = "";
  document.getElementById("cliEstado").value = "";
  document.getElementById("cliTelefono").value = "";
  document.getElementById("cliActivo").checked = true;
  document.getElementById("cliAltaPos").checked = false;
}

function abrirModalCliente(cliente) {
  const seccionSucursales = document.getElementById("seccionSucursales");
  const avisoGuardaPrimero = document.getElementById("avisoGuardaPrimeroSucursales");
  if (cliente) {
    clienteModalTitulo.textContent = "Editar cliente";
    seccionSucursales.hidden = false;
    avisoGuardaPrimero.hidden = true;
    renderSucursalesDeCliente(cliente.id);
    document.getElementById("clienteId").value = cliente.id;
    document.getElementById("cliClave").value = cliente.clave || "";
    document.getElementById("cliRazonSocial").value = cliente.razonSocial || "";
    document.getElementById("cliRfc").value = cliente.rfc || "";
    document.getElementById("cliRegimenFiscal").value = cliente.regimenFiscal || "";
    document.getElementById("cliMetodoPago").value = cliente.metodoPago || "PUE";
    document.getElementById("cliUsoCfdi").value = cliente.usoCfdi || "";
    document.getElementById("cliFormaPago").value = cliente.formaPago || "";
    document.getElementById("cliCorreo").value = cliente.correo || "";
    document.getElementById("cliCp").value = cliente.codigoPostal || "";
    document.getElementById("cliPais").value = cliente.paisResidencia || "México";
    document.getElementById("cliCalle").value = cliente.calle || "";
    document.getElementById("cliNumExt").value = cliente.numeroExterior || "";
    document.getElementById("cliNumInt").value = cliente.numeroInterior || "";
    document.getElementById("cliColonia").value = cliente.colonia || "";
    document.getElementById("cliMunicipio").value = cliente.municipio || "";
    document.getElementById("cliEstado").value = cliente.estado || "";
    document.getElementById("cliTelefono").value = cliente.telefono || "";
    document.getElementById("cliActivo").checked = !!cliente.activo;
    document.getElementById("cliAltaPos").checked = !!cliente.altaPos;
  } else {
    limpiarFormularioCliente();
    seccionSucursales.hidden = true;
    avisoGuardaPrimero.hidden = false;
  }
  modalCliente.hidden = false;
}

document.getElementById("btnNuevoCliente").addEventListener("click", () => abrirModalCliente(null));
document.getElementById("btnCancelarCliente").addEventListener("click", () => { modalCliente.hidden = true; });

formCliente.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idExistente = document.getElementById("clienteId").value;
  const esNuevo = !idExistente;

  const cliente = {
    clave: document.getElementById("cliClave").value.trim(),
    razonSocial: document.getElementById("cliRazonSocial").value.trim(),
    rfc: document.getElementById("cliRfc").value.trim().toUpperCase(),
    regimenFiscal: document.getElementById("cliRegimenFiscal").value,
    metodoPago: document.getElementById("cliMetodoPago").value,
    usoCfdi: document.getElementById("cliUsoCfdi").value,
    formaPago: document.getElementById("cliFormaPago").value,
    correo: document.getElementById("cliCorreo").value.trim(),
    codigoPostal: document.getElementById("cliCp").value.trim(),
    paisResidencia: document.getElementById("cliPais").value.trim() || "México",
    calle: document.getElementById("cliCalle").value.trim(),
    numeroExterior: document.getElementById("cliNumExt").value.trim(),
    numeroInterior: document.getElementById("cliNumInt").value.trim(),
    colonia: document.getElementById("cliColonia").value.trim(),
    municipio: document.getElementById("cliMunicipio").value.trim(),
    estado: document.getElementById("cliEstado").value,
    telefono: document.getElementById("cliTelefono").value.trim(),
    activo: document.getElementById("cliActivo").checked,
    altaPos: document.getElementById("cliAltaPos").checked,
  };

  const submitBtn = formCliente.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    if (esNuevo) {
      const { data, error } = await sb.from("clientes").insert(clienteToRow(cliente)).select().single();
      if (error) throw error;
      await cargarClientes();
      // Se deja el modal abierto, ya en modo edición, para poder agregar sucursales de una vez.
      abrirModalCliente(rowToCliente(data));
    } else {
      const { error } = await sb.from("clientes").update(clienteToRow(cliente)).eq("id", idExistente);
      if (error) throw error;
      await cargarClientes();
      modalCliente.hidden = true;
    }
  } catch (err) {
    mostrarError("No se pudo guardar el cliente: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ===================== Sucursales (por cliente) =====================
let sucursales = [];

// Arma un domicilio completo a partir de calle, número, colonia, municipio y C.P.
function formatearDomicilio({ calle, numeroExterior, colonia, municipio, codigoPostal }) {
  const calleNumero = [calle, numeroExterior].filter(Boolean).join(" ");
  const partes = [calleNumero, colonia, municipio].filter(Boolean);
  let texto = partes.join(", ");
  if (codigoPostal) texto += (texto ? ", " : "") + "CP " + codigoPostal;
  return texto;
}

function sucursalToRow(s) {
  return {
    cliente_id: s.clienteId,
    nombre: s.nombre,
    calle: s.calle,
    numero_exterior: s.numeroExterior,
    colonia: s.colonia,
    municipio: s.municipio,
    codigo_postal: s.codigoPostal,
    activa: s.activa,
  };
}
function rowToSucursal(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    nombre: row.nombre,
    calle: row.calle,
    numeroExterior: row.numero_exterior,
    colonia: row.colonia,
    municipio: row.municipio,
    codigoPostal: row.codigo_postal,
    activa: row.activa,
  };
}

async function cargarSucursales() {
  const { data, error } = await sb.from("sucursales").select("*").order("nombre", { ascending: true });
  if (error) {
    mostrarError("No se pudieron cargar las sucursales: " + error.message);
    return;
  }
  sucursales = (data || []).map(rowToSucursal);
}

function renderSucursalesDeCliente(clienteId) {
  const sucursalesBody = document.getElementById("sucursalesBody");
  const sucursalesVacio = document.getElementById("sucursalesVacio");
  const deEsteCliente = sucursales.filter(s => s.clienteId === clienteId);

  sucursalesBody.innerHTML = "";
  sucursalesVacio.hidden = deEsteCliente.length !== 0;

  deEsteCliente.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.nombre}</td>
      <td>${formatearDomicilio(s)}</td>
      <td><button type="button" class="btn-icono" data-accion="eliminar-sucursal" data-id="${s.id}">✕</button></td>
    `;
    sucursalesBody.appendChild(tr);
  });
}

document.getElementById("sucursalesBody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion='eliminar-sucursal']");
  if (!btn) return;
  const { error } = await sb.from("sucursales").delete().eq("id", btn.dataset.id);
  if (error) { mostrarError("No se pudo eliminar la sucursal: " + error.message); return; }
  await cargarSucursales();
  renderSucursalesDeCliente(document.getElementById("clienteId").value);
});

document.getElementById("btnAgregarSucursal").addEventListener("click", async () => {
  const clienteId = document.getElementById("clienteId").value;
  if (!clienteId) return;
  const nombreInput = document.getElementById("nuevaSucursalNombre");
  const calleInput = document.getElementById("nuevaSucursalCalle");
  const numeroInput = document.getElementById("nuevaSucursalNumero");
  const coloniaInput = document.getElementById("nuevaSucursalColonia");
  const municipioInput = document.getElementById("nuevaSucursalMunicipio");
  const cpInput = document.getElementById("nuevaSucursalCp");
  const nombre = nombreInput.value.trim().toUpperCase();
  if (!nombre) { nombreInput.focus(); return; }

  const { error } = await sb.from("sucursales").insert({
    cliente_id: clienteId,
    nombre,
    calle: calleInput.value.trim().toUpperCase() || null,
    numero_exterior: numeroInput.value.trim().toUpperCase() || null,
    colonia: coloniaInput.value.trim().toUpperCase() || null,
    municipio: municipioInput.value.trim().toUpperCase() || null,
    codigo_postal: cpInput.value.trim() || null,
    activa: true,
  });
  if (error) { mostrarError("No se pudo agregar la sucursal: " + error.message); return; }

  [nombreInput, calleInput, numeroInput, coloniaInput, municipioInput, cpInput].forEach(i => { i.value = ""; });
  await cargarSucursales();
  renderSucursalesDeCliente(clienteId);
});

// ===================== Ajustes / respaldo =====================
document.getElementById("btnExportar").addEventListener("click", () => {
  const data = JSON.stringify({ notas, config }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `respaldo-notas-venta-${hoyISO()}.json`;
  a.click();
});

// ===================== Inicio =====================
if (sb) sb.auth.getSession().then(({ data }) => {
  if (!data.session) {
    pantallaLogin.hidden = false;
    topbar.hidden = true;
    mainEl.hidden = true;
  }
});
