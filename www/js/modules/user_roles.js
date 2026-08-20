import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';
import { usersList } from './users.js';

export let currentUserIdForRoles = null;
let userRolesList = [];
let availableRoles = [];
let userRolesSearchQuery = '';

const fmtDate = (iso) => {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

// ─── Load available roles for the select dropdown ─────────────────────────────
const loadAvailableRolesSelect = async () => {
  const selectEl = document.getElementById('add-user-role-select');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="" disabled selected>Cargando roles...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();
    const res = await fetch(`${supabaseUrl}roles?activo=eq.true&order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("Error al cargar roles");
    availableRoles = await res.json();

    selectEl.innerHTML = '<option value="" disabled selected>Seleccione un Rol</option>';

    // IDs of roles already assigned to this user
    const assignedRoleIds = userRolesList.map(ur => ur.roles_id);

    availableRoles.forEach(role => {
      const isAssigned = assignedRoleIds.includes(role.id);
      const opt = document.createElement('option');
      opt.value = role.id;
      opt.textContent = `${role.nombre}${role.tipo ? ' (' + role.tipo + ')' : ''}${isAssigned ? ' — [Ya asignado]' : ''}`;
      if (isAssigned) {
        opt.disabled = true;
      }
      selectEl.appendChild(opt);
    });
  } catch (err) {
    console.error("Error loading roles select:", err);
    selectEl.innerHTML = '<option value="" disabled selected>Error al cargar roles</option>';
  }
};

// ─── Load user_roles for current user ─────────────────────────────────────────
export const loadUserRoles = async (userId) => {
  const loadingEl = document.getElementById('user-roles-loading');
  const tableBody = document.getElementById('user-roles-table-body');
  const emptyEl = document.getElementById('user-roles-empty');
  const countEl = document.getElementById('user-roles-count');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();

    const res = await fetch(`${supabaseUrl}user_roles?user_id=eq.${userId}&select=*,roles:roles_id(*)&order=id.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar los roles del usuario.");

    userRolesList = await res.json();

    renderUserRoles();
  } catch (err) {
    console.error("Error loading user roles:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando roles del usuario.'}
        </td>
      </tr>
    `;
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

// ─── Render filtered user roles ───────────────────────────────────────────────
export const renderUserRoles = () => {
  const tableBody = document.getElementById('user-roles-table-body');
  const emptyEl = document.getElementById('user-roles-empty');
  const countEl = document.getElementById('user-roles-count');

  if (!tableBody) return;
  tableBody.innerHTML = '';

  let filtered = userRolesList;
  if (userRolesSearchQuery) {
    const q = userRolesSearchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const roleName = item.roles ? (item.roles.nombre || '').toLowerCase() : '';
      const roleTipo = item.roles ? (item.roles.tipo || '').toLowerCase() : '';
      return roleName.includes(q) || roleTipo.includes(q);
    });
  }

  if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'rol asignado' : 'roles asignados'}`;

  if (filtered.length === 0) {
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  const canWrite = window.hasPermission('view-users', 'escribir');

  filtered.forEach(ur => {
    const role = ur.roles || {};
    const roleStatusBadge = role.activo
      ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Activo</span>`
      : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inactivo</span>`;

    const btnEliminar = `
      <button onclick="deleteUserRole(${ur.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Asignación de Rol">
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
          ${canWrite ? btnEliminar : '<span class="text-slate-400 text-xs italic">Solo lectura</span>'}
        </div>
      </td>
      <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${ur.id}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          ${escapeHtml(role.nombre || `Rol #${ur.roles_id}`)}
        </span>
      </td>
      <td class="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">${escapeHtml(role.tipo || '-')}</td>
      <td class="px-4 py-3">${roleStatusBadge}</td>
      <td class="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">${fmtDate(ur.created_at)}</td>
    `;
    tableBody.appendChild(row);
  });
};

// ─── Open User Roles Modal ───────────────────────────────────────────────────
export const openUserRolesModal = async (userId) => {
  currentUserIdForRoles = userId;
  userRolesSearchQuery = '';

  const searchInput = document.getElementById('user-roles-search');
  if (searchInput) searchInput.value = '';

  const user = usersList.find(u => u.id === userId);
  const userName = user ? user.nombre : `Usuario #${userId}`;

  const titleEl = document.getElementById('user-roles-modal-title');
  if (titleEl) titleEl.textContent = `Roles del Usuario: ${userName}`;

  const modalOverlay = document.getElementById('user-roles-modal-overlay');
  const modalCard = document.getElementById('user-roles-modal-card');
  if (!modalOverlay || !modalCard) return;

  modalOverlay.classList.remove('hidden');
  modalOverlay.offsetHeight;
  modalOverlay.classList.remove('opacity-0');
  modalOverlay.classList.add('opacity-100');
  modalCard.classList.remove('scale-95', 'opacity-0');
  modalCard.classList.add('scale-100', 'opacity-100');

  const canWrite = window.hasPermission('view-users', 'escribir');
  const btnAdd = document.getElementById('btn-add-user-role');
  if (btnAdd) btnAdd.style.display = canWrite ? 'inline-flex' : 'none';

  loadUserRoles(userId);
};

// ─── Init User Roles Module ──────────────────────────────────────────────────
export const initUserRolesModule = () => {
  const modalOverlay = document.getElementById('user-roles-modal-overlay');
  const modalCard = document.getElementById('user-roles-modal-card');
  const btnCloseModal = document.getElementById('btn-close-user-roles-modal');
  const btnAddRole = document.getElementById('btn-add-user-role');

  const addModalOverlay = document.getElementById('add-user-role-modal-overlay');
  const addModalCard = document.getElementById('add-user-role-modal-card');
  const btnCloseAddModal = document.getElementById('btn-close-add-user-role-modal');
  const btnCancelAddModal = document.getElementById('btn-cancel-add-user-role-modal');
  const addForm = document.getElementById('add-user-role-form');

  const closeMainModal = () => {
    if (!modalOverlay || !modalCard) return;
    modalOverlay.classList.remove('opacity-100');
    modalOverlay.classList.add('opacity-0');
    modalCard.classList.remove('scale-100', 'opacity-100');
    modalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modalOverlay.classList.add('hidden'), 300);
  };

  const openAddModal = () => {
    if (!addModalOverlay || !addModalCard) return;
    addModalOverlay.classList.remove('hidden');
    addModalOverlay.offsetHeight;
    addModalOverlay.classList.remove('opacity-0');
    addModalOverlay.classList.add('opacity-100');
    addModalCard.classList.remove('scale-95', 'opacity-0');
    addModalCard.classList.add('scale-100', 'opacity-100');
    loadAvailableRolesSelect();
  };

  const closeAddModal = () => {
    if (!addModalOverlay || !addModalCard) return;
    addModalOverlay.classList.remove('opacity-100');
    addModalOverlay.classList.add('opacity-0');
    addModalCard.classList.remove('scale-100', 'opacity-100');
    addModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => addModalOverlay.classList.add('hidden'), 300);
  };

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeMainModal);
  if (btnAddRole) btnAddRole.addEventListener('click', openAddModal);

  if (btnCloseAddModal) btnCloseAddModal.addEventListener('click', closeAddModal);
  if (btnCancelAddModal) btnCancelAddModal.addEventListener('click', closeAddModal);

  const searchInput = document.getElementById('user-roles-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      userRolesSearchQuery = e.target.value.trim();
      renderUserRoles();
    });
  }

  // ── Form Submit: Assign Role ───────────────────────────────────────────────
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const roleSelect = document.getElementById('add-user-role-select');
      const roles_id = roleSelect ? parseInt(roleSelect.value, 10) : null;

      if (!roles_id || isNaN(roles_id)) {
        showToast("Por favor, seleccione un rol válido.", false);
        return;
      }

      if (!currentUserIdForRoles) {
        showToast("No se ha identificado el usuario.", false);
        return;
      }

      const saveBtn = document.getElementById('btn-save-user-role');
      const origText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Asignando...
      `;

      try {
        const payload = {
          user_id: currentUserIdForRoles,
          roles_id: roles_id
        };

        const res = await fetch(`${supabaseUrl}user_roles`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Fallo al asignar el rol al usuario.");
        }

        showToast("Rol asignado con éxito.", true);
        closeAddModal();
        loadUserRoles(currentUserIdForRoles);
      } catch (err) {
        console.error("Error assigning user role:", err);
        showToast(err.message || "Error al asignar rol.", false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origText;
      }
    });
  }

  window.openUserRolesModal = openUserRolesModal;
  window.deleteUserRole = (id) => openDeleteModal(id, 'user_role');
};
