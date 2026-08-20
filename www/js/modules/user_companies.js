import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';
import { usersList } from './users.js';

export let currentUserIdForCompanies = null;
let userCompaniesList = [];
let cachedEmpresas = [];
let cachedSucursales = [];
let userCompaniesSearchQuery = '';

const fmtDate = (iso) => {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

// ─── Load Empresas for dropdown ───────────────────────────────────────────────
export const loadEmpresasForUserSelect = async (selectedEmpresaId = null) => {
  const selectEl = document.getElementById('user-company-form-empresa');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="" disabled selected>Cargando empresas...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();
    const res = await fetch(`${supabaseUrl}empresa?order=razon.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("Error al cargar empresas");
    cachedEmpresas = await res.json();

    selectEl.innerHTML = '<option value="" disabled selected>Seleccione una Empresa</option>';

    cachedEmpresas.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.codigo ? '[' + emp.codigo + '] ' : ''}${emp.razon}`;
      if (selectedEmpresaId && String(selectedEmpresaId) === String(emp.id)) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });

    // Populate sucursales based on selected empresa
    loadSucursalesForUserSelect(selectedEmpresaId);
  } catch (err) {
    console.error("Error loading empresas select:", err);
    selectEl.innerHTML = '<option value="" disabled selected>Error al cargar empresas</option>';
  }
};

