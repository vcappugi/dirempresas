import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let detailTypesPage = 1;
const detailTypesPageSize = 5;
let detailTypesSearchQuery = "";
let detailTypesTotalCount = 0;
let detailTypesList = [];

export const loadDetailTypes = async () => {
  const loadingEl = document.getElementById('detail-types-loading');
  const tableBody = document.getElementById('detail-types-table-body');
  const emptyEl = document.getElementById('detail-types-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (detailTypesPage - 1) * detailTypesPageSize;
  const end = start + detailTypesPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}tipo_detalle`;

    if (detailTypesSearchQuery) {
      const encSearch = encodeURIComponent(detailTypesSearchQuery);
      queryUrl += `?or=(tipo.ilike.*${encSearch}*,descripcion.ilike.*${encSearch}*)&order=orden.asc,id.asc`;
    } else {
      queryUrl += `?order=orden.asc,id.asc`;
    }

    const headers = getHeaders();
    headers["Prefer"] = "count=exact";
    headers["Range"] = `${start}-${end}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} - No se pudo conectar a la base de datos.`);
    
    detailTypesList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        detailTypesTotalCount = parseInt(parts[1], 10);
      }
    } else {
      detailTypesTotalCount = detailTypesList.length;
    }

    if (detailTypesList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateDetailTypesPaginationUI(0, 0);
    } else {
      detailTypesList.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${item.id}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-255 font-medium">${escapeHtml(item.tipo)}</td>
          <td class="px-6 py-4 text-slate-550 dark:text-slate-450 text-xs">${item.descripcion ? escapeHtml(item.descripcion) : '<span class="text-slate-400 italic">Sin descripción</span>'}</td>
          <td class="px-6 py-4 text-slate-550 dark:text-slate-450 font-mono text-xs">${item.orden !== null && item.orden !== undefined ? item.orden : '-'}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            <button onclick="editDetailType(${item.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
            <button onclick="deleteDetailType(${item.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
      updateDetailTypesPaginationUI(start + 1, start + detailTypesList.length);
    }
  } catch (err) {
    console.error("Error loading detail types:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando tipos de detalles.'}
        </td>
      </tr>
    `;
    updateDetailTypesPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateDetailTypesPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('detail-types-range-start');
  const rangeEndEl = document.getElementById('detail-types-range-end');
  const totalCountEl = document.getElementById('detail-types-total-count');
  const currentPageEl = document.getElementById('detail-types-current-page');
  const totalPagesEl = document.getElementById('detail-types-total-pages');
  const btnPrev = document.getElementById('detail-types-btn-prev');
  const btnNext = document.getElementById('detail-types-btn-next');

  const totalPages = Math.ceil(detailTypesTotalCount / detailTypesPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = detailTypesTotalCount;
  if (currentPageEl) currentPageEl.textContent = detailTypesPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = detailTypesPage <= 1;
  if (btnNext) btnNext.disabled = detailTypesPage >= totalPages;
};

export const initDetailTypesModule = () => {
  const modalOverlay = document.getElementById('detail-type-modal-overlay');
  const modalCard = document.getElementById('detail-type-modal-card');
  const btnCloseModal = document.getElementById('btn-close-detail-type-modal');
  const btnCancelModal = document.getElementById('btn-cancel-detail-type-modal');
  const btnAddDetailType = document.getElementById('btn-add-detail-type');
  const detailTypeForm = document.getElementById('detail-type-form');

  const openModal = () => {
    if (!modalOverlay || !modalCard) return;
    modalOverlay.classList.remove('hidden');
    modalOverlay.offsetHeight;
    modalOverlay.classList.remove('opacity-0');
    modalOverlay.classList.add('opacity-100');
    modalCard.classList.remove('scale-95', 'opacity-0');
    modalCard.classList.add('scale-100', 'opacity-100');
  };

  const closeModal = () => {
    if (!modalOverlay || !modalCard) return;
    modalOverlay.classList.remove('opacity-100');
    modalOverlay.classList.add('opacity-0');
    modalCard.classList.remove('scale-100', 'opacity-100');
    modalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      modalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnAddDetailType) {
    btnAddDetailType.addEventListener('click', () => {
      document.getElementById('detail-type-form-id').value = '';
      document.getElementById('detail-type-form-tipo').value = '';
      document.getElementById('detail-type-form-descripcion').value = '';
      document.getElementById('detail-type-form-orden').value = '';

      document.getElementById('detail-type-modal-title').textContent = 'Crear Tipo de Detalle';
      openModal();
    });
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  window.editDetailType = (id) => {
    const item = detailTypesList.find(x => x.id === id);
    if (!item) return;

    document.getElementById('detail-type-form-id').value = item.id;
    document.getElementById('detail-type-form-tipo').value = item.tipo || '';
    document.getElementById('detail-type-form-descripcion').value = item.descripcion || '';
    document.getElementById('detail-type-form-orden').value = item.orden !== null && item.orden !== undefined ? item.orden : '';

    document.getElementById('detail-type-modal-title').textContent = 'Editar Tipo de Detalle';
    openModal();
  };

  window.deleteDetailType = (id) => {
    openDeleteModal(id, 'detail_type');
  };

  if (detailTypeForm) {
    detailTypeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('detail-type-form-id').value;
      const tipo = document.getElementById('detail-type-form-tipo').value;
      const descripcion = document.getElementById('detail-type-form-descripcion').value;
      const ordenVal = document.getElementById('detail-type-form-orden').value;
      const orden = ordenVal !== '' ? parseInt(ordenVal, 10) : null;

      const saveBtn = document.getElementById('btn-save-detail-type-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const payload = { tipo, descripcion, orden };

        let url = `${supabaseUrl}tipo_detalle`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}tipo_detalle?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos del tipo de detalle en Supabase.");

        showToast(id ? 'Tipo de detalle actualizado con éxito.' : 'Tipo de detalle creado con éxito.', true);
        closeModal();
        loadDetailTypes();
      } catch (err) {
        console.error("Save detail type error:", err);
        showToast(err.message || 'Error al guardar el tipo de detalle.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Bind Search bar input event
  const searchInput = document.getElementById('detail-types-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      detailTypesSearchQuery = e.target.value;
      detailTypesPage = 1;
      loadDetailTypes();
    });
  }

  // Bind pagination buttons
  const btnPrev = document.getElementById('detail-types-btn-prev');
  const btnNext = document.getElementById('detail-types-btn-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (detailTypesPage > 1) {
        detailTypesPage--;
        loadDetailTypes();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(detailTypesTotalCount / detailTypesPageSize) || 1;
      if (detailTypesPage < totalPages) {
        detailTypesPage++;
        loadDetailTypes();
      }
    });
  }
};
