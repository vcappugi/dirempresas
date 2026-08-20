import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let salesPage = 1;
const salesPageSize = 10;
let salesSearchQuery = "";
let salesTotalCount = 0;
let salesList = [];
let modelosList = [];
let periodosList = [];
let lineasList = [];
let familiasList = [];
let parsedImportRows = [];

// Helper to format currency
const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

// Fetch and cache Lineas catalog
export const loadLineasCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}lineas?order=nombre.asc`, { method: 'GET', headers: getHeaders() });
    if (res.ok) lineasList = await res.json();
  } catch (e) {
    console.warn("Error cargando catálogo de líneas:", e);
  }
};

// Fetch and cache Familias catalog
export const loadFamiliasCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}familia?order=nombre.asc`, { method: 'GET', headers: getHeaders() });
    if (res.ok) familiasList = await res.json();
  } catch (e) {
    console.warn("Error cargando catálogo de familias:", e);
  }
};

// Fetch and cache Modelos catalog
export const loadModelosCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}modelos?order=modelo.asc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      modelosList = await res.json();
    }
  } catch (e) {
    console.warn("Error cargando catálogo de modelos:", e);
  }
};

// Fetch and cache Periodos catalog
export const loadPeriodosCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}periodos?order=fechadesde.asc,id.desc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      periodosList = await res.json();
    }
  } catch (e) {
    console.warn("Error cargando catálogo de períodos:", e);
  }
};

// Automatically find the matching Period ID for a given date
export const findPeriodForDate = (dateStr) => {
  if (!dateStr || periodosList.length === 0) return null;

  // Normalize date string (support YYYY-MM-DD or DD/MM/YYYY)
  let isoDate = dateStr.trim();
  if (isoDate.includes('/')) {
    const p = isoDate.split('/');
    if (p.length === 3) {
      // Assuming DD/MM/YYYY -> YYYY-MM-DD
      isoDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
  }

  // 1. Direct date range match (fechadesde <= dateStr <= fechahasta)
  const exact = periodosList.find(p => {
    if (p.fechadesde && p.fechahasta) {
      const from = p.fechadesde.split('T')[0];
      const to = p.fechahasta.split('T')[0];
      return isoDate >= from && isoDate <= to;
    }
    return false;
  });
  if (exact) return exact.id;

  // 2. Year & Month fallback matching (e.g. 2026-02 -> 'feb-2026' or '2026-02')
  try {
    const parts = isoDate.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1];
      const monthInt = parseInt(month, 10);
      const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const monthPrefix = shortMonths[monthInt - 1];
      
      const foundByCode = periodosList.find(p => {
        const pStr = (p.periodo || '').toLowerCase();
        return (monthPrefix && pStr.includes(monthPrefix) && pStr.includes(year)) ||
               pStr.includes(`${year}-${month}`);
      });
      if (foundByCode) return foundByCode.id;
    }
  } catch (e) {}

  return null;
};

// Auto-select period in the modal dropdown based on current date input
export const autoSelectPeriodFromDate = () => {
  const fechaInput = document.getElementById('sale-form-fecha');
  const periodoSelect = document.getElementById('sale-form-periodo');
  if (!fechaInput || !periodoSelect) return;

  const dateVal = fechaInput.value;
  if (!dateVal) return;

  const matchedPeriodId = findPeriodForDate(dateVal);
  if (matchedPeriodId) {
    periodoSelect.value = String(matchedPeriodId);
    periodoSelect.classList.add('ring-2', 'ring-emerald-500', 'border-transparent');
    setTimeout(() => {
      periodoSelect.classList.remove('ring-2', 'ring-emerald-500', 'border-transparent');
    }, 800);
  }
};

// Populate Selects in Sale Modal
const populateSaleSelects = async (selectedModelo = null, selectedPeriodo = null) => {
  if (modelosList.length === 0) await loadModelosCatalog();
  if (periodosList.length === 0) await loadPeriodosCatalog();

  const modeloSelect = document.getElementById('sale-form-modelo');
  const periodoSelect = document.getElementById('sale-form-periodo');

  if (modeloSelect) {
    modeloSelect.innerHTML = '<option value="">-- Seleccionar Modelo --</option>';
    modelosList.forEach(m => {
      const isSel = selectedModelo && String(selectedModelo) === String(m.id) ? 'selected' : '';
      modeloSelect.innerHTML += `<option value="${m.id}" ${isSel}>${escapeHtml(m.modelo || 'Modelo #' + m.id)}</option>`;
    });
  }

  if (periodoSelect) {
    periodoSelect.innerHTML = '<option value="">-- Seleccionar Período --</option>';
    periodosList.forEach(p => {
      const isSel = selectedPeriodo && String(selectedPeriodo) === String(p.id) ? 'selected' : '';
      let dateRangeInfo = '';
      if (p.fechadesde && p.fechahasta) {
        dateRangeInfo = ` (${p.fechadesde} a ${p.fechahasta})`;
      }
      periodoSelect.innerHTML += `<option value="${p.id}" ${isSel}>${escapeHtml(p.periodo || 'Período #' + p.id)}${escapeHtml(dateRangeInfo)}</option>`;
    });
  }
};

