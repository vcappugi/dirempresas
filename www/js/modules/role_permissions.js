import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';
import { rolesList } from './roles.js';

export let currentRoleIdForPermissions = null;
let permissionsList = [];
let permissionsViewMode = 'cards'; // 'cards' or 'list'
let objetosCatalog = [];

export const loadRolePermissions = async () => {
  const loadingEl = document.getElementById('role-permissions-loading');
  const emptyEl = document.getElementById('role-permissions-empty');
  const cardsGrid = document.getElementById('role-permissions-cards-grid');
  const listContainer = document.getElementById('role-permissions-list-container');
  const tableBody = document.getElementById('role-permissions-table-body');

  if (!cardsGrid || !tableBody) return;

  const canWrite = window.hasPermission('view-roles', 'escribir');
  const addBtn = document.getElementById('btn-add-role-permission');
  if (addBtn) {
    addBtn.style.display = canWrite ? 'inline-flex' : 'none';
  }

  loadingEl?.classList.remove('hidden');
  cardsGrid.innerHTML = '';
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!currentRoleIdForPermissions) {
    loadingEl?.classList.add('hidden');
    return;
  }

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  try {
    const url = `${supabaseUrl}roles_permision?select=*,objetos:objeto_id(*)&rol_id=eq.${currentRoleIdForPermissions}&order=id.asc`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudo obtener la lista de permisos del rol.");

    permissionsList = await res.json();

    if (permissionsList.length === 0) {
      emptyEl?.classList.remove('hidden');
    } else {
      renderRolePermissions();
    }
  } catch (err) {
    console.error("Error loading role permissions:", err);
    showToast(err.message || "Error al cargar los permisos.", false);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const renderRolePermissions = () => {
  const cardsGrid = document.getElementById('role-permissions-cards-grid');
  const tableBody = document.getElementById('role-permissions-table-body');
  const canWrite = window.hasPermission('view-roles', 'escribir');

  if (!cardsGrid || !tableBody) return;

  cardsGrid.innerHTML = '';
  tableBody.innerHTML = '';

  permissionsList.forEach(perm => {
    const objetoName = perm.objetos ? escapeHtml(perm.objetos.nombre) : `<span class="text-slate-400 italic">ID Objeto: ${perm.objeto_id}</span>`;
    
    const readBadge = perm.leer
      ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Lectura Habilitada</span>`
      : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-450">Sin Lectura</span>`;

    const writeBadge = perm.escribir
      ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 font-medium font-semibold">Escritura Habilitada</span>`
      : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-450">Sin Escritura</span>`;

    const statusBadge = perm.activo
      ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450 font-semibold">Regla Activa</span>`
      : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 font-semibold">Regla Inactiva</span>`;

    // 1. Render Card View
    const card = document.createElement('div');
    card.className = "flex flex-col justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 hover:shadow-md transition-all duration-300";
    
    const actionRow = canWrite
      ? `<div class="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
          <button onclick="editRolePermission(${perm.id})" class="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-semibold px-2 py-1 rounded-lg hover:bg-brand/10 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg> Editar
          </button>
          <button onclick="deleteRolePermission(${perm.id})" class="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-650 font-semibold px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg> Eliminar
          </button>
        </div>`
      : '';

    card.innerHTML = `
      <div class="space-y-2">
        <h4 class="font-display font-bold text-slate-800 dark:text-white text-base">${objetoName}</h4>
        <div class="flex flex-wrap gap-2 pt-1">
          ${readBadge}
          ${writeBadge}
          ${statusBadge}
        </div>
      </div>
      ${actionRow}
    `;
    cardsGrid.appendChild(card);

    // 2. Render Table Row
    const actionCell = canWrite
      ? `<td class="px-6 py-4 text-right space-x-1">
          <button onclick="editRolePermission(${perm.id})" class="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-semibold px-2 py-1.5 rounded-lg hover:bg-brand/10 transition-colors" title="Editar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
          </button>
          <button onclick="deleteRolePermission(${perm.id})" class="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-650 font-semibold px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Eliminar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </td>`
      : '<td class="px-6 py-4"></td>';

    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
    row.innerHTML = `
      <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${objetoName}</td>
      <td class="px-6 py-4 text-center">${perm.leer ? '✅ Sí' : '❌ No'}</td>
      <td class="px-6 py-4 text-center">${perm.escribir ? '✅ Sí' : '❌ No'}</td>
      <td class="px-6 py-4 text-center">${statusBadge}</td>
      ${actionCell}
    `;
    tableBody.appendChild(row);
  });
};

const loadObjetosCatalog = async () => {
  if (objetosCatalog.length > 0) return;
  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }
    const res = await fetch(`${supabaseUrl}objetos?order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      objetosCatalog = await res.json();
    }
  } catch (err) {
    console.error("Error loading objects catalog:", err);
  }
};

const loadObjetosForSelect = async (selectedObjetoId = null) => {
  await loadObjetosCatalog();
  const selectEl = document.getElementById('role-permission-form-objeto');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Seleccione un Objeto / Vista...</option>' +
    objetosCatalog.map(obj => `<option value="${obj.id}">${escapeHtml(obj.nombre)}</option>`).join('');

  if (selectedObjetoId !== null) {
    selectEl.value = selectedObjetoId;
  } else {
    selectEl.value = '';
  }
};

export const initRolePermissionsModule = () => {
  const listModalOverlay = document.getElementById('role-permissions-modal-overlay');
  const listModalCard = document.getElementById('role-permissions-modal-card');
  const btnCloseListModal = document.getElementById('btn-close-role-permissions-modal');
  const btnAddPermission = document.getElementById('btn-add-role-permission');

  const btnViewCards = document.getElementById('btn-permissions-view-cards');
  const btnViewList = document.getElementById('btn-permissions-view-list');

  const formModalOverlay = document.getElementById('role-permission-modal-overlay');
  const formModalCard = document.getElementById('role-permission-modal-card');
  const btnCloseFormModal = document.getElementById('btn-close-role-permission-modal');
  const btnCancelFormModal = document.getElementById('btn-cancel-role-permission-modal');
  const permissionForm = document.getElementById('role-permission-form');

  const closeListModal = () => {
    if (!listModalOverlay || !listModalCard) return;
    listModalOverlay.classList.remove('opacity-100');
    listModalOverlay.classList.add('opacity-0');
    listModalCard.classList.remove('scale-100', 'opacity-100');
    listModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      listModalOverlay.classList.add('hidden');
      currentRoleIdForPermissions = null;
    }, 300);
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
    setTimeout(() => {
      formModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnCloseListModal) btnCloseListModal.addEventListener('click', closeListModal);

  if (btnViewCards && btnViewList) {
    btnViewCards.addEventListener('click', () => {
      permissionsViewMode = 'cards';
      btnViewCards.className = "px-4 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 shadow-sm text-brand transition-all flex items-center gap-1.5";
      btnViewList.className = "px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all flex items-center gap-1.5";
      document.getElementById('role-permissions-cards-grid')?.classList.remove('hidden');
      document.getElementById('role-permissions-list-container')?.classList.add('hidden');
    });

    btnViewList.addEventListener('click', () => {
      permissionsViewMode = 'list';
      btnViewList.className = "px-4 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 shadow-sm text-brand transition-all flex items-center gap-1.5";
      btnViewCards.className = "px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all flex items-center gap-1.5";
      document.getElementById('role-permissions-cards-grid')?.classList.add('hidden');
      document.getElementById('role-permissions-list-container')?.classList.remove('hidden');
    });
  }

  if (btnAddPermission) {
    btnAddPermission.addEventListener('click', async () => {
      document.getElementById('role-permission-form-id').value = '';
      document.getElementById('role-permission-form-leer').checked = true;
      document.getElementById('role-permission-form-escribir').checked = false;
      document.getElementById('role-permission-form-activo').checked = true;

      await loadObjetosForSelect();
      document.getElementById('role-permission-form-objeto').disabled = false;
      document.getElementById('role-permission-modal-title').textContent = 'Añadir Permiso';
      openFormModal();
    });
  }

  if (btnCloseFormModal) btnCloseFormModal.addEventListener('click', closeFormModal);
  if (btnCancelFormModal) btnCancelFormModal.addEventListener('click', closeFormModal);

  window.editRolePermission = async (id) => {
    const perm = permissionsList.find(p => p.id === id);
    if (!perm) return;

    document.getElementById('role-permission-form-id').value = perm.id;
    document.getElementById('role-permission-form-leer').checked = perm.leer === true;
    document.getElementById('role-permission-form-escribir').checked = perm.escribir === true;
    document.getElementById('role-permission-form-activo').checked = perm.activo === true;

    await loadObjetosForSelect(perm.objeto_id);
    document.getElementById('role-permission-form-objeto').disabled = true; // Cannot modify object for existing permission rule

    document.getElementById('role-permission-modal-title').textContent = 'Editar Permiso';
    openFormModal();
  };

  window.deleteRolePermission = (id) => {
    openDeleteModal(id, 'role_permission');
  };

  if (permissionForm) {
    permissionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('role-permission-form-id').value;
      const objeto_id = parseInt(document.getElementById('role-permission-form-objeto').value, 10);
      const leer = document.getElementById('role-permission-form-leer').checked;
      const escribir = document.getElementById('role-permission-form-escribir').checked;
      const activo = document.getElementById('role-permission-form-activo').checked;

      if (!objeto_id) {
        showToast("Por favor, seleccione un objeto/vista.", false);
        return;
      }

      // Check for duplicate object assignment in create mode
      if (!id) {
        const isDuplicate = permissionsList.some(p => p.objeto_id === objeto_id);
        if (isDuplicate) {
          showToast("Este objeto ya tiene una regla de permiso configurada en este rol.", false);
          return;
        }
      }

      const saveBtn = document.getElementById('btn-save-role-permission-modal');
      const originalText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Guardando...';

      try {
        const payload = {
          rol_id: currentRoleIdForPermissions,
          objeto_id,
          leer,
          escribir,
          activo
        };

        let method = 'POST';
        let url = `${supabaseUrl}roles_permision`;

        if (id) {
          method = 'PATCH';
          url = `${supabaseUrl}roles_permision?id=eq.${id}`;
        }

        const res = await fetch(url, {
          method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Fallo al guardar la regla de permiso en Supabase.");

        showToast(id ? "Permiso actualizado con éxito." : "Permiso creado con éxito.", true);
        closeFormModal();
        loadRolePermissions();
      } catch (err) {
        console.error("Save permission error:", err);
        showToast(err.message || "Error al guardar el permiso.", false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    });
  }
  window.openRolePermissionsModal = openRolePermissionsModal;
};

export const openRolePermissionsModal = async (roleId) => {
  const overlay = document.getElementById('role-permissions-modal-overlay');
  const card = document.getElementById('role-permissions-modal-card');
  const badgeContainer = document.getElementById('active-role-permission-badge-container');

  if (!overlay || !card) return;

  currentRoleIdForPermissions = roleId;

  // Set role badge name
  if (badgeContainer) {
    const role = rolesList.find(r => r.id === roleId);
    const roleName = role ? role.nombre : `ID: ${roleId}`;
    badgeContainer.innerHTML = `<span class="px-4 py-1.5 text-xs font-bold rounded-xl bg-brand/10 text-brand border border-brand/20 uppercase tracking-wider">${escapeHtml(roleName)}</span>`;
  }

  overlay.classList.remove('hidden');
  overlay.offsetHeight;
  overlay.classList.remove('opacity-0');
  overlay.classList.add('opacity-100');
  card.classList.remove('scale-95', 'opacity-0');
  card.classList.add('scale-100', 'opacity-100');

  // Trigger permission fetch
  loadRolePermissions();
};