// ─── Load Sucursales for dropdown based on Empresa ────────────────────────────
export const loadSucursalesForUserSelect = async (empresaId, selectedSucursalId = null) => {
  const selectEl = document.getElementById('user-company-form-sucursal');
  if (!selectEl) return;

  if (!empresaId) {
    selectEl.innerHTML = '<option value="">Todas las sucursales (Nivel Empresa)</option>';
    selectEl.disabled = false;
    return;
  }

  selectEl.innerHTML = '<option value="">Cargando sucursales...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();
    const res = await fetch(`${supabaseUrl}sucursales?empresa_id=eq.${empresaId}&order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("Error al cargar sucursales");
    cachedSucursales = await res.json();

    selectEl.innerHTML = '<option value="">Todas las sucursales (Nivel Empresa)</option>';

    cachedSucursales.forEach(suc => {
      const opt = document.createElement('option');
      opt.value = suc.id;
      opt.textContent = suc.nombre;
      if (selectedSucursalId && String(selectedSucursalId) === String(suc.id)) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  } catch (err) {
    console.error("Error loading sucursales select:", err);
    selectEl.innerHTML = '<option value="">Todas las sucursales (Nivel Empresa)</option>';
  }
};

// ─── Load usuarios_empresas for user ──────────────────────────────────────────
export const loadUserCompanies = async (userId) => {
  const loadingEl = document.getElementById('user-companies-loading');
  const tableBody = document.getElementById('user-companies-table-body');
  const emptyEl = document.getElementById('user-companies-empty');
  const countEl = document.getElementById('user-companies-count');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();

    // Query with foreign joins to empresa and sucursales
    // Check if usuario_id or user_id or without filter
    let queryUrl = `${supabaseUrl}usuarios_empresas?select=*,empresa:empresa_id(id,razon,codigo),sucursal:sucursal_id(id,nombre)&order=id.desc`;
    if (userId) {
      // Try filtering by usuario_id, fallback if column is named differently
      queryUrl += `&or=(usuario_id.eq.${userId},usuario_id.is.null)`;
    }

    let res = await fetch(queryUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    // If or filter fails because usuario_id does not exist, query without it
    if (!res.ok) {
      const fallbackUrl = `${supabaseUrl}usuarios_empresas?select=*,empresa:empresa_id(id,razon,codigo),sucursal:sucursal_id(id,nombre)&order=id.desc`;
      res = await fetch(fallbackUrl, {
        method: 'GET',
        headers: getHeaders()
      });
    }

    if (!res.ok) throw new Error("No se pudieron cargar las empresas del usuario.");

    const rawData = await res.json();
    // If usuario_id is present on rows, filter by userId
    userCompaniesList = rawData.filter(item => {
      if (item.usuario_id !== undefined && item.usuario_id !== null) {
        return item.usuario_id === userId;
      }
      if (item.user_id !== undefined && item.user_id !== null) {
        return item.user_id === userId;
      }
      return true; // Return all if no user column
    });

    renderUserCompanies();
  } catch (err) {
    console.error("Error loading user companies:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando empresas del usuario.'}
        </td>
      </tr>
    `;
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

// ─── Render filtered user companies ──────────────────────────────────────────
export const renderUserCompanies = () => {
  const tableBody = document.getElementById('user-companies-table-body');
  const emptyEl = document.getElementById('user-companies-empty');
  const countEl = document.getElementById('user-companies-count');

  if (!tableBody) return;
  tableBody.innerHTML = '';

  let filtered = userCompaniesList;
  if (userCompaniesSearchQuery) {
    const q = userCompaniesSearchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const empRazon = item.empresa ? (item.empresa.razon || '').toLowerCase() : '';
      const empCod = item.empresa ? (item.empresa.codigo || '').toLowerCase() : '';
      const sucNombre = item.sucursal ? (item.sucursal.nombre || '').toLowerCase() : '';
      return empRazon.includes(q) || empCod.includes(q) || sucNombre.includes(q);
    });
  }

  if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'asignación' : 'asignaciones'}`;

  if (filtered.length === 0) {
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  const canWrite = window.hasPermission('view-users', 'escribir');

  filtered.forEach(uc => {
    const emp = uc.empresa || {};
    const suc = uc.sucursal || {};

    const lecturaBadge = uc.lectura
      ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Sí</span>`
      : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">No</span>`;

    const edicionBadge = uc.edicion
      ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">Sí</span>`
      : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">No</span>`;

    const btnEditar = `
      <button onclick="editUserCompany(${uc.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Permisos">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
      </button>
    `;

    const btnEliminar = `
      <button onclick="deleteUserCompany(${uc.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Asignación">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    `;

    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200 text-sm';
    row.innerHTML = `
      <td class="px-4 py-3 text-left whitespace-nowrap">
        <div class="flex items-center gap-1.5">
          ${canWrite ? `${btnEditar}${btnEliminar}` : '<span class="text-slate-400 text-xs italic">Solo lectura</span>'}
        </div>
      </td>
      <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${uc.id}</td>
      <td class="px-4 py-3 font-medium text-slate-800 dark:text-white">
        <span class="font-semibold">${escapeHtml(emp.razon || `Empresa #${uc.empresa_id}`)}</span>
        ${emp.codigo ? `<span class="block text-xs text-slate-400 font-mono">${escapeHtml(emp.codigo)}</span>` : ''}
      </td>
      <td class="px-4 py-3 text-slate-650 dark:text-slate-300">
        ${uc.sucursal_id ? `<span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${escapeHtml(suc.nombre || `Sucursal #${uc.sucursal_id}`)}</span>` : '<span class="text-xs text-slate-400 italic font-medium">Todas (Nivel Empresa)</span>'}
      </td>
      <td class="px-4 py-3 text-center">${lecturaBadge}</td>
      <td class="px-4 py-3 text-center">${edicionBadge}</td>
      <td class="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">${fmtDate(uc.created_at)}</td>
    `;
    tableBody.appendChild(row);
  });
};

// ─── Open User Companies Modal ───────────────────────────────────────────────
export const openUserCompaniesModal = async (userId) => {
  currentUserIdForCompanies = userId;
  userCompaniesSearchQuery = '';

  const searchInput = document.getElementById('user-companies-search');
  if (searchInput) searchInput.value = '';

  const user = usersList.find(u => u.id === userId);
  const userName = user ? user.nombre : `Usuario #${userId}`;

  const titleEl = document.getElementById('user-companies-modal-title');
  if (titleEl) titleEl.textContent = `Empresas y Sucursales: ${userName}`;

  const modalOverlay = document.getElementById('user-companies-modal-overlay');
  const modalCard = document.getElementById('user-companies-modal-card');
  if (!modalOverlay || !modalCard) return;

  modalOverlay.classList.remove('hidden');
  modalOverlay.offsetHeight;
  modalOverlay.classList.remove('opacity-0');
  modalOverlay.classList.add('opacity-100');
  modalCard.classList.remove('scale-95', 'opacity-0');
  modalCard.classList.add('scale-100', 'opacity-100');

  const canWrite = window.hasPermission('view-users', 'escribir');
  const btnAdd = document.getElementById('btn-add-user-company');
  if (btnAdd) btnAdd.style.display = canWrite ? 'inline-flex' : 'none';

  loadUserCompanies(userId);
};