export const loadSales = async () => {
  const loadingEl = document.getElementById('sales-loading');
  const tableBody = document.getElementById('sales-table-body');
  const emptyEl = document.getElementById('sales-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  // Pre-load catalogs
  if (modelosList.length === 0) await loadModelosCatalog();
  if (periodosList.length === 0) await loadPeriodosCatalog();

  const start = (salesPage - 1) * salesPageSize;
  const end = start + salesPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}ventas`;

    if (salesSearchQuery) {
      const encSearch = encodeURIComponent(salesSearchQuery);
      queryUrl += `?or=(cliente.ilike.*${encSearch}*,vendedor.ilike.*${encSearch}*,nro_factura.ilike.*${encSearch}*)&order=fecha.desc,id.desc`;
    } else {
      queryUrl += `?order=fecha.desc,id.desc`;
    }

    const headers = getHeaders();
    headers["Prefer"] = "count=exact";
    headers["Range"] = `${start}-${end}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} - No se pudo conectar a la tabla de ventas.`);
    
    salesList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        salesTotalCount = parseInt(parts[1], 10);
      }
    } else {
      salesTotalCount = salesList.length;
    }

    if (salesList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateSalesPaginationUI(0, 0);
    } else {
      salesList.forEach(s => {
        let fechaVenta = '-';
        if (s.fecha) {
          try {
            fechaVenta = s.fecha;
          } catch(e) {}
        }

        let fechaCreacion = '-';
        if (s.created_at) {
          try {
            fechaCreacion = new Date(s.created_at).toLocaleDateString();
          } catch(e) {}
        }

        // Find modelo and periodo names
        const modObj = modelosList.find(m => String(m.id) === String(s.modelo_id));
        const modeloName = modObj ? modObj.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : '-');

        const perObj = periodosList.find(p => String(p.id) === String(s.periodo_id));
        const periodoName = perObj ? perObj.periodo : (s.periodo_id ? `Período #${s.periodo_id}` : '-');

        const canWrite = window.hasPermission('view-sales', 'escribir') || window.hasPermission('view-ventas', 'escribir');

        const btnEditar = `
          <button onclick="editSale(${s.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Venta">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editSale(${s.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteSale(${s.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Venta">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        `;

        const actionButtons = canWrite ? `${btnEditar}${btnEliminar}` : `${btnVer}`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors';
        tr.innerHTML = `
          <td class="px-4 py-3 text-left">
            <div class="flex items-center gap-1.5">
              ${actionButtons}
            </div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">#${s.id}</td>
          <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">${fechaVenta}</td>
          <td class="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">${escapeHtml(s.nro_factura || '-')}</td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
              ${escapeHtml(modeloName)}
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
              ${escapeHtml(periodoName)}
            </span>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">${escapeHtml(s.cliente || '-')}</td>
          <td class="px-4 py-3 text-center">
            <span class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              ${s.cantidad ?? 1}
            </span>
          </td>
          <td class="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">${formatCurrency(s.precio_venta)}</td>
          <td class="px-4 py-3 text-slate-700 dark:text-slate-300">${escapeHtml(s.vendedor || '-')}</td>
          <td class="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(s.comision_vendedor)}</td>
          <td class="px-4 py-3 text-xs text-slate-400">${fechaCreacion}</td>
        `;
        tableBody.appendChild(tr);
      });

      const currentStart = start + 1;
      const currentEnd = Math.min(start + salesList.length, salesTotalCount);
      updateSalesPaginationUI(currentStart, currentEnd);
    }
  } catch (err) {
    console.error("Error al cargar ventas:", err);
    showToast(err.message || 'Error al conectar con la base de datos', false);
    emptyEl?.classList.remove('hidden');
    updateSalesPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateSalesPaginationUI = (start, end) => {
  const rangeStart = document.getElementById('sales-range-start');
  const rangeEnd = document.getElementById('sales-range-end');
  const totalCountEl = document.getElementById('sales-total-count');
  const currentPageEl = document.getElementById('sales-current-page');
  const totalPagesEl = document.getElementById('sales-total-pages');
  const btnPrev = document.getElementById('sales-btn-prev');
  const btnNext = document.getElementById('sales-btn-next');

  const totalPages = Math.ceil(salesTotalCount / salesPageSize) || 1;

  if (rangeStart) rangeStart.textContent = start;
  if (rangeEnd) rangeEnd.textContent = end;
  if (totalCountEl) totalCountEl.textContent = salesTotalCount;
  if (currentPageEl) currentPageEl.textContent = salesPage || 1;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = (salesPage <= 1);
  if (btnNext) btnNext.disabled = (salesPage >= totalPages || salesTotalCount === 0);
};

export const openSaleModal = async (sale = null) => {
  const overlay = document.getElementById('sale-modal-overlay');
  const card = document.getElementById('sale-modal-card');
  const title = document.getElementById('sale-modal-title');
  const form = document.getElementById('sale-form');
  const saveBtn = document.getElementById('btn-save-sale');

  if (!overlay || !card || !form) return;

  const canWrite = window.hasPermission('view-sales', 'escribir') || window.hasPermission('view-ventas', 'escribir');

  form.reset();

  const idInput = document.getElementById('sale-form-id');
  const fechaInput = document.getElementById('sale-form-fecha');
  const nroFacturaInput = document.getElementById('sale-form-nro-factura');
  const precioVentaInput = document.getElementById('sale-form-precio-venta');
  const clienteInput = document.getElementById('sale-form-cliente');
  const cantidadInput = document.getElementById('sale-form-cantidad');
  const vendedorInput = document.getElementById('sale-form-vendedor');
  const comisionInput = document.getElementById('sale-form-comision');

  if (sale) {
    title.textContent = canWrite ? 'Editar Venta' : 'Detalles de la Venta';
    if (idInput) idInput.value = sale.id;
    if (fechaInput) fechaInput.value = sale.fecha || '';
    if (nroFacturaInput) nroFacturaInput.value = sale.nro_factura || '';
    if (precioVentaInput) precioVentaInput.value = sale.precio_venta ?? '';
    if (clienteInput) clienteInput.value = sale.cliente || '';
    if (cantidadInput) cantidadInput.value = sale.cantidad ?? 1;
    if (vendedorInput) vendedorInput.value = sale.vendedor || '';
    if (comisionInput) comisionInput.value = sale.comision_vendedor ?? '';

    await populateSaleSelects(sale.modelo_id, sale.periodo_id);
  } else {
    title.textContent = 'Registrar Venta';
    if (idInput) idInput.value = '';
    if (nroFacturaInput) nroFacturaInput.value = '';
    if (precioVentaInput) precioVentaInput.value = '';
    const today = new Date().toISOString().split('T')[0];
    if (fechaInput) fechaInput.value = today;
    if (cantidadInput) cantidadInput.value = 1;

    await populateSaleSelects();
    autoSelectPeriodFromDate();
  }

  // Handle read-only state
  const formInputs = form.querySelectorAll('input, select');
  formInputs.forEach(input => {
    input.disabled = !canWrite;
  });

  if (saveBtn) {
    saveBtn.style.display = canWrite ? 'block' : 'none';
  }

  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    card.classList.remove('opacity-0', 'scale-95');
    card.classList.add('opacity-100', 'scale-100');
  }, 10);
};

