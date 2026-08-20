import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let modelsPage = 1;
const modelsPageSize = 10;
let modelsSearchQuery = "";
let modelsTotalCount = 0;
let modelsList = [];
let productosList = [];
let lineasList = [];
let familiasList = [];

// Helper to format currency
const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

// Fetch and cache Productos catalog
export const loadProductosCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}producto?order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      productosList = await res.json();
    }
  } catch (e) {
    console.warn("Error cargando catálogo de productos:", e);
  }
};

// Fetch and cache Lineas catalog
export const loadLineasCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}lineas?order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      lineasList = await res.json();
    }
  } catch (e) {
    console.warn("Error cargando catálogo de líneas:", e);
  }
};

// Fetch and cache Familia catalog
export const loadFamiliasCatalog = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  try {
    const res = await fetch(`${supabaseUrl}familia?order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      familiasList = await res.json();
    }
  } catch (e) {
    console.warn("Error cargando catálogo de familias:", e);
  }
};

// Populate Selects in Model Modal
const populateModelSelects = async (selectedProducto = null, selectedLinea = null, selectedFamilia = null) => {
  if (productosList.length === 0) await loadProductosCatalog();
  if (lineasList.length === 0) await loadLineasCatalog();
  if (familiasList.length === 0) await loadFamiliasCatalog();

  const productoSelect = document.getElementById('model-form-producto');
  const lineaSelect = document.getElementById('model-form-linea');
  const familiaSelect = document.getElementById('model-form-familia');

  if (productoSelect) {
    productoSelect.innerHTML = '<option value="">-- Seleccionar Producto/Servicio --</option>';
    productosList.forEach(p => {
      const isSel = selectedProducto && String(selectedProducto) === String(p.id) ? 'selected' : '';
      productoSelect.innerHTML += `<option value="${p.id}" ${isSel}>${escapeHtml(p.nombre || 'Producto ' + p.id)}</option>`;
    });
  }

  if (lineaSelect) {
    lineaSelect.innerHTML = '<option value="">-- Seleccionar Línea --</option>';
    lineasList.forEach(l => {
      const isSel = selectedLinea && String(selectedLinea) === String(l.id) ? 'selected' : '';
      lineaSelect.innerHTML += `<option value="${l.id}" ${isSel}>${escapeHtml(l.nombre || 'Línea ' + l.id)}</option>`;
    });
  }

  if (familiaSelect) {
    familiaSelect.innerHTML = '<option value="">-- Seleccionar Familia --</option>';
    familiasList.forEach(f => {
      const isSel = selectedFamilia && String(selectedFamilia) === String(f.id) ? 'selected' : '';
      familiaSelect.innerHTML += `<option value="${f.id}" ${isSel}>${escapeHtml(f.nombre || 'Familia ' + f.id)}</option>`;
    });

    if (selectedFamilia && !familiasList.some(f => String(f.id) === String(selectedFamilia))) {
      familiaSelect.innerHTML += `<option value="${selectedFamilia}" selected>Familia #${selectedFamilia}</option>`;
    }
  }
};

