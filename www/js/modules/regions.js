import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let regionsPage = 1;
const regionsPageSize = 10;
let regionsSearchQuery = "";
let regionsTotalCount = 0;
let regionsList = [];
let edosList = [];

// Fetch and cache Estados catalog
export const loadEdosCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}edo?order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      edosList = await res.json();
    }
  } catch (e) {
    console.warn("Error cargando catálogo de estados (edo):", e);
  }
};

// Populate EDO select dropdown
export const populateEdoSelect = async (selectedEdoId = null) => {
  const edoSelect = document.getElementById('region-form-edo');
  if (!edoSelect) return;

  if (edosList.length === 0) {
    await loadEdosCatalog();
  }

  edoSelect.innerHTML = '<option value="">-- Seleccionar Estado --</option>';
  edosList.forEach(e => {
    const isSelected = selectedEdoId && String(selectedEdoId) === String(e.id) ? 'selected' : '';
    edoSelect.innerHTML += `<option value="${e.id}" ${isSelected}>${escapeHtml(e.nombre)}</option>`;
  });
};

export const loadRegions = async () => {
  const loadingEl = document.getElementById('regions-loading');
  const tableBody = document.getElementById('regions-table-body');
  const emptyEl = document.getElementById('regions-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  if (edosList.length === 0) {
    await loadEdosCatalog();
  }

  const start = (regionsPage - 1) * regionsPageSize;
  const end = start + regionsPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}region`;

    if (regionsSearchQuery) {
      const encSearch = encodeURIComponent(regionsSearchQuery);
      queryUrl += `?or=(nombre.ilike.*${encSearch}*)&order=id.asc`;
    } else {
      queryUrl += `?order=id.asc`;
    }

    const headers = getHeaders();
    headers["Prefer"] = "count=exact";
    headers["Range"] = `${start}-${end}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} - No se pudo conectar a la base de datos.`);
    
    regionsList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        regionsTotalCount = parseInt(parts[1], 10);
      }
    } else {
      regionsTotalCount = regionsList.length;
    }

    if (regionsList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateRegionsPaginationUI(0, 0);
    } else {
      regionsList.forEach(reg => {
        const statusBadge = reg.activo
          ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Activa</span>`
          : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inactiva</span>`;

        const edoObj = edosList.find(e => String(e.id) === String(reg.edo_id));
        const edoBadge = edoObj
          ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
              <svg class="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              ${escapeHtml(edoObj.nombre)}
            </span>`
          : `<span class="text-slate-400 italic text-xs">Sin Estado</span>`;

        const canWrite = window.hasPermission('view-regions', 'escribir');

        const btnEditar = `
          <button onclick="editRegion(${reg.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Región">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editRegion(${reg.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteRegion(${reg.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Región">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        `;

        const editDeleteRow = canWrite ? `${btnEditar}${btnEliminar}` : `${btnVer}`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-4 py-3 text-left whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              ${editDeleteRow}
            </div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${reg.id}</td>
          <td class="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">${escapeHtml(reg.nombre)}</td>
          <td class="px-4 py-3">${edoBadge}</td>
          <td class="px-4 py-3">${statusBadge}</td>
        `;
        tableBody.appendChild(row);
      });
      updateRegionsPaginationUI(start + 1, start + regionsList.length);
    }
  } catch (err) {
    console.error("Error loading regions:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando regiones.'}
        </td>
      </tr>
    `;
    updateRegionsPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateRegionsPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('regions-range-start');
  const rangeEndEl = document.getElementById('regions-range-end');
  const totalCountEl = document.getElementById('regions-total-count');
  const currentPageEl = document.getElementById('regions-current-page');
  const totalPagesEl = document.getElementById('regions-total-pages');
  const btnPrev = document.getElementById('regions-btn-prev');
  const btnNext = document.getElementById('regions-btn-next');

  const totalPages = Math.ceil(regionsTotalCount / regionsPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = regionsTotalCount;
  if (currentPageEl) currentPageEl.textContent = regionsPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = regionsPage <= 1;
  if (btnNext) btnNext.disabled = regionsPage >= totalPages;
};