export const closeSaleModal = () => {
  const overlay = document.getElementById('sale-modal-overlay');
  const card = document.getElementById('sale-modal-card');

  if (!overlay || !card) return;

  card.classList.remove('opacity-100', 'scale-100');
  card.classList.add('opacity-0', 'scale-95');
  overlay.classList.add('opacity-0');

  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 300);
};

export const saveSale = async (e) => {
  e.preventDefault();
  
  const canWrite = window.hasPermission('view-sales', 'escribir') || window.hasPermission('view-ventas', 'escribir');
  if (!canWrite) {
    showToast('No tienes permiso para guardar cambios.', false);
    return;
  }

  const idInput = document.getElementById('sale-form-id');
  const fechaInput = document.getElementById('sale-form-fecha');
  const nroFacturaInput = document.getElementById('sale-form-nro-factura');
  const modeloSelect = document.getElementById('sale-form-modelo');
  const periodoSelect = document.getElementById('sale-form-periodo');
  const clienteInput = document.getElementById('sale-form-cliente');
  const cantidadInput = document.getElementById('sale-form-cantidad');
  const precioVentaInput = document.getElementById('sale-form-precio-venta');
  const vendedorInput = document.getElementById('sale-form-vendedor');
  const comisionInput = document.getElementById('sale-form-comision');

  const id = idInput?.value ? parseInt(idInput.value, 10) : null;
  const fecha = fechaInput?.value || new Date().toISOString().split('T')[0];
  const nro_factura = nroFacturaInput?.value?.trim() || null;
  const modelo_id = modeloSelect?.value ? parseInt(modeloSelect.value, 10) : null;
  let periodo_id = periodoSelect?.value ? parseInt(periodoSelect.value, 10) : null;
  const cliente = clienteInput?.value?.trim();
  const cantidad = cantidadInput?.value ? parseInt(cantidadInput.value, 10) : 1;
  const precio_venta = precioVentaInput?.value ? parseFloat(precioVentaInput.value) : null;
  const vendedor = vendedorInput?.value?.trim() || null;
  const comision_vendedor = comisionInput?.value ? parseFloat(comisionInput.value) : null;

  if (!periodo_id && fecha) {
    periodo_id = findPeriodForDate(fecha);
  }

  if (!modelo_id) {
    showToast('Debe seleccionar un modelo.', false);
    return;
  }

  if (!periodo_id) {
    showToast('No se encontró un período para la fecha indicada. Por favor seleccione o cree el período correspondiente.', false);
    return;
  }

  if (!cliente) {
    showToast('El nombre del cliente es obligatorio.', false);
    return;
  }

  const payload = {
    fecha,
    nro_factura,
    modelo_id,
    periodo_id,
    cliente,
    cantidad,
    precio_venta,
    vendedor,
    comision_vendedor
  };

  const saveBtn = document.getElementById('btn-save-sale');
  const originalBtnHtml = saveBtn?.innerHTML;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg> Guardando...
    `;
  }

  try {
    let url = `${supabaseUrl}ventas`;
    let method = 'POST';
    const headers = getHeaders();
    headers['Prefer'] = 'return=representation';

    if (id) {
      url += `?id=eq.${id}`;
      method = 'PATCH';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Error HTTP ${res.status}`);
    }

    showToast(id ? 'Venta actualizada exitosamente.' : 'Venta registrada exitosamente.', true);
    closeSaleModal();
    loadSales();
  } catch (err) {
    console.error("Error al guardar venta:", err);
    showToast(`Error al guardar: ${err.message}`, false);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHtml;
    }
  }
};

