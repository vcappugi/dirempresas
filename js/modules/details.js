import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';
import { companiesList } from './companies.js';

export let currentCompanyIdForDetails = null;
let detailsList = [];
let cachedDetailTypes = [];
let detailsViewMode = 'cards';

const loadDetailTypesSelect = async (selectedVal = null) => {
  const selectEl = document.getElementById('detail-form-tipo');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="" disabled selected>Cargando opciones...</option>';

  try {
    const res = await fetch(`${supabaseUrl}tipo_detalle?order=tipo.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("Error al cargar tipo_detalle");
    const data = await res.json();
    cachedDetailTypes = data;

    selectEl.innerHTML = '<option value="" disabled>Seleccione un Tipo</option>';
    
    data.forEach(item => {
      const val = item.tipo;
      if (val) {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        if (selectedVal && selectedVal.toLowerCase() === val.toLowerCase()) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      }
    });

    // Si no hay opción seleccionada, forzar placeholder
    if (!selectedVal) {
      const placeholder = selectEl.querySelector('option[value=""]');
      if (placeholder) placeholder.selected = true;
    }
  } catch (err) {
    console.warn("Error populating detail types select, using fallback:", err);
    // Fallback a opciones estáticas por diseño premium robusto
    selectEl.innerHTML = `
      <option value="" disabled>Seleccione un Tipo</option>
      <option value="Impuestos">Impuestos</option>
      <option value="Licencias">Licencias</option>
      <option value="Contacto">Contacto</option>
      <option value="Facturación">Facturación</option>
      <option value="Otros">Otros</option>
    `;
    if (selectedVal) {
      selectEl.value = selectedVal;
    } else {
      selectEl.value = "";
    }
  }

  // Bind change event listener once to automatically populate orden field
  if (!selectEl.dataset.listenerBound) {
    selectEl.addEventListener('change', (e) => {
      const selectedVal = e.target.value;
      const matched = cachedDetailTypes.find(t => t.tipo === selectedVal);
      if (matched && matched.orden !== null && matched.orden !== undefined) {
        const ordenInput = document.getElementById('detail-form-orden');
        if (ordenInput) {
          ordenInput.value = matched.orden;
        }
      }
    });
    selectEl.dataset.listenerBound = "true";
  }
};

const renderDetails = () => {
  const cardsGrid = document.getElementById('details-cards-grid');
  const tableBody = document.getElementById('details-table-body');
  const listContainer = document.getElementById('details-list-container');
  const emptyEl = document.getElementById('details-empty');

  if (!cardsGrid || !tableBody || !listContainer) return;

  cardsGrid.innerHTML = '';
  tableBody.innerHTML = '';

  if (detailsList.length === 0) {
    emptyEl?.classList.remove('hidden');
    cardsGrid.classList.add('hidden');
    listContainer.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');

  if (detailsViewMode === 'cards') {
    cardsGrid.classList.remove('hidden');
    listContainer.classList.add('hidden');

    detailsList.forEach(det => {
      let badgeColors = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350";
      if (det.tipo === "Impuestos") {
        badgeColors = "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400";
      } else if (det.tipo === "Licencias") {
        badgeColors = "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400";
      } else if (det.tipo === "Contacto") {
        badgeColors = "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400";
      } else if (det.tipo === "Facturación") {
        badgeColors = "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400";
      }

      const card = document.createElement('div');
      card.className = "flex flex-col justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 hover:shadow-md transition-all duration-300";
      card.innerHTML = `
        <div class="space-y-3 font-sans">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-lg ${badgeColors}">${escapeHtml(det.tipo)}</span>
              ${det.orden !== null && det.orden !== undefined ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono" title="Orden de visualización">#${det.orden}</span>` : ''}
            </div>
            <span class="text-[10px] font-semibold text-slate-450 dark:text-slate-500 font-mono">${det.fecha ? det.fecha : ''}</span>
          </div>
          ${det.comentario ? `<p class="text-xs text-slate-650 dark:text-slate-255 leading-relaxed font-medium">${escapeHtml(det.comentario)}</p>` : ''}
          <p class="font-display font-bold text-base text-slate-900 dark:text-white break-words">${escapeHtml(det.valor)}</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
          <button onclick="editDetail(${det.id})" class="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-semibold px-2 py-1 rounded-lg hover:bg-brand/10 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg> Editar
          </button>
          <button onclick="deleteDetail(${det.id})" class="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-650 font-semibold px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg> Eliminar
          </button>
        </div>
      `;
      cardsGrid.appendChild(card);
    });
  } else {
    cardsGrid.classList.add('hidden');
    listContainer.classList.remove('hidden');

    detailsList.forEach(det => {
      let badgeColors = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350";
      if (det.tipo === "Impuestos") {
        badgeColors = "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400";
      } else if (det.tipo === "Licencias") {
        badgeColors = "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400";
      } else if (det.tipo === "Contacto") {
        badgeColors = "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400";
      } else if (det.tipo === "Facturación") {
        badgeColors = "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400";
      }

      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
      row.innerHTML = `
        <td class="px-6 py-4 font-mono font-bold text-xs text-slate-850 dark:text-slate-300">${det.orden !== null && det.orden !== undefined ? det.orden : '-'}</td>
        <td class="px-6 py-4"><span class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-lg ${badgeColors}">${escapeHtml(det.tipo)}</span></td>
        <td class="px-6 py-4 text-xs font-medium text-slate-450 dark:text-slate-500 font-mono">${det.fecha ? det.fecha : ''}</td>
        <td class="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white break-all">${escapeHtml(det.valor)}</td>
        <td class="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate" title="${det.comentario ? escapeHtml(det.comentario) : ''}">${det.comentario ? escapeHtml(det.comentario) : '<span class="text-slate-400 italic">Sin comentario</span>'}</td>
        <td class="px-6 py-4 text-right space-x-1">
          <button onclick="editDetail(${det.id})" class="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-semibold px-2 py-1.5 rounded-lg hover:bg-brand/10 transition-colors" title="Editar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
          </button>
          <button onclick="deleteDetail(${det.id})" class="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-650 font-semibold px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Eliminar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }
};

export const loadDetails = async (companyId) => {
  const loadingEl = document.getElementById('details-loading');
  const cardsGrid = document.getElementById('details-cards-grid');

  if (!cardsGrid) return;

  loadingEl?.classList.remove('hidden');
  cardsGrid.innerHTML = '';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const res = await fetch(`${supabaseUrl}detalle_empresa?empresa_id=eq.${companyId}&order=orden.asc,id.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("Error al obtener los detalles de la empresa.");

    detailsList = await res.json();
    renderDetails();

  } catch (err) {
    console.error("Error loading details:", err);
    cardsGrid.innerHTML = `<div class="col-span-full py-8 text-center text-red-500 font-semibold">${err.message || 'Error cargando detalles.'}</div>`;
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateToggleButtonsUI = () => {
  const btnViewCards = document.getElementById('btn-details-view-cards');
  const btnViewList = document.getElementById('btn-details-view-list');
  if (!btnViewCards || !btnViewList) return;

  if (detailsViewMode === 'cards') {
    btnViewCards.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-brand bg-white dark:bg-slate-900 shadow-sm";
    btnViewList.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
  } else {
    btnViewCards.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
    btnViewList.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-brand bg-white dark:bg-slate-900 shadow-sm";
  }
};

export const openDetailsModal = (companyId) => {
  currentCompanyIdForDetails = companyId;
  detailsViewMode = 'cards';
  updateToggleButtonsUI();

  const comp = companiesList.find(c => c.id === companyId);
  const companyName = comp ? comp.razon : `Empresa #${companyId}`;

  const titleEl = document.getElementById('company-details-modal-title');
  if (titleEl) titleEl.textContent = `Detalles de Empresa: ${companyName}`;

  const detailsModalOverlay = document.getElementById('company-details-modal-overlay');
  const detailsModalCard = document.getElementById('company-details-modal-card');
  if (!detailsModalOverlay || !detailsModalCard) return;
  detailsModalOverlay.classList.remove('hidden');
  detailsModalOverlay.offsetHeight;
  detailsModalOverlay.classList.remove('opacity-0');
  detailsModalOverlay.classList.add('opacity-100');
  detailsModalCard.classList.remove('scale-95', 'opacity-0');
  detailsModalCard.classList.add('scale-100', 'opacity-100');

  loadDetails(companyId);
};

export const initDetailsModule = () => {
  const detailsModalOverlay = document.getElementById('company-details-modal-overlay');
  const detailsModalCard = document.getElementById('company-details-modal-card');
  const btnCloseDetailsModal = document.getElementById('btn-close-company-details-modal');
  const btnAddDetail = document.getElementById('btn-add-detail');

  const btnViewCards = document.getElementById('btn-details-view-cards');
  const btnViewList = document.getElementById('btn-details-view-list');

  const detailModalOverlay = document.getElementById('detail-modal-overlay');
  const detailModalCard = document.getElementById('detail-modal-card');
  const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
  const btnCancelDetailModal = document.getElementById('btn-cancel-detail-modal');
  const detailForm = document.getElementById('detail-form');

  const closeDetailsModal = () => {
    if (!detailsModalOverlay || !detailsModalCard) return;
    detailsModalOverlay.classList.remove('opacity-100');
    detailsModalOverlay.classList.add('opacity-0');
    detailsModalCard.classList.remove('scale-100', 'opacity-100');
    detailsModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      detailsModalOverlay.classList.add('hidden');
      currentCompanyIdForDetails = null;
    }, 300);
  };

  const openDetailFormModal = () => {
    if (!detailModalOverlay || !detailModalCard) return;
    detailModalOverlay.classList.remove('hidden');
    detailModalOverlay.offsetHeight;
    detailModalOverlay.classList.remove('opacity-0');
    detailModalOverlay.classList.add('opacity-100');
    detailModalCard.classList.remove('scale-95', 'opacity-0');
    detailModalCard.classList.add('scale-100', 'opacity-100');
  };

  const closeDetailFormModal = () => {
    if (!detailModalOverlay || !detailModalCard) return;
    detailModalOverlay.classList.remove('opacity-100');
    detailModalOverlay.classList.add('opacity-0');
    detailModalCard.classList.remove('scale-100', 'opacity-100');
    detailModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      detailModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnCloseDetailsModal) btnCloseDetailsModal.addEventListener('click', closeDetailsModal);

  if (btnViewCards) {
    btnViewCards.addEventListener('click', () => {
      detailsViewMode = 'cards';
      updateToggleButtonsUI();
      renderDetails();
    });
  }

  if (btnViewList) {
    btnViewList.addEventListener('click', () => {
      detailsViewMode = 'list';
      updateToggleButtonsUI();
      renderDetails();
    });
  }

  if (btnAddDetail) {
    btnAddDetail.addEventListener('click', () => {
      document.getElementById('detail-form-id').value = '';
      document.getElementById('detail-form-fecha').value = new Date().toISOString().split('T')[0];
      document.getElementById('detail-form-orden').value = '';
      document.getElementById('detail-form-valor').value = '';
      document.getElementById('detail-form-comentario').value = '';

      document.getElementById('detail-modal-title').textContent = 'Añadir Detalle';
      loadDetailTypesSelect();
      openDetailFormModal();
    });
  }

  if (btnCloseDetailModal) btnCloseDetailModal.addEventListener('click', closeDetailFormModal);
  if (btnCancelDetailModal) btnCancelDetailModal.addEventListener('click', closeDetailFormModal);

  window.openDetailsModal = openDetailsModal;

  window.editDetail = (id) => {
    const det = detailsList.find(d => d.id === id);
    if (!det) return;

    document.getElementById('detail-form-id').value = det.id;
    document.getElementById('detail-form-fecha').value = det.fecha || '';
    document.getElementById('detail-form-orden').value = det.orden !== null && det.orden !== undefined ? det.orden : '';
    document.getElementById('detail-form-valor').value = det.valor || '';
    document.getElementById('detail-form-comentario').value = det.comentario || '';

    document.getElementById('detail-modal-title').textContent = 'Editar Detalle';
    loadDetailTypesSelect(det.tipo);
    openDetailFormModal();
  };

  window.deleteDetail = (id) => {
    openDeleteModal(id, 'detail');
  };

  if (detailForm) {
    detailForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('detail-form-id').value;
      const tipo = document.getElementById('detail-form-tipo').value;
      const fecha = document.getElementById('detail-form-fecha').value;
      const ordenVal = document.getElementById('detail-form-orden').value;
      const orden = ordenVal !== '' ? parseInt(ordenVal, 10) : null;
      const valor = document.getElementById('detail-form-valor').value;
      const comentario = document.getElementById('detail-form-comentario').value;

      const saveBtn = document.getElementById('btn-save-detail-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const detailData = {
          empresa_id: currentCompanyIdForDetails,
          tipo,
          fecha,
          orden,
          valor,
          comentario
        };

        let url = `${supabaseUrl}detalle_empresa`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}detalle_empresa?id=eq.${id}`;
          method = 'PATCH';
          delete detailData.empresa_id;
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(detailData)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos del detalle en Supabase.");

        showToast(id ? 'Detalle actualizado con éxito.' : 'Detalle creado con éxito.', true);
        closeDetailFormModal();
        loadDetails(currentCompanyIdForDetails);
      } catch (err) {
        console.error("Save detail error:", err);
        showToast(err.message || 'Error al guardar los datos del detalle.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }
};