export const loadModels = async () => {
  const loadingEl = document.getElementById('models-loading');
  const tableBody = document.getElementById('models-table-body');
  const emptyEl = document.getElementById('models-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  // Pre-load catalogs if not already cached
  if (productosList.length === 0) await loadProductosCatalog();
  if (lineasList.length === 0) await loadLineasCatalog();
  if (familiasList.length === 0) await loadFamiliasCatalog();

  const start = (modelsPage - 1) * modelsPageSize;
  const end = start + modelsPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}modelos`;

    if (modelsSearchQuery) {
      const encSearch = encodeURIComponent(modelsSearchQuery);
      queryUrl += `?or=(modelo.ilike.*${encSearch}*,regla_comision.ilike.*${encSearch}*)&order=id.asc`;
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

    if (!res.ok) throw new Error(`HTTP ${res.status} - No se pudo conectar a la tabla de modelos.`);
    
    modelsList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        modelsTotalCount = parseInt(parts[1], 10);
      }
    } else {
      modelsTotalCount = modelsList.length;
    }

    if (modelsList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateModelsPaginationUI(0, 0);
    } else {
      modelsList.forEach(m => {
        let dateStr = '-';
        if (m.created_at) {
          try {
            dateStr = new Date(m.created_at).toLocaleDateString();
          } catch(e) {}
        }

        // Find product, linea and familia names
        const prodObj = productosList.find(p => String(p.id) === String(m.producto_id));
        const prodName = prodObj ? prodObj.nombre : (m.producto_id ? `Producto #${m.producto_id}` : '-');

        const lineaObj = lineasList.find(l => String(l.id) === String(m.linea));
        const lineaName = lineaObj ? lineaObj.nombre : (m.linea ? `Línea #${m.linea}` : '-');

        const familiaObj = familiasList.find(f => String(f.id) === String(m.familia));
        const familiaName = familiaObj ? familiaObj.nombre : (m.familia ? `Familia #${m.familia}` : '-');

        const canWrite = window.hasPermission('view-models', 'escribir');

        const btnEditar = `
          <button onclick="editModel(${m.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Modelo">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editModel(${m.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteModel(${m.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Modelo">
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
          <td class="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">#${m.id}</td>
          <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">${escapeHtml(m.modelo || '-')}</td>
          <td class="px-4 py-3">
            ${m.producto_id ? `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                ${escapeHtml(prodName)}
              </span>
            ` : '<span class="text-slate-400 text-xs">-</span>'}
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
              ${escapeHtml(lineaName)}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${escapeHtml(familiaName)}</td>
          <td class="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">${formatCurrency(m.precio_sugerido)}</td>
          <td class="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">${formatCurrency(m.comision_concesionario)}</td>
          <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">${escapeHtml(m.regla_comision || '-')}</td>
          <td class="px-4 py-3 text-xs text-slate-400">${dateStr}</td>
        `;
        tableBody.appendChild(tr);
      });

      const currentStart = start + 1;
      const currentEnd = Math.min(start + modelsList.length, modelsTotalCount);
      updateModelsPaginationUI(currentStart, currentEnd);
    }
  } catch (err) {
    console.error("Error al cargar modelos:", err);
    showToast(err.message || 'Error al conectar con la base de datos', false);
    emptyEl?.classList.remove('hidden');
    updateModelsPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateModelsPaginationUI = (start, end) => {
  const rangeStart = document.getElementById('models-range-start');
  const rangeEnd = document.getElementById('models-range-end');
  const totalCountEl = document.getElementById('models-total-count');
  const currentPageEl = document.getElementById('models-current-page');
  const totalPagesEl = document.getElementById('models-total-pages');
  const btnPrev = document.getElementById('models-btn-prev');
  const btnNext = document.getElementById('models-btn-next');

  const totalPages = Math.ceil(modelsTotalCount / modelsPageSize) || 1;

  if (rangeStart) rangeStart.textContent = start;
  if (rangeEnd) rangeEnd.textContent = end;
  if (totalCountEl) totalCountEl.textContent = modelsTotalCount;
  if (currentPageEl) currentPageEl.textContent = modelsPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = (modelsPage <= 1);
  if (btnNext) btnNext.disabled = (modelsPage >= totalPages || modelsTotalCount === 0);
};

export const openModelModal = async (model = null) => {
  const overlay = document.getElementById('model-modal-overlay');
  const card = document.getElementById('model-modal-card');
  const title = document.getElementById('model-modal-title');
  const form = document.getElementById('model-form');
  const saveBtn = document.getElementById('btn-save-model');

  if (!overlay || !card || !form) return;

  const canWrite = window.hasPermission('view-models', 'escribir');

  form.reset();

  const idInput = document.getElementById('model-form-id');
  const nombreInput = document.getElementById('model-form-nombre');
  const precioInput = document.getElementById('model-form-precio');
  const comisionConcInput = document.getElementById('model-form-comision-conc');
  const comisionV1Input = document.getElementById('model-form-comision-v1');
  const comisionV2Input = document.getElementById('model-form-comision-v2');
  const reglaInput = document.getElementById('model-form-regla');

  if (model) {
    title.textContent = canWrite ? 'Editar Modelo' : 'Detalles del Modelo';
    if (idInput) idInput.value = model.id;
    if (nombreInput) nombreInput.value = model.modelo || '';
    if (precioInput) precioInput.value = model.precio_sugerido ?? '';
    if (comisionConcInput) comisionConcInput.value = model.comision_concesionario ?? '';
    if (comisionV1Input) comisionV1Input.value = model.comision_vendedor1 ?? '';
    if (comisionV2Input) comisionV2Input.value = model.comision_vendedor2 ?? '';
    if (reglaInput) reglaInput.value = model.regla_comision || '';

    await populateModelSelects(model.producto_id, model.linea, model.familia);
  } else {
    title.textContent = 'Crear Modelo';
    if (idInput) idInput.value = '';
    await populateModelSelects();
  }

  // Handle read-only state for users without write permission
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

export const closeModelModal = () => {
  const overlay = document.getElementById('model-modal-overlay');
  const card = document.getElementById('model-modal-card');

  if (!overlay || !card) return;

  card.classList.remove('opacity-100', 'scale-100');
  card.classList.add('opacity-0', 'scale-95');
  overlay.classList.add('opacity-0');

  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 300);
};

export const saveModel = async (e) => {
  e.preventDefault();
  
  const canWrite = window.hasPermission('view-models', 'escribir');
  if (!canWrite) {
    showToast('No tienes permiso para guardar cambios.', false);
    return;
  }

  const idInput = document.getElementById('model-form-id');
  const nombreInput = document.getElementById('model-form-nombre');
  const productoSelect = document.getElementById('model-form-producto');
  const lineaSelect = document.getElementById('model-form-linea');
  const familiaSelect = document.getElementById('model-form-familia');
  const precioInput = document.getElementById('model-form-precio');
  const comisionConcInput = document.getElementById('model-form-comision-conc');
  const comisionV1Input = document.getElementById('model-form-comision-v1');
  const comisionV2Input = document.getElementById('model-form-comision-v2');
  const reglaInput = document.getElementById('model-form-regla');

  const id = idInput?.value ? parseInt(idInput.value, 10) : null;
  const modelo = nombreInput?.value?.trim();
  const producto_id = productoSelect?.value ? parseInt(productoSelect.value, 10) : null;
  const linea = lineaSelect?.value ? parseInt(lineaSelect.value, 10) : null;
  const familia = familiaSelect?.value ? parseInt(familiaSelect.value, 10) : null;
  const precio_sugerido = precioInput?.value ? parseFloat(precioInput.value) : null;
  const comision_concesionario = comisionConcInput?.value ? parseFloat(comisionConcInput.value) : null;
  const comision_vendedor1 = comisionV1Input?.value ? parseFloat(comisionV1Input.value) : null;
  const comision_vendedor2 = comisionV2Input?.value ? parseFloat(comisionV2Input.value) : null;
  const regla_comision = reglaInput?.value?.trim() || null;

  if (!modelo) {
    showToast('El nombre del modelo es obligatorio.', false);
    return;
  }

  if (!linea) {
    showToast('Debe seleccionar una línea.', false);
    return;
  }

  const payload = {
    modelo,
    producto_id,
    linea,
    familia,
    precio_sugerido,
    comision_concesionario,
    comision_vendedor1,
    comision_vendedor2,
    regla_comision
  };

  const saveBtn = document.getElementById('btn-save-model');
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
    let url = `${supabaseUrl}modelos`;
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

    showToast(id ? 'Modelo actualizado exitosamente.' : 'Modelo creado exitosamente.', true);
    closeModelModal();
    loadModels();
  } catch (err) {
    console.error("Error al guardar modelo:", err);
    showToast(`Error al guardar: ${err.message}`, false);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHtml;
    }
  }
};