export const editSale = (id) => {
  const sale = salesList.find(s => s.id === id);
  if (sale) {
    openSaleModal(sale);
  } else {
    fetch(`${supabaseUrl}ventas?id=eq.${id}`, {
      headers: getHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) openSaleModal(data[0]);
      })
      .catch(e => {
        console.error("Error cargando venta:", e);
        showToast("No se pudo cargar la venta seleccionada.", false);
      });
  }
};

export const deleteSale = (id) => {
  const canWrite = window.hasPermission('view-sales', 'escribir') || window.hasPermission('view-ventas', 'escribir');
  if (!canWrite) {
    showToast('No tienes permiso para eliminar registros.', false);
    return;
  }
  openDeleteModal(id, 'sale');
};

// ─── DESCARGAR PLANTILLA CSV ──────────────────────────────────────────────────
export const downloadSalesCsvTemplate = async () => {
  if (modelosList.length === 0) await loadModelosCatalog();
  if (periodosList.length === 0) await loadPeriodosCatalog();

  const headers = [
    'fecha',
    'nro_factura',
    'modelo',
    'linea',
    'familia',
    'periodo',
    'cliente',
    'cantidad',
    'precio_venta',
    'vendedor',
    'comision_vendedor'
  ];

  // Provide realistic example models
  const exModel1 = modelosList[0]?.modelo || 'ARENA SPORT MT';
  const exModel2 = modelosList[1]?.modelo || 'ARENA SPORT AT';
  const exPer = periodosList[0]?.periodo || 'feb-2026';

  const rows = [
    headers.join(';'),
    `2026-02-15;FAC-001024;${exModel1};CHERY;TIGGO;${exPer};Inversiones Los Andes, C.A.;1;22900.00;Carlos Pérez;150.00`,
    `2026-02-20;FAC-001025;${exModel2};CHERY;TIGGO;${exPer};Distribuidora Central S.A.;2;24500.00;María González;300.00`,
    `2026-02-22;FAC-001026;${exModel1};CHERY;TIGGO;;Constructora Horizonte;1;22900.00;Roberto Silva;150.00`
  ];

  // UTF-8 BOM so Excel opens with proper accents and structure
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `plantilla_migracion_ventas_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Plantilla CSV descargada exitosamente.", true);
};

// ─── IMPORTACIÓN CSV Y PARSER ────────────────────────────────────────────────
export const openSalesImportModal = async () => {
  const overlay = document.getElementById('sales-import-modal-overlay');
  const card = document.getElementById('sales-import-modal-card');
  const fileInput = document.getElementById('sales-csv-file-input');
  const previewSection = document.getElementById('sales-import-preview-section');
  const summaryEl = document.getElementById('sales-import-summary');
  const processBtn = document.getElementById('btn-process-sales-import');

  if (!overlay || !card) return;

  parsedImportRows = [];
  if (fileInput) fileInput.value = '';
  if (previewSection) previewSection.classList.add('hidden');
  if (summaryEl) summaryEl.classList.add('hidden');
  if (processBtn) processBtn.disabled = true;

  // Pre-load catalogs for extended relation resolution
  await Promise.all([
    loadModelosCatalog(),
    loadPeriodosCatalog(),
    loadLineasCatalog(),
    loadFamiliasCatalog()
  ]);

  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    card.classList.remove('opacity-0', 'scale-95');
    card.classList.add('opacity-100', 'scale-100');
  }, 10);
};

export const closeSalesImportModal = () => {
  const overlay = document.getElementById('sales-import-modal-overlay');
  const card = document.getElementById('sales-import-modal-card');

  if (!overlay || !card) return;

  card.classList.remove('opacity-100', 'scale-100');
  card.classList.add('opacity-0', 'scale-95');
  overlay.classList.add('opacity-0');

  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 300);
};

// Helper: robust CSV string parser
const parseCsvText = (text) => {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentToken = '';

  // Determine delimiter: detect semicolon, comma or tab from header
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  let delimiter = ';';
  if ((firstLine.match(/;/g) || []).length < (firstLine.match(/,/g) || []).length) {
    delimiter = ',';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  }

  // Remove BOM if present
  let cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentToken.trim());
      currentToken = '';
      if (row.length > 0 && row.some(cell => cell !== '')) {
        lines.push(row);
      }
      row = [];
    } else {
      currentToken += char;
    }
  }

  if (currentToken || row.length > 0) {
    row.push(currentToken.trim());
    if (row.some(cell => cell !== '')) {
      lines.push(row);
    }
  }

  return lines;
};

// Process Selected CSV File
export const handleSalesCsvFile = (file) => {
  if (!file) return;

  const summaryEl = document.getElementById('sales-import-summary');
  const filenameEl = document.getElementById('sales-import-filename');
  const filesizeEl = document.getElementById('sales-import-filesize');
  const previewSection = document.getElementById('sales-import-preview-section');
  const previewBody = document.getElementById('sales-import-preview-body');
  const validCountEl = document.getElementById('sales-import-valid-count');
  const warningCountEl = document.getElementById('sales-import-warning-count');
  const errorCountEl = document.getElementById('sales-import-error-count');
  const processBtn = document.getElementById('btn-process-sales-import');

  if (filenameEl) filenameEl.textContent = file.name;
  if (filesizeEl) filesizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
  if (summaryEl) summaryEl.classList.remove('hidden');

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const rawRows = parseCsvText(content);

    if (rawRows.length < 2) {
      showToast("El archivo CSV no contiene registros válidos.", false);
      return;
    }

    const rawHeaders = rawRows[0].map(h => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));
    
    // Map expected column indexes
    const colIdx = {
      fecha: rawHeaders.findIndex(h => h.includes('fecha') || h === 'date'),
      nro_factura: rawHeaders.findIndex(h => h.includes('factura') || h.includes('invoice') || h.includes('nro')),
      modelo: rawHeaders.findIndex(h => h.includes('modelo') || h.includes('model')),
      linea: rawHeaders.findIndex(h => h.includes('linea') || h.includes('line')),
      familia: rawHeaders.findIndex(h => h.includes('familia') || h.includes('family')),
      periodo: rawHeaders.findIndex(h => h.includes('periodo') || h.includes('period')),
      cliente: rawHeaders.findIndex(h => h.includes('cliente') || h.includes('customer') || h.includes('razon')),
      cantidad: rawHeaders.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('unid')),
      precio_venta: rawHeaders.findIndex(h => h.includes('precio') || h.includes('price') || h.includes('monto')),
      vendedor: rawHeaders.findIndex(h => h.includes('vendedor') || h.includes('seller') || h.includes('asesor')),
      comision: rawHeaders.findIndex(h => h.includes('comision') || h.includes('comm'))
    };

    parsedImportRows = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (r.length === 0 || r.every(c => !c)) continue;

      let fechaRaw = colIdx.fecha !== -1 ? r[colIdx.fecha] : '';
      let nroFactura = colIdx.nro_factura !== -1 ? r[colIdx.nro_factura] : '';
      let modeloRaw = colIdx.modelo !== -1 ? r[colIdx.modelo] : '';
      let lineaRaw = colIdx.linea !== -1 ? r[colIdx.linea] : '';
      let familiaRaw = colIdx.familia !== -1 ? r[colIdx.familia] : '';
      let periodoRaw = colIdx.periodo !== -1 ? r[colIdx.periodo] : '';
      let clienteRaw = colIdx.cliente !== -1 ? r[colIdx.cliente] : '';
      let cantidadRaw = colIdx.cantidad !== -1 ? r[colIdx.cantidad] : '1';
      let precioRaw = colIdx.precio_venta !== -1 ? r[colIdx.precio_venta] : '';
      let vendedorRaw = colIdx.vendedor !== -1 ? r[colIdx.vendedor] : '';
      let comisionRaw = colIdx.comision !== -1 ? r[colIdx.comision] : '';

      // Normalize date (YYYY-MM-DD)
      let parsedFecha = '';
      if (fechaRaw) {
        if (fechaRaw.includes('/')) {
          const parts = fechaRaw.split('/');
          if (parts.length === 3) {
            parsedFecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (fechaRaw.includes('-')) {
          const parts = fechaRaw.split('-');
          if (parts[0].length === 4) {
            parsedFecha = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else if (parts[2].length === 4) {
            parsedFecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }

      if (!parsedFecha) {
        parsedFecha = new Date().toISOString().split('T')[0];
      }

      // Resolve Modelo (Extended Matching)
      let matchedModel = null;
      if (modeloRaw) {
        const cleanMod = modeloRaw.toLowerCase().trim();
        matchedModel = modelosList.find(m => (m.modelo || '').toLowerCase().trim() === cleanMod);
        if (!matchedModel) {
          // Partial match
          matchedModel = modelosList.find(m => (m.modelo || '').toLowerCase().includes(cleanMod) || cleanMod.includes((m.modelo || '').toLowerCase()));
        }
      }

      // Resolve Periodo (By code or auto by date)
      let matchedPeriodId = null;
      let periodMatchName = '';
      if (periodoRaw) {
        const cleanP = periodoRaw.toLowerCase().trim();
        const foundP = periodosList.find(p => (p.periodo || '').toLowerCase().trim() === cleanP);
        if (foundP) {
          matchedPeriodId = foundP.id;
          periodMatchName = foundP.periodo;
        }
      }

      if (!matchedPeriodId && parsedFecha) {
        matchedPeriodId = findPeriodForDate(parsedFecha);
        if (matchedPeriodId) {
          const pObj = periodosList.find(p => p.id === matchedPeriodId);
          periodMatchName = pObj ? `${pObj.periodo} (Auto)` : `P#${matchedPeriodId}`;
        }
      }

      // Extended Linea & Familia resolution
      let extendedLineaName = lineaRaw || '-';
      let extendedFamiliaName = familiaRaw || '-';
      if (matchedModel) {
        if (matchedModel.linea) {
          const lObj = lineasList.find(l => String(l.id) === String(matchedModel.linea));
          if (lObj) extendedLineaName = lObj.nombre;
        }
        if (matchedModel.familia) {
          const fObj = familiasList.find(f => String(f.id) === String(matchedModel.familia));
          if (fObj) extendedFamiliaName = fObj.nombre;
        }
      }

      // Resolve Price & Commission
      let finalCantidad = parseInt(cantidadRaw, 10) || 1;
      let finalPrecio = parseFloat(precioRaw.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (isNaN(finalPrecio) && matchedModel && matchedModel.precio_sugerido) {
        finalPrecio = parseFloat(matchedModel.precio_sugerido);
      }

      let finalComision = parseFloat(comisionRaw.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (isNaN(finalComision) && matchedModel && matchedModel.comision_vendedor1) {
        finalComision = parseFloat(matchedModel.comision_vendedor1);
      }

      // Determine validation status
      let status = 'valid';
      let statusMsg = 'Listo para migrar';

      if (!matchedModel) {
        status = 'error';
        statusMsg = `Modelo "${modeloRaw || 'vacío'}" no existe en la base de datos.`;
        errorCount++;
      } else if (!matchedPeriodId) {
        status = 'error';
        statusMsg = `No se encontró período para la fecha ${parsedFecha}.`;
        errorCount++;
      } else if (!clienteRaw) {
        status = 'error';
        statusMsg = 'Falta el nombre del cliente.';
        errorCount++;
      } else if (!precioRaw && matchedModel.precio_sugerido) {
        status = 'warning';
        statusMsg = `Precio sugerido auto-asignado: $${matchedModel.precio_sugerido}`;
        warningCount++;
      } else {
        validCount++;
      }

      parsedImportRows.push({
        rowNum: i,
        status,
        statusMsg,
        fecha: parsedFecha,
        nro_factura: nroFactura || null,
        modelo_id: matchedModel ? matchedModel.id : null,
        modelo_nombre: matchedModel ? matchedModel.modelo : modeloRaw,
        linea_nombre: extendedLineaName,
        familia_nombre: extendedFamiliaName,
        periodo_id: matchedPeriodId,
        periodo_nombre: periodMatchName || periodoRaw || '-',
        cliente: clienteRaw,
        cantidad: finalCantidad,
        precio_venta: !isNaN(finalPrecio) ? finalPrecio : null,
        vendedor: vendedorRaw || null,
        comision_vendedor: !isNaN(finalComision) ? finalComision : null
      });
    }

    if (validCountEl) validCountEl.textContent = `${validCount} Válidas`;
    if (warningCountEl) warningCountEl.textContent = `${warningCount} Con Sugerencias`;
    if (errorCountEl) errorCountEl.textContent = `${errorCount} Errores`;

    // Render Preview Table
    if (previewBody) {
      previewBody.innerHTML = '';
      parsedImportRows.slice(0, 100).forEach(r => {
        let badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
        let icon = '✓';
        if (r.status === 'warning') {
          badgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
          icon = '⚠';
        } else if (r.status === 'error') {
          badgeColor = 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300';
          icon = '✕';
        }

        previewBody.innerHTML += `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
            <td class="px-3 py-2">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${badgeColor}" title="${escapeHtml(r.statusMsg)}">
                <span>${icon}</span> ${r.status}
              </span>
            </td>
            <td class="px-3 py-2 font-mono text-[11px]">${r.fecha}</td>
            <td class="px-3 py-2 font-mono text-[11px]">${escapeHtml(r.nro_factura || '-')}</td>
            <td class="px-3 py-2">
              <div class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(r.modelo_nombre || '-')}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(r.linea_nombre)} / ${escapeHtml(r.familia_nombre)}</div>
            </td>
            <td class="px-3 py-2">
              <span class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 text-[10px] font-medium">
                ${escapeHtml(r.periodo_nombre)}
              </span>
            </td>
            <td class="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">${escapeHtml(r.cliente || '-')}</td>
            <td class="px-3 py-2 text-center font-bold">${r.cantidad}</td>
            <td class="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(r.precio_venta)}</td>
            <td class="px-3 py-2 text-slate-700 dark:text-slate-300">${escapeHtml(r.vendedor || '-')}</td>
            <td class="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">${formatCurrency(r.comision_vendedor)}</td>
          </tr>
        `;
      });

      if (parsedImportRows.length > 100) {
        previewBody.innerHTML += `
          <tr>
            <td colspan="10" class="px-3 py-2 text-center text-slate-400 italic">
              Mostrando los primeros 100 registros de ${parsedImportRows.length}...
            </td>
          </tr>
        `;
      }
    }

    if (previewSection) previewSection.classList.remove('hidden');

    const totalImportable = parsedImportRows.filter(r => r.status !== 'error').length;
    if (processBtn) {
      processBtn.disabled = totalImportable === 0;
      processBtn.querySelector('span').textContent = `Procesar e Importar (${totalImportable} registros)`;
    }
  };

  reader.readAsText(file, 'UTF-8');
};

