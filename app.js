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
}

// ===================== Navegación de pestañas =====================
const tabs = document.querySelectorAll(".tab-btn");
const panels = {
  lista: document.getElementById("tab-lista"),
  nueva: document.getElementById("tab-nueva"),
  entregas: document.getElementById("tab-entregas"),
  ajustes: document.getElementById("tab-ajustes"),
};
function irATab(nombre) {
  tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === nombre));
  Object.entries(panels).forEach(([key, el]) => { el.hidden = key !== nombre; });
  if (nombre === "lista") renderLista();
  if (nombre === "entregas") renderEntregas();
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
    <td><input type="number" min="0" step="0.01" class="it-precio" value="${item.precioSinIva}"></td>
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
    const importe = cant * precio * (1 + ivaPct / 100);
    tr.querySelector(".it-importe").textContent = money(importe);
  });
  const iva = subtotal * (ivaPct / 100);
  const total = subtotal + iva;
  subtotalTxt.textContent = money(subtotal);
  ivaTxt.textContent = money(iva);
  totalTxt.textContent = money(total);
}

itemsBody.addEventListener("input", recalcularTotales);
ivaPctInput.addEventListener("input", recalcularTotales);
itemsBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion='quitar-item']");
  if (!btn) return;
  if (itemsBody.querySelectorAll("tr").length > 1) {
    btn.closest("tr").remove();
    recalcularTotales();
  }
});
document.getElementById("btnAddItem").addEventListener("click", () => filaItemVacia());

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
    descripcion: tr.querySelector(".it-desc").value.trim(),
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
    cliente: document.getElementById("cliente").value.trim(),
    domicilio: document.getElementById("domicilio").value.trim(),
    oi: document.getElementById("oi").value.trim(),
    folioCompra: document.getElementById("folioCompra").value.trim(),
    entrega: document.getElementById("entrega").value.trim(),
    placas: document.getElementById("placas").value.trim(),
    vehiculo: document.getElementById("vehiculo").value.trim(),
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
  const { subtotal, total, ivaPct } = totalesDeNota(nota);
  const filas = nota.items.map(it => `
    <tr>
      <td class="centro">${it.cantidad}</td>
      <td>${it.descripcion}</td>
      <td class="num">${money(it.precioSinIva)}</td>
      <td class="num">${money(it.cantidad * it.precioSinIva * (1 + ivaPct / 100))}</td>
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
          <th style="width:110px">PRECIO S/IVA</th>
          <th style="width:110px">IMPORTE</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
        ${filasVacias}
        <tr>
          <td colspan="2" style="border:none"></td>
          <td class="num" style="font-weight:bold">${money(subtotal)}</td>
          <td class="num" style="font-weight:bold">${money(total)}</td>
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