export const editModel = (id) => {
  const model = modelsList.find(m => m.id === id);
  if (model) {
    openModelModal(model);
  } else {
    fetch(`${supabaseUrl}modelos?id=eq.${id}`, {
      headers: getHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) openModelModal(data[0]);
      })
      .catch(e => {
        console.error("Error cargando modelo:", e);
        showToast("No se pudo cargar el modelo seleccionado.", false);
      });
  }
};

export const deleteModel = (id) => {
  const canWrite = window.hasPermission('view-models', 'escribir');
  if (!canWrite) {
    showToast('No tienes permiso para eliminar registros.', false);
    return;
  }
  openDeleteModal(id, 'model');
};

export const initModelsModule = () => {
  const addBtn = document.getElementById('btn-add-model');
  const closeBtn = document.getElementById('btn-close-model-modal');
  const cancelBtn = document.getElementById('btn-cancel-model');
  const overlay = document.getElementById('model-modal-overlay');
  const form = document.getElementById('model-form');
  const searchInput = document.getElementById('models-search');
  const btnPrev = document.getElementById('models-btn-prev');
  const btnNext = document.getElementById('models-btn-next');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!window.hasPermission('view-models', 'escribir')) {
        showToast('No tienes permiso para crear modelos.', false);
        return;
      }
      openModelModal();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModelModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModelModal);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModelModal();
    });
  }

  if (form) {
    form.addEventListener('submit', saveModel);
  }

  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        modelsSearchQuery = e.target.value.trim();
        modelsPage = 1;
        loadModels();
      }, 350);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (modelsPage > 1) {
        modelsPage--;
        loadModels();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(modelsTotalCount / modelsPageSize);
      if (modelsPage < totalPages) {
        modelsPage++;
        loadModels();
      }
    });
  }

  // Expose global functions for onclick handlers
  window.editModel = editModel;
  window.deleteModel = deleteModel;
};
