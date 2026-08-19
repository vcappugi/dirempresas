import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

// ─── State ────────────────────────────────────────────────────────────────────
let vpPage           = 1;
const vpPageSize     = 10;
let vpSearchQuery    = '';
let vpFilterPeriod   = '';
let vpFilterSucursal = '';
let vpFilterProduct  = '';
let vpTotalCount     = 0;
let vpList           = [];

// Lookup caches
let periodsCache    = [];
let sucursalesCache = [];
let productsCache   = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

const periodLabel  = (id) => periodsCache.find(x => x.id === id)?.periodo   || (id ? `#${id}` : '-');
const sucursalLabel= (id) => sucursalesCache.find(x => x.id === id)?.nombre || (id ? `#${id}` : '-');
const productLabel = (id) => productsCache.find(x => x.id === id)?.nombre   || (id ? `#${id}` : '-');

// ─── Populate dropdowns ───────────────────────────────────────────────────────
const loadLookups = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  const h = getHeaders();

  try {
    let sucursalesUrl = `${supabaseUrl}sucursales?order=nombre.asc&select=id,nombre`;
    if (!window.isAdmin) {
      if (window.userAllowedBranchIds && window.userAllowedBranchIds.length > 0) {
        sucursalesUrl = `${supabaseUrl}sucursales?id=in.(${window.userAllowedBranchIds.join(',')})&order=nombre.asc&select=id,nombre`;
      } else {
        sucursalesUrl = `${supabaseUrl}sucursales?id=eq.-1&select=id,nombre`;
      }
    }

    const [pRes, sRes, prRes] = await Promise.all([
      fetch(`${supabaseUrl}periodos?order=periodo.asc&activo=eq.true`, { headers: h }),
      fetch(sucursalesUrl, { headers: h }),
      fetch(`${supabaseUrl}producto?order=nombre.asc`, { headers: h })
    ]);
    periodsCache    = pRes.ok  ? await pRes.json()  : [];
    sucursalesCache = sRes.ok  ? await sRes.json()  : [];
    productsCache   = prRes.ok ? await prRes.json() : [];
  } catch (e) {
    console.error('loadLookups error:', e);
  }

  const populate = (selectId, items, labelFn) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const currentVal = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = labelFn(item);
      sel.appendChild(opt);
    });
    sel.value = currentVal;
  };

  // Modal selects
  populate('vp-form-periodo',  periodsCache,   i => i.periodo || `Período ${i.id}`);
  populate('vp-form-sucursal', sucursalesCache, i => i.nombre  || `Sucursal ${i.id}`);
  populate('vp-form-producto', productsCache,  i => i.nombre  || `Producto ${i.id}`);

  // Filter selects
  populate('volume-period-filter-periodo',  periodsCache,   i => i.periodo || `Período ${i.id}`);
  populate('volume-period-filter-sucursal', sucursalesCache, i => i.nombre  || `Sucursal ${i.id}`);
  populate('volume-period-filter-producto', productsCache,  i => i.nombre  || `Producto ${i.id}`);
};