// Execute Batch Import into Supabase
export const processSalesImport = async () => {
  const canWrite = window.hasPermission('view-sales', 'escribir') || window.hasPermission('view-ventas', 'escribir');
  if (!canWrite) {
    showToast("No tienes permiso para importar o guardar ventas.", false);
    return;
  }

  const validRows = parsedImportRows.filter(r => r.status !== 'error');
  if (validRows.length === 0) {
    showToast("No hay registros válidos para importar.", false);
    return;
  }

  const processBtn = document.getElementById('btn-process-sales-import');
  const progressContainer = document.getElementById('sales-import-progress-container');
  const progressBar = document.getElementById('sales-import-progress-bar');
  const progressPct = document.getElementById('sales-import-progress-pct');

  if (processBtn) processBtn.disabled = true;
  if (progressContainer) progressContainer.classList.remove('hidden');

  const payloads = validRows.map(r => ({
    fecha: r.fecha,
    nro_factura: r.nro_factura,
    modelo_id: r.modelo_id,
    periodo_id: r.periodo_id,
    cliente: r.cliente,
    cantidad: r.cantidad,
    precio_venta: r.precio_venta,
    vendedor: r.vendedor,
    comision_vendedor: r.comision_vendedor
  }));

  const chunkSize = 50;
  let insertedCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize);
      
      const res = await fetch(`${supabaseUrl}ventas`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(chunk)
      });

      if (!res.ok) {
        failCount += chunk.length;
        console.error(`Error importando lote ${i}:`, await res.text());
      } else {
        insertedCount += chunk.length;
      }

      const pct = Math.round((Math.min(i + chunkSize, payloads.length) / payloads.length) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPct) progressPct.textContent = `${pct}%`;
    }

    if (insertedCount > 0) {
      showToast(`¡Éxito! Se migraron ${insertedCount} ventas a la base de datos.${failCount > 0 ? ` (${failCount} fallaron)` : ''}`, true);
      closeSalesImportModal();
      loadSales();
    } else {
      showToast("Hubo un error al intentar migrar los registros.", false);
    }
  } catch (err) {
    console.error("Error en importación masiva de ventas:", err);
    showToast(`Error al migrar: ${err.message}`, false);
  } finally {
    if (processBtn) processBtn.disabled = false;
  }
};

