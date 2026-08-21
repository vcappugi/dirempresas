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
let productosList = [];
let modalidadesList = [];
let sucursalesList = [];
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

// Fetch and cache Productos catalog
export const loadProductosCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}producto?order=nombre.asc`, { method: 'GET', headers: getHeaders() });
    if (res.ok) productosList = await res.json();
  } catch (e) {
    console.warn("Error cargando catálogo de productos:", e);
  }
};

// Fetch and cache Modalidad de Venta catalog
export const loadModalidadesCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}modalidad_venta?order=nombre.asc`, { method: 'GET', headers: getHeaders() });
    if (res.ok) modalidadesList = await res.json();
  } catch (e) {
    console.warn("Error cargando catálogo de modalidades de venta:", e);
  }
};

// Fetch and cache Sucursales catalog
export const loadSucursalesCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}sucursales?order=nombre.asc`, { method: 'GET', headers: getHeaders() });
    if (res.ok) sucursalesList = await res.json();
  } catch (e) {
    console.warn("Error cargando catálogo de sucursales:", e);
  }
};

// Fetch and cache Modelos catalog (Ensure fetching ALL models up to 1000)
export const loadModelosCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}modelos?order=modelo.asc&limit=1000`, {
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

// Populate Periodos, Modalidad and Sucursal selects in modal form
export const populateSaleSelects = async (selectedPeriodoId = null, selectedModalidadId = null, selectedSucursalId = null) => {
  const periodoSelect = document.getElementById('sale-form-periodo');
  const modalidadSelect = document.getElementById('sale-form-modalidad-venta');
  const sucursalSelect = document.getElementById('sale-form-sucursal');

  if (periodosList.length === 0) await loadPeriodosCatalog();
  if (modalidadesList.length === 0) await loadModalidadesCatalog();
  if (sucursalesList.length === 0) await loadSucursalesCatalog();

  if (periodoSelect) {
    periodoSelect.innerHTML = '<option value="">-- Seleccionar Período --</option>';
    periodosList.forEach(p => {
      const isSel = (selectedPeriodoId && String(selectedPeriodoId) === String(p.id)) ? 'selected' : '';
      periodoSelect.innerHTML += `<option value="${p.id}" ${isSel}>${escapeHtml(p.periodo || `P#${p.id}`)}</option>`;
    });
  }

  if (modalidadSelect) {
    modalidadSelect.innerHTML = '<option value="">-- Seleccionar Modalidad --</option>';
    modalidadesList.forEach(m => {
      const isSel = (selectedModalidadId && String(selectedModalidadId) === String(m.id)) ? 'selected' : '';
      modalidadSelect.innerHTML += `<option value="${m.id}" ${isSel}>${escapeHtml(m.nombre || `Mod#${m.id}`)}</option>`;
    });
  }

  if (sucursalSelect) {
    sucursalSelect.innerHTML = '<option value="">-- Seleccionar Sucursal --</option>';
    sucursalesList.forEach(s => {
      const isSel = (selectedSucursalId && String(selectedSucursalId) === String(s.id)) ? 'selected' : '';
      sucursalSelect.innerHTML += `<option value="${s.id}" ${isSel}>${escapeHtml(s.nombre || `Sucursal #${s.id}`)}</option>`;
    });
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

// ─── MODEL PICKER MODAL & SELECTION ──────────────────────────────────────────
export const openModelPickerModal = async () => {
  const overlay = document.getElementById('model-picker-modal-overlay');
  const card = document.getElementById('model-picker-modal-card');
  const searchInput = document.getElementById('model-picker-search-input');
  const productFilter = document.getElementById('model-picker-product-filter');

  if (!overlay || !card) return;

  await Promise.all([
    loadModelosCatalog(),
    loadProductosCatalog(),
    loadLineasCatalog(),
    loadFamiliasCatalog()
  ]);

  if (productFilter) {
    productFilter.innerHTML = '<option value="">Todos los Productos</option>';
    productosList.forEach(pr => {
      productFilter.innerHTML += `<option value="${pr.id}">${escapeHtml(pr.nombre || 'Producto #' + pr.id)}</option>`;
    });
  }

  if (searchInput) searchInput.value = '';
  renderModelPickerList();

  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    card.classList.remove('opacity-0', 'scale-95');
    card.classList.add('opacity-100', 'scale-100');
    searchInput?.focus();
  }, 10);
};

export const closeModelPickerModal = () => {
  const overlay = document.getElementById('model-picker-modal-overlay');
  const card = document.getElementById('model-picker-modal-card');

  if (!overlay || !card) return;

  card.classList.remove('opacity-100', 'scale-100');
  card.classList.add('opacity-0', 'scale-95');
  overlay.classList.add('opacity-0');

  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 300);
};

