// ===================== Almacenamiento =====================
const STORAGE_KEY = "notasVenta.v1";
const CONFIG_KEY = "notasVenta.config.v1";

function cargarNotas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function guardarNotas(notas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notas));
}
function cargarConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { businessName: "PEDRO MARQUEZ LOZA" };
  } catch {
    return { businessName: "PEDRO MARQUEZ LOZA" };
  }
}
function guardarConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

let notas = cargarNotas();
let config = cargarConfig();

// ===================== Utilidades =====================
function money(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() {
  return "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

// ===================== Nombre del negocio =====================
const businessNameInput = document.getElementById("businessName");
businessNameInput.value = config.businessName;
businessNameInput.addEventListener("change", () => {
  config.businessName = businessNameInput.value.trim() || "MI NEGOCIO";
  guardarConfig(config);
});

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
    })
    .sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));

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

listaBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const id = btn.dataset.id;
  const nota = notas.find(n => n.id === id);
  if (!nota) return;
  if (btn.dataset.accion === "imprimir") imprimirNota(nota);
  if (btn.dataset.accion === "editar") cargarNotaEnFormulario(nota);
  if (btn.dataset.accion === "eliminar") {
    if (confirm(`¿Eliminar la nota ${nota.folioInterno}? Esta acción no se puede deshacer.`)) {
      notas = notas.filter(n => n.id !== id);
      guardarNotas(notas);
      renderLista();
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
    const importeSinIva = cant * precio;
    subtotal += importeSinIva;
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

formNota.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("notaId").value || uid();
  const esNueva = !document.getElementById("notaId").value;

  const items = [...itemsBody.querySelectorAll("tr")].map(tr => ({
    cantidad: Number(tr.querySelector(".it-cant").value) || 0,
    descripcion: tr.querySelector(".it-desc").value.trim(),
    precioSinIva: Number(tr.querySelector(".it-precio").value) || 0,
  })).filter(it => it.descripcion);

  if (items.length === 0) {
    alert("Agrega al menos una pieza con descripción.");
    return;
  }

  const nota = {
    id,
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
    estatus: esNueva ? "pendiente" : (notas.find(n => n.id === id)?.estatus || "pendiente"),
    fechaEntrega: esNueva ? null : (notas.find(n => n.id === id)?.fechaEntrega || null),
    recibioNombre: esNueva ? "" : (notas.find(n => n.id === id)?.recibioNombre || ""),
    observacionesEntrega: esNueva ? "" : (notas.find(n => n.id === id)?.observacionesEntrega || ""),
    creadoEn: esNueva ? Date.now() : (notas.find(n => n.id === id)?.creadoEn || Date.now()),
  };

  if (esNueva) {
    notas.push(nota);
  } else {
    notas = notas.map(n => n.id === id ? nota : n);
  }
  guardarNotas(notas);
  limpiarFormulario();
  irATab("lista");
  imprimirNota(nota, { preguntar: true });
});

// ===================== Impresión =====================
const notaImprimible = document.getElementById("notaImprimible");

function imprimirNota(nota, opts = {}) {
  const { subtotal, iva, total, ivaPct } = totalesDeNota(nota);
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
        <td colspan="4" class="titulo-negocio">${config.businessName}</td>
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
      requiera de pago a <strong>${config.businessName}</strong> a su orden el día
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
  const pendientes = notas
    .filter(n => n.estatus === "pendiente")
    .sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0));

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

formEntrega.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("entregaNotaId").value;
  notas = notas.map(n => n.id === id ? {
    ...n,
    estatus: "entregada",
    fechaEntrega: document.getElementById("fechaEntrega").value,
    recibioNombre: document.getElementById("recibioNombre").value.trim(),
    observacionesEntrega: document.getElementById("observacionesEntrega").value.trim(),
  } : n);
  guardarNotas(notas);
  modalEntrega.hidden = true;
  renderEntregas();
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

document.getElementById("inputImportar").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.notas)) throw new Error("Formato inválido");
      if (!confirm("Esto reemplazará todas las notas actuales con las del respaldo. ¿Continuar?")) return;
      notas = data.notas;
      config = data.config || config;
      guardarNotas(notas);
      guardarConfig(config);
      businessNameInput.value = config.businessName;
      renderLista();
      alert("Respaldo importado correctamente.");
    } catch (err) {
      alert("No se pudo leer el archivo de respaldo: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("btnBorrarTodo").addEventListener("click", () => {
  if (confirm("Esto borrará TODAS las notas de venta guardadas en este navegador. ¿Estás seguro?")) {
    notas = [];
    guardarNotas(notas);
    renderLista();
  }
});

// ===================== Inicio =====================
limpiarFormulario();
renderLista();