export const initSalesModule = () => {
  const addBtn = document.getElementById('btn-add-sale');
  const closeBtn = document.getElementById('btn-close-sale-modal');
  const cancelBtn = document.getElementById('btn-cancel-sale');
  const overlay = document.getElementById('sale-modal-overlay');
  const form = document.getElementById('sale-form');
  const searchInput = document.getElementById('sales-search');
  const fechaInput = document.getElementById('sale-form-fecha');
  const modeloSelect = document.getElementById('sale-form-modelo');
  const precioVentaInput = document.getElementById('sale-form-precio-venta');
  const comisionInput = document.getElementById('sale-form-comision');
  const btnPrev = document.getElementById('sales-btn-prev');
  const btnNext = document.getElementById('sales-btn-next');

  // CSV Import/Export Buttons & Modal Elements
  const downloadTemplateBtn = document.getElementById('btn-download-sales-template');
  const openImportBtn = document.getElementById('btn-import-sales-csv');
  const closeImportBtn = document.getElementById('btn-close-sales-import-modal');
  const cancelImportBtn = document.getElementById('btn-cancel-sales-import');
  const importOverlay = document.getElementById('sales-import-modal-overlay');
  const dropzone = document.getElementById('sales-dropzone');
  const fileInput = document.getElementById('sales-csv-file-input');
  const processImportBtn = document.getElementById('btn-process-sales-import');

  if (downloadTemplateBtn) downloadTemplateBtn.addEventListener('click', downloadSalesCsvTemplate);
  if (openImportBtn) openImportBtn.addEventListener('click', openSalesImportModal);
  if (closeImportBtn) closeImportBtn.addEventListener('click', closeSalesImportModal);
  if (cancelImportBtn) cancelImportBtn.addEventListener('click', closeSalesImportModal);

  if (importOverlay) {
    importOverlay.addEventListener('click', (e) => {
      if (e.target === importOverlay) closeSalesImportModal();
    });
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSalesCsvFile(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-brand', 'bg-brand/5');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-brand', 'bg-brand/5');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-brand', 'bg-brand/5');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSalesCsvFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (processImportBtn) {
    processImportBtn.addEventListener('click', processSalesImport);
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!window.hasPermission('view-sales', 'escribir') && !window.hasPermission('view-ventas', 'escribir')) {
        showToast('No tienes permiso para registrar ventas.', false);
        return;
      }
      openSaleModal();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeSaleModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeSaleModal);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSaleModal();
    });
  }

  if (form) {
    form.addEventListener('submit', saveSale);
  }

  // Auto-detect and select Period whenever the date changes
  if (fechaInput) {
    ['input', 'change', 'blur'].forEach(evtType => {
      fechaInput.addEventListener(evtType, () => {
        autoSelectPeriodFromDate();
      });
    });
  }

  // Auto-fill suggested price and commission when a model is selected
  if (modeloSelect) {
    modeloSelect.addEventListener('change', () => {
      const modId = modeloSelect.value;
      if (modId) {
        const found = modelosList.find(m => String(m.id) === String(modId));
        if (found) {
          if (precioVentaInput && (precioVentaInput.value === '' || precioVentaInput.value === '0')) {
            if (found.precio_sugerido) {
              precioVentaInput.value = found.precio_sugerido;
            }
          }
          if (comisionInput && (comisionInput.value === '' || comisionInput.value === '0')) {
            if (found.comision_vendedor1) {
              comisionInput.value = found.comision_vendedor1;
            }
          }
        }
      }
    });
  }

  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        salesSearchQuery = e.target.value.trim();
        salesPage = 1;
        loadSales();
      }, 350);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (salesPage > 1) {
        salesPage--;
        loadSales();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(salesTotalCount / salesPageSize);
      if (salesPage < totalPages) {
        salesPage++;
        loadSales();
      }
    });
  }

  // Expose global functions for onclick handlers
  window.editSale = editSale;
  window.deleteSale = deleteSale;
};
