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
    const [pRes, sRes, prRes] = await Promise.all([
      fetch(`${supabaseUrl}periodos?order=periodo.asc&activo=eq.true`, { headers: h }),
      fetch(`${supabaseUrl}sucursales?order=nombre.asc&select=id,nombre`, { headers: h }),
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
  if (periodsCache.length === 0 && sucursalesCache.length === 0) await loadLookups();

  const start = (vpPage - 1) * vpPageSize;
  const end   = start + vpPageSize - 1;

  try {
    let url = `${supabaseUrl}volumne_periodo?order=id.desc`;

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
      const canWrite = window.hasPermission('view-volume-period', 'escribir');
      vpList.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        tr.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white font-mono">${row.id}</td>
          <td class="px-6 py-4">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
              ${escapeHtml(periodLabel(row.periodo_id))}
            </span>
          </td>
          <td class="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">${escapeHtml(sucursalLabel(row.sucursal_id))}</td>
          <td class="px-6 py-4 text-slate-700 dark:text-slate-200 font-medium">${escapeHtml(productLabel(row.producto_id))}</td>
          <td class="px-6 py-4">
            <span class="font-semibold text-slate-800 dark:text-white tabular-nums">
              ${row.cantidad !== null ? Number(row.cantidad).toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
            </span>
          </td>
          <td class="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">${fmtDate(row.fecha_registro)}</td>
          <td class="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">${escapeHtml(row.descripcion || '-')}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            ${canWrite
              ? `<button onclick="editVolumePeriod(${row.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
                 <button onclick="deleteVolumePeriod(${row.id})" class="text-red-500 hover:text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>`
              : `<button onclick="editVolumePeriod(${row.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Ver</button>`
            }
          </td>
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

  const openModal = () => {
    if (!overlay || !card) return;
    overlay.classList.remove('hidden');
    overlay.offsetHeight;
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    card.classList.remove('scale-95', 'opacity-0');
    card.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-volume-period', 'escribir');
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

    const canWrite = window.hasPermission('view-volume-period', 'escribir');
    document.getElementById('volume-period-modal-title').textContent = canWrite ? 'Editar Registro de Volumetría' : 'Detalles del Registro';
    openModal();
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