// ─── Init User Companies Module ──────────────────────────────────────────────
export const initUserCompaniesModule = () => {
  const modalOverlay = document.getElementById('user-companies-modal-overlay');
  const modalCard = document.getElementById('user-companies-modal-card');
  const btnCloseModal = document.getElementById('btn-close-user-companies-modal');
  const btnAddCompany = document.getElementById('btn-add-user-company');

  const formModalOverlay = document.getElementById('add-user-company-modal-overlay');
  const formModalCard = document.getElementById('add-user-company-modal-card');
  const btnCloseFormModal = document.getElementById('btn-close-add-user-company-modal');
  const btnCancelFormModal = document.getElementById('btn-cancel-add-user-company-modal');
  const companyForm = document.getElementById('add-user-company-form');

  const closeMainModal = () => {
    if (!modalOverlay || !modalCard) return;
    modalOverlay.classList.remove('opacity-100');
    modalOverlay.classList.add('opacity-0');
    modalCard.classList.remove('scale-100', 'opacity-100');
    modalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modalOverlay.classList.add('hidden'), 300);
  };

  const openFormModal = () => {
    if (!formModalOverlay || !formModalCard) return;
    formModalOverlay.classList.remove('hidden');
    formModalOverlay.offsetHeight;
    formModalOverlay.classList.remove('opacity-0');
    formModalOverlay.classList.add('opacity-100');
    formModalCard.classList.remove('scale-95', 'opacity-0');
    formModalCard.classList.add('scale-100', 'opacity-100');
  };

  const closeFormModal = () => {
    if (!formModalOverlay || !formModalCard) return;
    formModalOverlay.classList.remove('opacity-100');
    formModalOverlay.classList.add('opacity-0');
    formModalCard.classList.remove('scale-100', 'opacity-100');
    formModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => formModalOverlay.classList.add('hidden'), 300);
  };

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeMainModal);

  if (btnAddCompany) {
    btnAddCompany.addEventListener('click', () => {
      document.getElementById('user-company-form-id').value = '';
      document.getElementById('user-company-form-lectura').checked = true;
      document.getElementById('user-company-form-edicion').checked = false;
      document.getElementById('add-user-company-modal-title').textContent = 'Asignar Empresa / Sucursal';

      loadEmpresasForUserSelect();
      openFormModal();
    });
  }

  if (btnCloseFormModal) btnCloseFormModal.addEventListener('click', closeFormModal);
  if (btnCancelFormModal) btnCancelFormModal.addEventListener('click', closeFormModal);

  // Empresa select change -> update Sucursales
  const empresaSelect = document.getElementById('user-company-form-empresa');
  if (empresaSelect) {
    empresaSelect.addEventListener('change', (e) => {
      loadSucursalesForUserSelect(e.target.value);
    });
  }

  const searchInput = document.getElementById('user-companies-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      userCompaniesSearchQuery = e.target.value.trim();
      renderUserCompanies();
    });
  }

  // ── Form Submit: Add / Edit User Company ───────────────────────────────────
  if (companyForm) {
    companyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('user-company-form-id').value;
      const empresa_id = parseInt(document.getElementById('user-company-form-empresa').value, 10);
      const sucursalVal = document.getElementById('user-company-form-sucursal').value;
      const sucursal_id = sucursalVal ? parseInt(sucursalVal, 10) : null;
      const lectura = document.getElementById('user-company-form-lectura').checked;
      const edicion = document.getElementById('user-company-form-edicion').checked;

      if (!empresa_id || isNaN(empresa_id)) {
        showToast("Por favor, seleccione una empresa válida.", false);
        return;
      }

      const saveBtn = document.getElementById('btn-save-user-company');
      const origText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const payload = {
          empresa_id: empresa_id,
          sucursal_id: sucursal_id,
          lectura: lectura,
          edicion: edicion
        };

        // If usuario_id exists in schema or needed, pass it
        if (currentUserIdForCompanies) {
          payload.usuario_id = currentUserIdForCompanies;
        }

        let url = `${supabaseUrl}usuarios_empresas`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}usuarios_empresas?id=eq.${id}`;
          method = 'PATCH';
          delete payload.usuario_id;
        }

        let res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        // If error due to usuario_id not in schema, retry without it
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          if (errJson.code === "PGRST204" && payload.usuario_id) {
            delete payload.usuario_id;
            res = await fetch(url, {
              method: method,
              headers: getHeaders(),
              body: JSON.stringify(payload)
            });
          }
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Fallo al guardar la asignación de empresa/sucursal.");
        }

        showToast(id ? "Asignación actualizada con éxito." : "Empresa/Sucursal asignada con éxito.", true);
        closeFormModal();
        loadUserCompanies(currentUserIdForCompanies);
      } catch (err) {
        console.error("Error saving user company:", err);
        showToast(err.message || "Error al guardar.", false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origText;
      }
    });
  }

  window.openUserCompaniesModal = openUserCompaniesModal;

  window.editUserCompany = (id) => {
    const item = userCompaniesList.find(uc => uc.id === id);
    if (!item) return;

    document.getElementById('user-company-form-id').value = item.id;
    document.getElementById('user-company-form-lectura').checked = item.lectura === true;
    document.getElementById('user-company-form-edicion').checked = item.edicion === true;
    document.getElementById('add-user-company-modal-title').textContent = 'Editar Asignación';

    loadEmpresasForUserSelect(item.empresa_id);
    if (item.empresa_id) {
      loadSucursalesForUserSelect(item.empresa_id, item.sucursal_id);
    }
    openFormModal();
  };

  window.deleteUserCompany = (id) => openDeleteModal(id, 'user_company');
};