export const initRegionsModule = () => {
  const regionModalOverlay = document.getElementById('region-modal-overlay');
  const regionModalCard = document.getElementById('region-modal-card');
  const btnCloseRegionModal = document.getElementById('btn-close-region-modal');
  const btnCancelRegionModal = document.getElementById('btn-cancel-region-modal');
  const btnAddRegion = document.getElementById('btn-add-region');
  const regionForm = document.getElementById('region-form');

  const openRegionModal = () => {
    if (!regionModalOverlay || !regionModalCard) return;
    regionModalOverlay.classList.remove('hidden');
    regionModalOverlay.offsetHeight;
    regionModalOverlay.classList.remove('opacity-0');
    regionModalOverlay.classList.add('opacity-100');
    regionModalCard.classList.remove('scale-95', 'opacity-0');
    regionModalCard.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-regions', 'escribir');
    const saveBtn = document.getElementById('btn-save-region-modal');
    if (saveBtn) {
      saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    }
    if (regionForm) {
      const inputs = regionForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !canWrite;
      });
    }
  };

  const closeRegionModal = () => {
    if (!regionModalOverlay || !regionModalCard) return;
    regionModalOverlay.classList.remove('opacity-100');
    regionModalOverlay.classList.add('opacity-0');
    regionModalCard.classList.remove('scale-100', 'opacity-100');
    regionModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      regionModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnAddRegion) {
    const canWrite = window.hasPermission('view-regions', 'escribir');
    btnAddRegion.style.display = canWrite ? 'inline-flex' : 'none';
    btnAddRegion.addEventListener('click', async () => {
      document.getElementById('region-form-id').value = '';
      document.getElementById('region-form-nombre').value = '';
      document.getElementById('region-form-activo').checked = true;

      await populateEdoSelect(null);

      document.getElementById('region-modal-title').textContent = 'Crear Región';
      openRegionModal();
    });
  }

  if (btnCloseRegionModal) btnCloseRegionModal.addEventListener('click', closeRegionModal);
  if (btnCancelRegionModal) btnCancelRegionModal.addEventListener('click', closeRegionModal);

  window.editRegion = async (id) => {
    const reg = regionsList.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('region-form-id').value = reg.id;
    document.getElementById('region-form-nombre').value = reg.nombre || '';
    document.getElementById('region-form-activo').checked = reg.activo === true;

    await populateEdoSelect(reg.edo_id);

    const canWrite = window.hasPermission('view-regions', 'escribir');
    document.getElementById('region-modal-title').textContent = canWrite ? 'Editar Región' : 'Detalles de la Región';
    openRegionModal();
  };

  window.deleteRegion = (id) => {
    openDeleteModal(id, 'region');
  };

  if (regionForm) {
    regionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('region-form-id').value;
      const nombre = document.getElementById('region-form-nombre').value.trim();
      const edoSelect = document.getElementById('region-form-edo');
      const edo_id = edoSelect && edoSelect.value ? parseInt(edoSelect.value, 10) : null;
      const activo = document.getElementById('region-form-activo').checked;

      const saveBtn = document.getElementById('btn-save-region-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const regionData = { nombre, activo, edo_id };

        let url = `${supabaseUrl}region`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}region?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(regionData)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos de la región en Supabase.");

        showToast(id ? 'Región actualizada con éxito.' : 'Región creada con éxito.', true);
        closeRegionModal();
        loadRegions();
      } catch (err) {
        console.error("Save region error:", err);
        showToast(err.message || 'Error al guardar los datos de la región.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Regions Controls
  const regionsSearchInput = document.getElementById('regions-search');
  if (regionsSearchInput) {
    let debounceTimer;
    regionsSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        regionsSearchQuery = e.target.value.trim();
        regionsPage = 1;
        loadRegions();
      }, 300);
    });
  }

  const regionsBtnPrev = document.getElementById('regions-btn-prev');
  const regionsBtnNext = document.getElementById('regions-btn-next');
  if (regionsBtnPrev) {
    regionsBtnPrev.addEventListener('click', () => {
      if (regionsPage > 1) {
        regionsPage--;
        loadRegions();
      }
    });
  }
  if (regionsBtnNext) {
    regionsBtnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(regionsTotalCount / regionsPageSize);
      if (regionsPage < totalPages) {
        regionsPage++;
        loadRegions();
      }
    });
  }
};
export { regionsTotalCount, regionsPage, regionsPageSize, regionsSearchQuery };