// ─── Load ──────────────────────────────────────────────────────────────────────
export const loadVolumePeriod = async () => {
  const loadingEl = document.getElementById('volume-period-loading');
  const tableBody = document.getElementById('volume-period-table-body');
  const emptyEl   = document.getElementById('volume-period-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) await loadEnv();
  await loadLookups();

  const start = (vpPage - 1) * vpPageSize;
  const end   = start + vpPageSize - 1;

  try {
    let url = `${supabaseUrl}volumne_periodo?order=id.desc`;

    if (!window.isAdmin) {
      if (!window.userAllowedBranchIds || window.userAllowedBranchIds.length === 0) {
        vpList = [];
        vpTotalCount = 0;
        emptyEl?.classList.remove('hidden');
        updateVPPaginationUI(0, 0);
        loadingEl?.classList.add('hidden');
        return;
      }
      url += `&sucursal_id=in.(${window.userAllowedBranchIds.join(',')})`;
    }

    if (vpSearchQuery)    url += `&descripcion=ilike.*${encodeURIComponent(vpSearchQuery)}*`;
    if (vpFilterPeriod)   url += `&periodo_id=eq.${vpFilterPeriod}`;
    if (vpFilterSucursal) url += `&sucursal_id=eq.${vpFilterSucursal}`;
    if (vpFilterProduct)  url += `&producto_id=eq.${vpFilterProduct}`;

    const headers = { ...getHeaders(), 'Prefer': 'count=exact', 'Range': `${start}-${end}` };
    const res = await fetch(url, { headers });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    vpList = await res.json();
    const cr = res.headers.get('content-range');
    vpTotalCount = cr ? parseInt(cr.split('/')[1], 10) : vpList.length;

    if (vpList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateVPPaginationUI(0, 0);
    } else {
      vpList.forEach(row => {
        const canWrite = window.hasPermission('view-volume-period', 'escribir') && (window.isAdmin || window.canEditBranch?.(row.sucursal_id));
        const btnEditar = `
          <button onclick="editVolumePeriod(${row.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Registro">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editVolumePeriod(${row.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteVolumePeriod(${row.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Registro">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        `;

        const editDeleteRow = canWrite ? `${btnEditar}${btnEliminar}` : `${btnVer}`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        tr.innerHTML = `
          <td class="px-4 py-3 text-left whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              ${editDeleteRow}
            </div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${row.id}</td>
          <td class="px-4 py-3">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
              ${escapeHtml(periodLabel(row.periodo_id))}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">${escapeHtml(sucursalLabel(row.sucursal_id))}</td>
          <td class="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">${escapeHtml(productLabel(row.producto_id))}</td>
          <td class="px-4 py-3">
            <span class="font-semibold text-slate-800 dark:text-white tabular-nums">
              ${row.cantidad !== null ? Number(row.cantidad).toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">${fmtDate(row.fecha_registro)}</td>
          <td class="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">${escapeHtml(row.descripcion || '-')}</td>
        `;
        tableBody.appendChild(tr);
      });
      updateVPPaginationUI(start + 1, start + vpList.length);
    }
  } catch (err) {
    console.error('Error loading volumne_periodo:', err);
    tableBody.innerHTML = `
      <tr><td colspan="8" class="px-6 py-10 text-center text-red-500 font-semibold">
        ${err.message || 'Error cargando registros.'}
      </td></tr>`;
    updateVPPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

// ─── Pagination UI ─────────────────────────────────────────────────────────────
const updateVPPaginationUI = (startRange, endRange) => {
  const totalPages = Math.ceil(vpTotalCount / vpPageSize) || 1;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('vp-range-start',  startRange);
  set('vp-range-end',    endRange);
  set('vp-total-count',  vpTotalCount);
  set('vp-current-page', vpPage);
  set('vp-total-pages',  totalPages);

  const prev = document.getElementById('vp-btn-prev');
  const next = document.getElementById('vp-btn-next');
  if (prev) prev.disabled = vpPage <= 1;
  if (next) next.disabled = vpPage >= totalPages;
};

// ─── Init ──────────────────────────────────────────────────────────────────────
export const initVolumePeriodModule = () => {
  const overlay = document.getElementById('volume-period-modal-overlay');
  const card    = document.getElementById('volume-period-modal-card');
  const form    = document.getElementById('volume-period-form');
  const btnAdd  = document.getElementById('btn-add-volume-period');

  const openModal = (sucursalId = null) => {
    if (!overlay || !card) return;
    overlay.classList.remove('hidden');
    overlay.offsetHeight;
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    card.classList.remove('scale-95', 'opacity-0');
    card.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-volume-period', 'escribir') && (window.isAdmin || (sucursalId ? window.canEditBranch?.(sucursalId) : true));
    const saveBtn  = document.getElementById('btn-save-volume-period-modal');
    if (saveBtn) saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    form?.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = !canWrite; });
  };

  const closeModal = () => {
    if (!overlay || !card) return;
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  };

  const resetForm = () => {
    document.getElementById('vp-form-id').value             = '';
    document.getElementById('vp-form-periodo').value        = '';
    document.getElementById('vp-form-sucursal').value       = '';
    document.getElementById('vp-form-producto').value       = '';
    document.getElementById('vp-form-cantidad').value       = '';
    document.getElementById('vp-form-fecha-registro').value = '';
    document.getElementById('vp-form-descripcion').value    = '';
  };

  if (btnAdd) {
    btnAdd.style.display = window.hasPermission('view-volume-period', 'escribir') ? 'inline-flex' : 'none';
    btnAdd.addEventListener('click', async () => {
      await loadLookups();
      resetForm();
      document.getElementById('volume-period-modal-title').textContent = 'Crear Registro de Volumetría';
      openModal();
    });
  }

  document.getElementById('btn-close-volume-period-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-volume-period-modal')?.addEventListener('click', closeModal);

  // ── Edit ──────────────────────────────────────────────────────────────────
  window.editVolumePeriod = async (id) => {
    const row = vpList.find(x => x.id === id);
    if (!row) return;

    await loadLookups();

    document.getElementById('vp-form-id').value             = row.id;
    document.getElementById('vp-form-periodo').value        = row.periodo_id   ?? '';
    document.getElementById('vp-form-sucursal').value       = row.sucursal_id  ?? '';
    document.getElementById('vp-form-producto').value       = row.producto_id  ?? '';
    document.getElementById('vp-form-cantidad').value       = row.cantidad     ?? '';
    document.getElementById('vp-form-fecha-registro').value = row.fecha_registro ? row.fecha_registro.split('T')[0] : '';
    document.getElementById('vp-form-descripcion').value    = row.descripcion  ?? '';

    const canWrite = window.hasPermission('view-volume-period', 'escribir') && (window.isAdmin || window.canEditBranch?.(row.sucursal_id));
    document.getElementById('volume-period-modal-title').textContent = canWrite ? 'Editar Registro de Volumetría' : 'Detalles del Registro (Solo Lectura)';
    openModal(row.sucursal_id);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  window.deleteVolumePeriod = (id) => openDeleteModal(id, 'volume-period');

  // ── Submit ────────────────────────────────────────────────────────────────
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id             = document.getElementById('vp-form-id').value;
    const periodo_id     = document.getElementById('vp-form-periodo').value    || null;
    const sucursal_id    = document.getElementById('vp-form-sucursal').value   || null;
    const producto_id    = document.getElementById('vp-form-producto').value   || null;
    const cantidadVal    = document.getElementById('vp-form-cantidad').value;
    const cantidad       = cantidadVal !== '' ? parseFloat(cantidadVal) : null;
    const fecha_registro = document.getElementById('vp-form-fecha-registro').value || null;
    const descripcion    = document.getElementById('vp-form-descripcion').value.trim() || null;

    const saveBtn = document.getElementById('btn-save-volume-period-modal');
    const origTxt = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg> Guardando...`;

    try {
      const payload = { periodo_id, sucursal_id, producto_id, cantidad, fecha_registro, descripcion };
      const url    = id ? `${supabaseUrl}volumne_periodo?id=eq.${id}` : `${supabaseUrl}volumne_periodo`;
      const method = id ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Error al guardar el registro.');
      }

      showToast(id ? 'Registro actualizado con éxito.' : 'Registro creado con éxito.', true);
      closeModal();
      loadVolumePeriod();
    } catch (err) {
      console.error('Save volumne_periodo error:', err);
      showToast(err.message || 'Error al guardar el registro.', false);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origTxt;
    }
  });

  // ── Search ────────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('volume-period-search');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        vpSearchQuery = e.target.value.trim();
        vpPage = 1;
        loadVolumePeriod();
      }, 300);
    });
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  document.getElementById('volume-period-filter-periodo')?.addEventListener('change', (e) => {
    vpFilterPeriod = e.target.value;
    vpPage = 1;
    loadVolumePeriod();
  });

  document.getElementById('volume-period-filter-sucursal')?.addEventListener('change', (e) => {
    vpFilterSucursal = e.target.value;
    vpPage = 1;
    loadVolumePeriod();
  });

  document.getElementById('volume-period-filter-producto')?.addEventListener('change', (e) => {
    vpFilterProduct = e.target.value;
    vpPage = 1;
    loadVolumePeriod();
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  document.getElementById('vp-btn-prev')?.addEventListener('click', () => {
    if (vpPage > 1) { vpPage--; loadVolumePeriod(); }
  });
  document.getElementById('vp-btn-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(vpTotalCount / vpPageSize);
    if (vpPage < totalPages) { vpPage++; loadVolumePeriod(); }
  });

  // Load lookups on init (background)
  loadLookups().catch(console.error);
};
