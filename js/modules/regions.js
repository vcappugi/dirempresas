import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let regionsPage = 1;
const regionsPageSize = 5;
let regionsSearchQuery = "";
let regionsTotalCount = 0;
let regionsList = [];

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

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${reg.id}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-255 font-medium">${escapeHtml(reg.nombre)}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            <button onclick="editRegion(${reg.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
            <button onclick="deleteRegion(${reg.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
      updateRegionsPaginationUI(start + 1, start + regionsList.length);
    }
  } catch (err) {
    console.error("Error loading regions:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="px-6 py-10 text-center text-red-500 font-semibold">
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
    btnAddRegion.addEventListener('click', () => {
      document.getElementById('region-form-id').value = '';
      document.getElementById('region-form-nombre').value = '';
      document.getElementById('region-form-activo').checked = true;

      document.getElementById('region-modal-title').textContent = 'Crear Región';
      openRegionModal();
    });
  }

  if (btnCloseRegionModal) btnCloseRegionModal.addEventListener('click', closeRegionModal);
  if (btnCancelRegionModal) btnCancelRegionModal.addEventListener('click', closeRegionModal);

  window.editRegion = (id) => {
    const reg = regionsList.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('region-form-id').value = reg.id;
    document.getElementById('region-form-nombre').value = reg.nombre || '';
    document.getElementById('region-form-activo').checked = reg.activo === true;

    document.getElementById('region-modal-title').textContent = 'Editar Región';
    openRegionModal();
  };

  window.deleteRegion = (id) => {
    openDeleteModal(id, 'region');
  };

  if (regionForm) {
    regionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('region-form-id').value;
      const nombre = document.getElementById('region-form-nombre').value;
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
        const regionData = { nombre, activo };

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