export const renderModelPickerList = () => {
  const searchInput = document.getElementById('model-picker-search-input');
  const productFilter = document.getElementById('model-picker-product-filter');
  const tableBody = document.getElementById('model-picker-table-body');
  const emptyEl = document.getElementById('model-picker-empty');
  const statsEl = document.getElementById('model-picker-stats');

  if (!tableBody) return;

  const q = (searchInput?.value || '').toLowerCase().trim();
  const selectedProd = productFilter?.value || '';

  const filtered = modelosList.filter(m => {
    if (selectedProd && String(m.producto_id) !== String(selectedProd)) return false;

    if (q) {
      const idMatch = String(m.id).includes(q) || `#${m.id}`.includes(q);
      const nameMatch = (m.modelo || '').toLowerCase().includes(q);
      
      const prodObj = productosList.find(p => String(p.id) === String(m.producto_id));
      const prodMatch = prodObj && (prodObj.nombre || '').toLowerCase().includes(q);

      const lineaObj = lineasList.find(l => String(l.id) === String(m.linea));
      const lineaMatch = lineaObj && (lineaObj.nombre || '').toLowerCase().includes(q);

      const famObj = familiasList.find(f => String(f.id) === String(m.familia));
      const famMatch = famObj && (famObj.nombre || '').toLowerCase().includes(q);

      return idMatch || nameMatch || prodMatch || lineaMatch || famMatch;
    }
    return true;
  });

  tableBody.innerHTML = '';

  if (statsEl) {
    statsEl.textContent = `Mostrando ${filtered.length} de ${modelosList.length} modelos`;
  }

  if (filtered.length === 0) {
    emptyEl?.classList.remove('hidden');
  } else {
    emptyEl?.classList.add('hidden');
    filtered.forEach(m => {
      const prodObj = productosList.find(p => String(p.id) === String(m.producto_id));
      const prodName = prodObj ? prodObj.nombre : '-';

      const lineaObj = lineasList.find(l => String(l.id) === String(m.linea));
      const lineaName = lineaObj ? lineaObj.nombre : '-';

      const famObj = familiasList.find(f => String(f.id) === String(m.familia));
      const famName = famObj ? famObj.nombre : '-';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors cursor-pointer group';
      tr.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON') selectModelForSale(m.id);
      };

      tr.innerHTML = `
        <td class="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">#${m.id}</td>
        <td class="px-4 py-2.5 font-bold text-slate-900 dark:text-white group-hover:text-brand transition-colors">
          ${escapeHtml(m.modelo || '-')}
        </td>
        <td class="px-4 py-2.5">
          ${m.producto_id ? `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              ${escapeHtml(prodName)}
            </span>
          ` : '<span class="text-slate-400">-</span>'}
        </td>
        <td class="px-4 py-2.5 text-slate-600 dark:text-slate-400">
          ${escapeHtml(lineaName)} ${famName !== '-' ? `/ ${escapeHtml(famName)}` : ''}
        </td>
        <td class="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
          ${formatCurrency(m.precio_sugerido)}
        </td>
        <td class="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
          ${formatCurrency(m.comision_vendedor1)}
        </td>
        <td class="px-4 py-2.5 text-center">
          <button type="button" onclick="selectModelForSale(${m.id})" class="px-3 py-1 text-xs font-semibold text-white bg-brand hover:bg-brand-light rounded-lg shadow-sm transition-all duration-200">
            Seleccionar
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }
};

export const selectModelForSale = (modelId) => {
  const model = modelosList.find(m => m.id === modelId);
  if (!model) return;

  const hiddenInput = document.getElementById('sale-form-modelo');
  const badgeEl = document.getElementById('sale-form-model-id-badge');
  const nameEl = document.getElementById('sale-form-model-name-display');
  const detailsEl = document.getElementById('sale-form-model-details-display');
  const precioInput = document.getElementById('sale-form-precio-venta');
  const comisionInput = document.getElementById('sale-form-comision');
  const comision2Input = document.getElementById('sale-form-comision2');

  if (hiddenInput) hiddenInput.value = model.id;
  if (badgeEl) badgeEl.textContent = `#${model.id}`;
  if (nameEl) nameEl.textContent = model.modelo || `Modelo #${model.id}`;

  const prodObj = productosList.find(p => String(p.id) === String(model.producto_id));
  const lineaObj = lineasList.find(l => String(l.id) === String(model.linea));
  
  let detailsText = prodObj ? `Producto: ${prodObj.nombre}` : '';
  if (lineaObj) detailsText += ` | Línea: ${lineaObj.nombre}`;
  if (model.precio_sugerido) detailsText += ` | Sugerido: $${model.precio_sugerido}`;
  if (detailsEl) detailsEl.textContent = detailsText || 'Modelo seleccionado';

  // Auto-fill price and commissions if currently empty or 0
  if (precioInput && (!precioInput.value || precioInput.value === '0')) {
    if (model.precio_sugerido) precioInput.value = model.precio_sugerido;
  }
  if (comisionInput && (!comisionInput.value || comisionInput.value === '0')) {
    if (model.comision_vendedor1) comisionInput.value = model.comision_vendedor1;
  }
  if (comision2Input && (!comision2Input.value || comision2Input.value === '0')) {
    if (model.comision_vendedor2) comision2Input.value = model.comision_vendedor2;
  }

  closeModelPickerModal();
};

export const updateSelectedModelDisplay = (modelId) => {
  const hiddenInput = document.getElementById('sale-form-modelo');
  const badgeEl = document.getElementById('sale-form-model-id-badge');
  const nameEl = document.getElementById('sale-form-model-name-display');
  const detailsEl = document.getElementById('sale-form-model-details-display');

  if (!modelId) {
    if (hiddenInput) hiddenInput.value = '';
    if (badgeEl) badgeEl.textContent = '#--';
    if (nameEl) nameEl.textContent = 'Haga clic para buscar modelo...';
    if (detailsEl) detailsEl.textContent = 'Búsqueda por código, nombre o producto';
    return;
  }

  const model = modelosList.find(m => String(m.id) === String(modelId));
  if (hiddenInput) hiddenInput.value = modelId;

  if (model) {
    if (badgeEl) badgeEl.textContent = `#${model.id}`;
    if (nameEl) nameEl.textContent = model.modelo || `Modelo #${model.id}`;

    const prodObj = productosList.find(p => String(p.id) === String(model.producto_id));
    const lineaObj = lineasList.find(l => String(l.id) === String(model.linea));
    
    let detailsText = prodObj ? `Producto: ${prodObj.nombre}` : '';
    if (lineaObj) detailsText += ` | Línea: ${lineaObj.nombre}`;
    if (model.precio_sugerido) detailsText += ` | Sugerido: $${model.precio_sugerido}`;
    if (detailsEl) detailsEl.textContent = detailsText || 'Modelo seleccionado';
  } else {
    if (badgeEl) badgeEl.textContent = `#${modelId}`;
    if (nameEl) nameEl.textContent = `Modelo #${modelId}`;
    if (detailsEl) detailsEl.textContent = 'Modelo cargado';
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
  if (productosList.length === 0) await loadProductosCatalog();
  if (sucursalesList.length === 0) await loadSucursalesCatalog();

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

        // Find modelo, periodo and sucursal names
        const modObj = modelosList.find(m => String(m.id) === String(s.modelo_id));
        const modeloName = modObj ? modObj.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : '-');

        const perObj = periodosList.find(p => String(p.id) === String(s.periodo_id));
        const periodoName = perObj ? perObj.periodo : (s.periodo_id ? `Período #${s.periodo_id}` : '-');

        const sucObj = sucursalesList.find(suc => String(suc.id) === String(s.sucursal_id));
        const sucursalName = sucObj ? sucObj.nombre : (s.sucursal_id ? `Sucursal #${s.sucursal_id}` : '-');

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
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              ${escapeHtml(sucursalName)}
            </span>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">${escapeHtml(s.cliente || '-')}</td>
          <td class="px-4 py-3 text-center">
            <span class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              ${s.cantidad ?? 1}
            </span>
          </td>
          <td class="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">${formatCurrency(s.precio_venta)}</td>
          <td class="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300 font-mono">${formatCurrency(s.costo_fob)}</td>
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
  const costoFobInput = document.getElementById('sale-form-costo-fob');
  const clienteInput = document.getElementById('sale-form-cliente');
  const cantidadInput = document.getElementById('sale-form-cantidad');
  const vendedorInput = document.getElementById('sale-form-vendedor');
  const comisionInput = document.getElementById('sale-form-comision');
  const comision2Input = document.getElementById('sale-form-comision2');
  const revisionInput = document.getElementById('sale-form-revision');
  const observacionInput = document.getElementById('sale-form-observacion');

  await Promise.all([
    loadModelosCatalog(),
    loadProductosCatalog(),
    loadLineasCatalog(),
    loadPeriodosCatalog(),
    loadModalidadesCatalog()
  ]);

  if (sale) {
    title.textContent = canWrite ? 'Editar Venta' : 'Detalles de la Venta';
    if (idInput) idInput.value = sale.id;
    if (fechaInput) fechaInput.value = sale.fecha || '';
    if (nroFacturaInput) nroFacturaInput.value = sale.nro_factura || '';
    if (precioVentaInput) precioVentaInput.value = sale.precio_venta ?? '';
    if (costoFobInput) costoFobInput.value = sale.costo_fob ?? '';
    if (clienteInput) clienteInput.value = sale.cliente || '';
    if (cantidadInput) cantidadInput.value = sale.cantidad ?? 1;
    if (vendedorInput) vendedorInput.value = sale.vendedor || '';
    if (comisionInput) comisionInput.value = sale.comision_vendedor ?? '';
    if (comision2Input) comision2Input.value = sale.comision_vendedro2 ?? '';
    if (revisionInput) revisionInput.value = sale.revision || '';
    if (observacionInput) observacionInput.value = sale.observcion || '';

    updateSelectedModelDisplay(sale.modelo_id);
    await populateSaleSelects(sale.periodo_id, sale.modalidad_ventas_id, sale.sucursal_id);
  } else {
    title.textContent = 'Registrar Venta';
    if (idInput) idInput.value = '';
    if (nroFacturaInput) nroFacturaInput.value = '';
    if (precioVentaInput) precioVentaInput.value = '';
    if (costoFobInput) costoFobInput.value = '';
    const today = new Date().toISOString().split('T')[0];
    if (fechaInput) fechaInput.value = today;
    if (cantidadInput) cantidadInput.value = 1;
    if (clienteInput) clienteInput.value = '';
    if (vendedorInput) vendedorInput.value = '';
    if (comisionInput) comisionInput.value = '';
    if (comision2Input) comision2Input.value = '';
    if (revisionInput) revisionInput.value = '';
    if (observacionInput) observacionInput.value = '';

    updateSelectedModelDisplay(null);
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
  const modeloHiddenInput = document.getElementById('sale-form-modelo');
  const periodoSelect = document.getElementById('sale-form-periodo');
  const modalidadSelect = document.getElementById('sale-form-modalidad-venta');
  const sucursalSelect = document.getElementById('sale-form-sucursal');
  const clienteInput = document.getElementById('sale-form-cliente');
  const cantidadInput = document.getElementById('sale-form-cantidad');
  const precioVentaInput = document.getElementById('sale-form-precio-venta');
  const costoFobInput = document.getElementById('sale-form-costo-fob');
  const vendedorInput = document.getElementById('sale-form-vendedor');
  const comisionInput = document.getElementById('sale-form-comision');
  const comision2Input = document.getElementById('sale-form-comision2');
  const revisionInput = document.getElementById('sale-form-revision');
  const observacionInput = document.getElementById('sale-form-observacion');

  const id = idInput?.value ? parseInt(idInput.value, 10) : null;
  const fecha = fechaInput?.value || new Date().toISOString().split('T')[0];
  const nro_factura = nroFacturaInput?.value?.trim() || null;
  const modelo_id = modeloHiddenInput?.value ? parseInt(modeloHiddenInput.value, 10) : null;
  let periodo_id = periodoSelect?.value ? parseInt(periodoSelect.value, 10) : null;
  const modalidad_ventas_id = modalidadSelect?.value ? parseInt(modalidadSelect.value, 10) : null;
  const sucursal_id = sucursalSelect?.value ? parseInt(sucursalSelect.value, 10) : null;
  const cliente = clienteInput?.value?.trim();
  const cantidad = cantidadInput?.value ? parseInt(cantidadInput.value, 10) : 1;
  const precio_venta = precioVentaInput?.value ? parseFloat(precioVentaInput.value) : null;
  const costo_fob = costoFobInput?.value ? parseFloat(costoFobInput.value) : null;
  const vendedor = vendedorInput?.value?.trim() || null;
  const comision_vendedor = comisionInput?.value ? parseFloat(comisionInput.value) : null;
  const comision_vendedro2 = comision2Input?.value ? parseFloat(comision2Input.value) : null;
  const revision = revisionInput?.value?.trim() || null;
  const observcion = observacionInput?.value?.trim() || null;

  if (!periodo_id && fecha) {
    periodo_id = findPeriodForDate(fecha);
  }

  if (!modelo_id) {
    showToast('Debe buscar y seleccionar un modelo.', false);
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
    modalidad_ventas_id,
    sucursal_id,
    cliente,
    cantidad,
    precio_venta,
    costo_fob,
    vendedor,
    comision_vendedor,
    comision_vendedro2,
    revision,
    observcion
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
  if (modalidadesList.length === 0) await loadModalidadesCatalog();
  if (sucursalesList.length === 0) await loadSucursalesCatalog();

  const headers = [
    'fecha',
    'nro_factura',
    'modelo',
    'linea',
    'familia',
    'periodo',
    'sucursal',
    'modalidad_venta',
    'cliente',
    'cantidad',
    'precio_venta',
    'costo_fob',
    'vendedor',
    'comision_vendedor1',
    'comision_vendedor2',
    'revision',
    'observaciones'
  ];

  const exModel1 = modelosList[0]?.modelo || 'ARENA SPORT MT';
  const exModel2 = modelosList[1]?.modelo || 'ARENA SPORT AT';
  const exPer = periodosList[0]?.periodo || 'feb-2026';
  const exSuc1 = sucursalesList[0]?.nombre || 'JAC PORTUGUESA';
  const exSuc2 = sucursalesList[1]?.nombre || 'JAC EL TIGRE';
  const exMod1 = modalidadesList[0]?.nombre || 'Compra Directa';
  const exMod2 = modalidadesList[1]?.nombre || 'Compra Directa Crédito';

  const rows = [
    headers.join(';'),
    `2026-02-15;FAC-001024;${exModel1};CHERY;TIGGO;${exPer};${exSuc1};${exMod1};Inversiones Los Andes, C.A.;1;22900.00;18500.00;Carlos Pérez;150.00;50.00;Aprobado;Venta corporativa inicial`,
    `2026-02-20;FAC-001025;${exModel2};CHERY;TIGGO;${exPer};${exSuc2};${exMod2};Distribuidora Central S.A.;2;24500.00;19800.00;María González;300.00;100.00;Auditado;Entrega inmediata aprobada`,
    `2026-02-22;FAC-001026;${exModel1};CHERY;TIGGO;;${exSuc1};${exMod1};Constructora Horizonte;1;22900.00;18500.00;Roberto Silva;150.00;0.00;Pendiente;Validación de crédito`
  ];

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
  showToast("Plantilla CSV actualizada descargada exitosamente.", true);
};

// ─── EXPORTAR TODA LA DATA A EXCEL (CSV) ──────────────────────────────────────
export const exportAllSalesToExcel = async () => {
  const exportBtn = document.getElementById('btn-export-sales-excel');
  const originalHtml = exportBtn ? exportBtn.innerHTML : '';
  
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-emerald-600 dark:text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Exportando...</span>
    `;
  }

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();
    const h = getHeaders();

    // Ensure all lookup catalogs are loaded
    const promises = [];
    if (modelosList.length === 0) promises.push(loadModelosCatalog());
    if (periodosList.length === 0) promises.push(loadPeriodosCatalog());
    if (productosList.length === 0) promises.push(loadProductosCatalog());
    if (lineasList.length === 0) promises.push(loadLineasCatalog());
    if (familiasList.length === 0) promises.push(loadFamiliasCatalog());
    if (modalidadesList.length === 0) promises.push(loadModalidadesCatalog());
    if (sucursalesList.length === 0) promises.push(loadSucursalesCatalog());
    if (promises.length > 0) await Promise.all(promises);

    // Fetch ALL sales records without pagination limits
    const res = await fetch(`${supabaseUrl}ventas?order=fecha.desc,id.desc&limit=10000`, {
      method: 'GET',
      headers: h
    });

    if (!res.ok) throw new Error("Error al obtener el historial de ventas desde la base de datos.");
    const allSalesData = await res.json();

    if (!allSalesData || allSalesData.length === 0) {
      showToast("No hay registros de ventas para exportar.", false);
      return;
    }

    const headers = [
      'ID Venta',
      'Fecha',
      'Nro. Factura',
      'Producto / Servicio',
      'Modelo',
      'Línea',
      'Familia',
      'Período',
      'Sucursal',
      'Modalidad de Venta',
      'Cliente',
      'Cantidad',
      'Precio Venta (USD)',
      'Costo FOB (USD)',
      'Total Venta (USD)',
      'Vendedor',
      'Comisión Vendedor 1 (USD)',
      'Comisión Vendedor 2 (USD)',
      'Revisión',
      'Observaciones',
      'Fecha Creación'
    ];

    const escapeCsvField = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.join(';')];

    allSalesData.forEach(sale => {
      const mod = modelosList.find(m => String(m.id) === String(sale.modelo_id));
      const per = periodosList.find(p => String(p.id) === String(sale.periodo_id));
      const prod = mod ? productosList.find(p => String(p.id) === String(mod.producto_id)) : null;
      const modalidad = modalidadesList.find(m => String(m.id) === String(sale.modalidad_ventas_id));
      const suc = sucursalesList.find(s => String(s.id) === String(sale.sucursal_id));

      const modNombre = mod ? mod.modelo : (sale.modelo_id ? `Modelo #${sale.modelo_id}` : '');
      const prodNombre = prod ? prod.nombre : (mod?.producto_id ? `Producto #${mod.producto_id}` : '');
      const lineaNombre = mod?.linea ? `Línea ${mod.linea}` : '';
      const familiaNombre = mod?.familia ? `Familia ${mod.familia}` : '';
      const perNombre = per ? per.periodo : (sale.periodo_id ? `P#${sale.periodo_id}` : '');
      const sucNombre = suc ? suc.nombre : (sale.sucursal_id ? `Sucursal #${sale.sucursal_id}` : '');
      const modalidadNombre = modalidad ? modalidad.nombre : (sale.modalidad_ventas_id ? `Modalidad #${sale.modalidad_ventas_id}` : '');

      const cant = parseInt(sale.cantidad, 10) || 1;
      const precio = parseFloat(sale.precio_venta) || 0;
      const costoFob = parseFloat(sale.costo_fob) || 0;
      const totalVenta = cant * precio;
      const comision1 = parseFloat(sale.comision_vendedor) || 0;
      const comision2 = parseFloat(sale.comision_vendedro2) || 0;

      const row = [
        escapeCsvField(sale.id),
        escapeCsvField(sale.fecha ? sale.fecha.split('T')[0] : ''),
        escapeCsvField(sale.nro_factura || ''),
        escapeCsvField(prodNombre),
        escapeCsvField(modNombre),
        escapeCsvField(lineaNombre),
        escapeCsvField(familiaNombre),
        escapeCsvField(perNombre),
        escapeCsvField(sucNombre),
        escapeCsvField(modalidadNombre),
        escapeCsvField(sale.cliente || ''),
        escapeCsvField(cant),
        escapeCsvField(precio.toFixed(2)),
        escapeCsvField(sale.costo_fob !== null && sale.costo_fob !== undefined ? costoFob.toFixed(2) : ''),
        escapeCsvField(totalVenta.toFixed(2)),
        escapeCsvField(sale.vendedor || ''),
        escapeCsvField(comision1.toFixed(2)),
        escapeCsvField(comision2.toFixed(2)),
        escapeCsvField(sale.revision || ''),
        escapeCsvField(sale.observcion || ''),
        escapeCsvField(sale.created_at ? sale.created_at.split('T')[0] : '')
      ];

      csvRows.push(row.join(';'));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_ventas_completo_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Se exportaron exitosamente ${allSalesData.length} ventas a Excel.`, true);
  } catch (err) {
    console.error("Error exportando ventas a Excel:", err);
    showToast(err.message || "Error al exportar las ventas a Excel.", false);
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalHtml;
    }
  }
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

  await Promise.all([
    loadModelosCatalog(),
    loadPeriodosCatalog(),
    loadLineasCatalog(),
    loadFamiliasCatalog(),
    loadModalidadesCatalog(),
    loadSucursalesCatalog()
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

  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  let delimiter = ';';
  if ((firstLine.match(/;/g) || []).length < (firstLine.match(/,/g) || []).length) {
    delimiter = ',';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  }

  let cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++;
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
    
    const colIdx = {
      fecha: rawHeaders.findIndex(h => h.includes('fecha') || h === 'date'),
      nro_factura: rawHeaders.findIndex(h => h.includes('factura') || h.includes('invoice') || h.includes('nro')),
      modelo: rawHeaders.findIndex(h => h.includes('modelo') || h.includes('model')),
      linea: rawHeaders.findIndex(h => h.includes('linea') || h.includes('line')),
      familia: rawHeaders.findIndex(h => h.includes('familia') || h.includes('family')),
      periodo: rawHeaders.findIndex(h => h.includes('periodo') || h.includes('period')),
      sucursal: rawHeaders.findIndex(h => h.includes('sucursal') || h.includes('branch')),
      modalidad: rawHeaders.findIndex(h => h.includes('modalidad') || h.includes('mod') || h.includes('tipo_venta') || h.includes('tipoventa')),
      cliente: rawHeaders.findIndex(h => h.includes('cliente') || h.includes('customer') || h.includes('razon')),
      cantidad: rawHeaders.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('unid')),
      precio_venta: rawHeaders.findIndex(h => h.includes('precio') || h.includes('price') || h.includes('monto')),
      costo_fob: rawHeaders.findIndex(h => h.includes('costo_fob') || h.includes('costofob') || h === 'fob' || h.includes('costo')),
      vendedor: rawHeaders.findIndex(h => h.includes('vendedor') || h.includes('seller') || h.includes('asesor')),
      comision1: rawHeaders.findIndex(h => (h.includes('comision') && (h.includes('1') || h.includes('vendedor1') || !h.includes('2'))) || h === 'comision_vendedor'),
      comision2: rawHeaders.findIndex(h => (h.includes('comision') && (h.includes('2') || h.includes('vendedro2') || h.includes('vendedor2')))),
      revision: rawHeaders.findIndex(h => h.includes('revision') || h.includes('revis') || h.includes('control') || h.includes('status')),
      observacion: rawHeaders.findIndex(h => h.includes('observ') || h.includes('nota') || h.includes('comentario'))
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
      let sucursalRaw = colIdx.sucursal !== -1 ? r[colIdx.sucursal] : '';
      let modalidadRaw = colIdx.modalidad !== -1 ? r[colIdx.modalidad] : '';
      let clienteRaw = colIdx.cliente !== -1 ? r[colIdx.cliente] : '';
      let cantidadRaw = colIdx.cantidad !== -1 ? r[colIdx.cantidad] : '1';
      let precioRaw = colIdx.precio_venta !== -1 ? r[colIdx.precio_venta] : '';
      let costoFobRaw = colIdx.costo_fob !== -1 ? r[colIdx.costo_fob] : '';
      let vendedorRaw = colIdx.vendedor !== -1 ? r[colIdx.vendedor] : '';
      let comision1Raw = colIdx.comision1 !== -1 ? r[colIdx.comision1] : '';
      let comision2Raw = colIdx.comision2 !== -1 ? r[colIdx.comision2] : '';
      let revisionRaw = colIdx.revision !== -1 ? r[colIdx.revision] : '';
      let observacionRaw = colIdx.observacion !== -1 ? r[colIdx.observacion] : '';

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

      let matchedModel = null;
      if (modeloRaw) {
        const cleanMod = modeloRaw.toLowerCase().trim();
        matchedModel = modelosList.find(m => (m.modelo || '').toLowerCase().trim() === cleanMod);
        if (!matchedModel) {
          matchedModel = modelosList.find(m => (m.modelo || '').toLowerCase().includes(cleanMod) || cleanMod.includes((m.modelo || '').toLowerCase()));
        }
      }

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

      let matchedModalidadId = null;
      let modalidadMatchName = '-';
      if (modalidadRaw) {
        const cleanMod = modalidadRaw.toLowerCase().trim();
        const foundM = modalidadesList.find(m => (m.nombre || '').toLowerCase().trim() === cleanMod || String(m.id) === cleanMod);
        if (foundM) {
          matchedModalidadId = foundM.id;
          modalidadMatchName = foundM.nombre;
        } else {
          const foundSub = modalidadesList.find(m => (m.nombre || '').toLowerCase().includes(cleanMod) || cleanMod.includes((m.nombre || '').toLowerCase()));
          if (foundSub) {
            matchedModalidadId = foundSub.id;
            modalidadMatchName = foundSub.nombre;
          }
        }
      }

      let matchedSucursalId = null;
      let sucursalMatchName = '-';
      if (sucursalRaw) {
        const cleanSuc = sucursalRaw.toLowerCase().trim();
        const foundS = sucursalesList.find(s => (s.nombre || '').toLowerCase().trim() === cleanSuc || String(s.id) === cleanSuc);
        if (foundS) {
          matchedSucursalId = foundS.id;
          sucursalMatchName = foundS.nombre;
        } else {
          const foundSub = sucursalesList.find(s => (s.nombre || '').toLowerCase().includes(cleanSuc) || cleanSuc.includes((s.nombre || '').toLowerCase()));
          if (foundSub) {
            matchedSucursalId = foundSub.id;
            sucursalMatchName = foundSub.nombre;
          }
        }
      }

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

      let finalCantidad = parseInt(cantidadRaw, 10) || 1;
      let finalPrecio = parseFloat(precioRaw.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (isNaN(finalPrecio) && matchedModel && matchedModel.precio_sugerido) {
        finalPrecio = parseFloat(matchedModel.precio_sugerido);
      }

      let finalCostoFob = parseFloat(costoFobRaw.replace(',', '.').replace(/[^0-9.]/g, ''));

      let finalComision1 = parseFloat(comision1Raw.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (isNaN(finalComision1) && matchedModel && matchedModel.comision_vendedor1) {
        if (matchedModel.regla_comision === '% sobre FOB' && !isNaN(finalCostoFob)) {
          finalComision1 = finalCostoFob * (parseFloat(matchedModel.comision_vendedor1) / 100);
        } else {
          finalComision1 = parseFloat(matchedModel.comision_vendedor1);
        }
      }

      let finalComision2 = parseFloat(comision2Raw.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (isNaN(finalComision2) && matchedModel && matchedModel.comision_vendedor2) {
        finalComision2 = parseFloat(matchedModel.comision_vendedor2);
      }

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
        sucursal_id: matchedSucursalId,
        sucursal_nombre: sucursalMatchName,
        modalidad_ventas_id: matchedModalidadId,
        modalidad_nombre: modalidadMatchName,
        cliente: clienteRaw,
        cantidad: finalCantidad,
        precio_venta: !isNaN(finalPrecio) ? finalPrecio : null,
        costo_fob: !isNaN(finalCostoFob) ? finalCostoFob : null,
        vendedor: vendedorRaw || null,
        comision_vendedor: !isNaN(finalComision1) ? finalComision1 : null,
        comision_vendedro2: !isNaN(finalComision2) ? finalComision2 : null,
        revision: revisionRaw || null,
        observcion: observacionRaw || null
      });
    }

    if (validCountEl) validCountEl.textContent = `${validCount} Válidas`;
    if (warningCountEl) warningCountEl.textContent = `${warningCount} Con Sugerencias`;
    if (errorCountEl) errorCountEl.textContent = `${errorCount} Errores`;

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
            <td class="px-3 py-2">
              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium">
                ${escapeHtml(r.sucursal_nombre)}
              </span>
            </td>
            <td class="px-3 py-2">
              <span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-medium">
                ${escapeHtml(r.modalidad_nombre)}
              </span>
            </td>
            <td class="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">${escapeHtml(r.cliente || '-')}</td>
            <td class="px-3 py-2 text-center font-bold">${r.cantidad}</td>
            <td class="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(r.precio_venta)}</td>
            <td class="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">${formatCurrency(r.costo_fob)}</td>
            <td class="px-3 py-2 text-slate-700 dark:text-slate-300">${escapeHtml(r.vendedor || '-')}</td>
            <td class="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">${formatCurrency(r.comision_vendedor)}</td>
            <td class="px-3 py-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">${formatCurrency(r.comision_vendedro2)}</td>
            <td class="px-3 py-2 text-slate-600 dark:text-slate-400 text-[11px]">${escapeHtml(r.revision || '-')}</td>
            <td class="px-3 py-2 text-slate-500 text-[11px] max-w-[150px] truncate" title="${escapeHtml(r.observcion || '')}">${escapeHtml(r.observcion || '-')}</td>
          </tr>
        `;
      });

      if (parsedImportRows.length > 100) {
        previewBody.innerHTML += `
          <tr>
            <td colspan="16" class="px-3 py-2 text-center text-slate-400 italic">
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
    modalidad_ventas_id: r.modalidad_ventas_id,
    sucursal_id: r.sucursal_id,
    cliente: r.cliente,
    cantidad: r.cantidad,
    precio_venta: r.precio_venta,
    costo_fob: r.costo_fob,
    vendedor: r.vendedor,
    comision_vendedor: r.comision_vendedor,
    comision_vendedro2: r.comision_vendedro2,
    revision: r.revision,
    observcion: r.observcion
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
  const btnPrev = document.getElementById('sales-btn-prev');
  const btnNext = document.getElementById('sales-btn-next');

  // Model Picker Trigger & Modal Elements
  const openModelPickerBtn = document.getElementById('btn-open-model-picker');
  const triggerModelPickerBtn = document.getElementById('btn-trigger-model-picker');
  const modelDisplayCard = document.getElementById('sale-form-model-selected-display');
  const closeModelPickerBtn = document.getElementById('btn-close-model-picker');
  const cancelModelPickerBtn = document.getElementById('btn-cancel-model-picker');
  const modelPickerOverlay = document.getElementById('model-picker-modal-overlay');
  const modelPickerSearchInput = document.getElementById('model-picker-search-input');
  const modelPickerProductFilter = document.getElementById('model-picker-product-filter');

  const openPickerHandler = () => {
    if (!window.hasPermission('view-sales', 'escribir') && !window.hasPermission('view-ventas', 'escribir')) {
      return;
    }
    openModelPickerModal();
  };

  if (openModelPickerBtn) openModelPickerBtn.addEventListener('click', openPickerHandler);
  if (triggerModelPickerBtn) triggerModelPickerBtn.addEventListener('click', openPickerHandler);
  if (modelDisplayCard) modelDisplayCard.addEventListener('click', (e) => {
    if (e.target.id !== 'btn-trigger-model-picker') openPickerHandler();
  });

  if (closeModelPickerBtn) closeModelPickerBtn.addEventListener('click', closeModelPickerModal);
  if (cancelModelPickerBtn) cancelModelPickerBtn.addEventListener('click', closeModelPickerModal);

  if (modelPickerOverlay) {
    modelPickerOverlay.addEventListener('click', (e) => {
      if (e.target === modelPickerOverlay) closeModelPickerModal();
    });
  }

  let pickerSearchTimeout = null;
  if (modelPickerSearchInput) {
    modelPickerSearchInput.addEventListener('input', () => {
      clearTimeout(pickerSearchTimeout);
      pickerSearchTimeout = setTimeout(renderModelPickerList, 250);
    });
  }

  if (modelPickerProductFilter) {
    modelPickerProductFilter.addEventListener('change', renderModelPickerList);
  }

  // CSV Import/Export Buttons & Modal Elements
  const downloadTemplateBtn = document.getElementById('btn-download-sales-template');
  const exportExcelBtn = document.getElementById('btn-export-sales-excel');
  const openImportBtn = document.getElementById('btn-import-sales-csv');
  const closeImportBtn = document.getElementById('btn-close-sales-import-modal');
  const cancelImportBtn = document.getElementById('btn-cancel-sales-import');
  const importOverlay = document.getElementById('sales-import-modal-overlay');
  const dropzone = document.getElementById('sales-dropzone');
  const fileInput = document.getElementById('sales-csv-file-input');
  const processImportBtn = document.getElementById('btn-process-sales-import');

  if (downloadTemplateBtn) downloadTemplateBtn.addEventListener('click', downloadSalesCsvTemplate);
  if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportAllSalesToExcel);
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
  window.selectModelForSale = selectModelForSale;
};
