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
let config = { business_name: "PEDRO MARQUEZ LOZA" };
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
  };
}
// Convierte una fila de Supabase (snake_case) al formato que usa la app (camelCase).
function rowToNota(row) {
  return {
    id: row.id,
    folioInterno: row.folio_interno,
    fecha: row.fecha,
    cliente: row.cliente,
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

  filtradas.forEach(nota => {
    const { total } = totalesDeNota(nota);
    const tr = document.createElement("tr");
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
        <button class="btn-icono" title="Eliminar" data-accion="eliminar" data-id="${nota.id}">🗑️</button>
      </td>
    `;
    listaBody.appendChild(tr);
  });
}
buscarInput.addEventListener("input", renderLista);
filtroEstatus.addEventListener("change", renderLista);

listaBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const nota = notas.find(n => n.id === id);
  if (!nota) return;
  if (btn.dataset.accion === "imprimir") imprimirNota(nota);
  if (btn.dataset.accion === "editar") cargarNotaEnFormulario(nota);
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
["cliente", "domicilio", "oi", "folioCompra", "entrega", "placas", "vehiculo"].forEach(id => {
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

sugerenciasCliente.addEventListener("mousedown", (e) => {
  // mousedown (no click) para que dispare antes del "blur" del input
  const item = e.target.closest(".sugerencia-item");
  if (!item) return;
  const cliente = clientes.find(c => c.id === item.dataset.id);
  if (!cliente) return;
  clienteInput.value = (cliente.clave || cliente.razonSocial || "").toUpperCase();
  if (cliente.municipio) document.getElementById("domicilio").value = cliente.municipio.toUpperCase();
  ocultarSugerenciasCliente();
  document.getElementById("domicilio").focus();
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

function parsearOrdenCompra(lineas) {
  const texto = lineas.join("\n");
  const datos = { items: [] };

  const mFolio = texto.match(/\b([A-Z]{2,8}-\d{2,6})\b/);
  if (mFolio) datos.folioCompra = mFolio[1];

  const mOi = texto.match(/ORDEN\s*#\s*(\d+)/i);
  if (mOi) datos.oi = mOi[1];

  const mPlacas = texto.match(/PLACAS\s+([A-Z0-9]{5,9})\b/i);
  if (mPlacas) datos.placas = mPlacas[1];

  const mVehiculo = texto.match(/VEH[ÍI]CULO\s+(.+?)(?:\n|$)/i);
  if (mVehiculo) datos.vehiculo = mVehiculo[1].trim();

  const mFecha = texto.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if (mFecha) {
    const mes = MESES[mFecha[2].toLowerCase()];
    if (mes) datos.fecha = `${mFecha[3]}-${String(mes).padStart(2, "0")}-${String(mFecha[1]).padStart(2, "0")}`;
  }

  // El nombre del cliente suele aparecer como línea propia justo debajo del folio,
  // antes de la línea con la dirección completa (que empieza igual y trae "·").
  if (mFolio) {
    const idxFolio = lineas.findIndex(l => l.includes(mFolio[1]));
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

  const reItem = /^(\d+)\s+(.+?)\s+(\d+)\s+\$\s?([\d,]+\.\d{2})\s+\$\s?([\d,]+\.\d{2})$/;
  for (const linea of lineas) {
    const m = linea.match(reItem);
    if (m) {
      datos.items.push({
        cantidad: Number(m[3]) || 1,
        descripcion: m[2].trim(),
        precioSinIva: Number(m[4].replace(/,/g, "")) || 0,
      });
    }
  }

  return datos;
}

async function extraerDatosPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("No se pudo cargar el lector de PDF. Revisa tu conexión a internet y recarga la página.");
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buffer = await file.arrayBuffer();
  const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pagina = await doc.getPage(1);
  const contenido = await pagina.getTextContent();
  const lineas = reconstruirLineasPdf(contenido);
  return parsearOrdenCompra(lineas);
}

const inputPdfOrden = document.getElementById("inputPdfOrden");
const pdfImportMsg = document.getElementById("pdfImportMsg");
const dropzonePdf = document.getElementById("dropzonePdf");

async function procesarPdfSeleccionado(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    pdfImportMsg.textContent = "Ese archivo no es un PDF. Arrastra o elige el PDF de la orden de compra.";
    pdfImportMsg.className = "pdf-import-msg error";
    pdfImportMsg.hidden = false;
    return;
  }
  pdfImportMsg.hidden = true;
  try {
    const datos = await extraerDatosPdf(file);
    if (datos.fecha) document.getElementById("fecha").value = datos.fecha;
    if (datos.cliente) document.getElementById("cliente").value = datos.cliente.toUpperCase();
    if (datos.domicilio) document.getElementById("domicilio").value = datos.domicilio.toUpperCase();
    if (datos.oi) document.getElementById("oi").value = datos.oi.toUpperCase();
    if (datos.folioCompra) document.getElementById("folioCompra").value = datos.folioCompra.toUpperCase();
    if (datos.domicilio) document.getElementById("entrega").value = datos.domicilio.toUpperCase();
    if (datos.placas) document.getElementById("placas").value = datos.placas.toUpperCase();
    if (datos.vehiculo) document.getElementById("vehiculo").value = datos.vehiculo.toUpperCase();

    if (datos.items.length > 0) {
      itemsBody.innerHTML = "";
      datos.items.forEach(it => filaItemVacia({ ...it, descripcion: it.descripcion.toUpperCase() }));
    }
    recalcularTotales();

    const camposEncontrados = Object.keys(datos).filter(k => k !== "items" && datos[k]).length;
    if (camposEncontrados === 0 && datos.items.length === 0) {
      pdfImportMsg.textContent = "No se encontraron datos reconocibles en este PDF. Llena la nota a mano.";
      pdfImportMsg.className = "pdf-import-msg error";
    } else {
      pdfImportMsg.textContent = `✓ Datos importados de "${file.name}" (${datos.items.length} pieza(s)) — revisa que todo esté correcto antes de guardar.`;
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
  document.getElementById("domicilio").value = "";
  document.getElementById("oi").value = "";
  document.getElementById("folioCompra").value = "";
  document.getElementById("entrega").value = "";
  document.getElementById("placas").value = "";
  document.getElementById("vehiculo").value = "";
  ivaPctInput.value = 16;
  itemsBody.innerHTML = "";
  filaItemVacia();
}

function cargarNotaEnFormulario(nota) {
  formTitulo.textContent = "Editar nota de venta";
  document.getElementById("notaId").value = nota.id;
  document.getElementById("fecha").value = nota.fecha;
  document.getElementById("folioInterno").value = nota.folioInterno;
  document.getElementById("cliente").value = nota.cliente;
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
    imprimirNota(notaGuardada);
  } catch (err) {
    mostrarError("No se pudo guardar la nota: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ===================== Impresión =====================
const notaImprimible = document.getElementById("notaImprimible");

function imprimirNota(nota) {
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
        <td colspan="4" class="titulo-negocio">${config.business_name}</td>
        <td class="celda-label">FECHA:</td>
        <td>${fechaLegible(nota.fecha)}</td>
      </tr>
      <tr>
        <td class="celda-label">CLIENTE:</td>
        <td colspan="5">${nota.cliente}</td>
      </tr>
      <tr>
        <td class="celda-label">DOMICILIO:</td>
        <td colspan="5">${nota.domicilio || ""}</td>
      </tr>
      <tr>
        <td class="celda-label">O/I:</td>
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
      <div class="linea">Firma de quien entrega</div>
    </div>
  `;

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
          <span>O/I: ${nota.oi || "-"} · Placas: ${nota.placas || "-"} · Total: ${money(total)} · Entrega en: ${nota.entrega || "-"}</span>
        </div>
        <div>
          <button class="btn-secundario" data-accion="imprimir" data-id="${nota.id}">Imprimir</button>
          <button class="btn-primario" data-accion="marcar-entregada" data-id="${nota.id}">Marcar entregada</button>
        </div>
      </div>
    `;
  }).join("");
}

entregasPendientes.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const nota = notas.find(n => n.id === id);
  if (!nota) return;
  if (btn.dataset.accion === "imprimir") imprimirNota(nota);
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
  if (cliente) {
    clienteModalTitulo.textContent = "Editar cliente";
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
      const { error } = await sb.from("clientes").insert(clienteToRow(cliente));
      if (error) throw error;
    } else {
      const { error } = await sb.from("clientes").update(clienteToRow(cliente)).eq("id", idExistente);
      if (error) throw error;
    }
    await cargarClientes();
    modalCliente.hidden = true;
  } catch (err) {
    mostrarError("No se pudo guardar el cliente: " + err.message);
  } finally {
    submitBtn.disabled = false;
  }
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
