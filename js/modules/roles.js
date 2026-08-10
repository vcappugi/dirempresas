import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let rolesPage = 1;
const rolesPageSize = 5;
let rolesSearchQuery = "";
let rolesTotalCount = 0;
let rolesList = [];

export const loadRoles = async () => {
  const loadingEl = document.getElementById('roles-loading');
  const tableBody = document.getElementById('roles-table-body');
  const emptyEl = document.getElementById('roles-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (rolesPage - 1) * rolesPageSize;
  const end = start + rolesPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}roles`;

    if (rolesSearchQuery) {
      const encSearch = encodeURIComponent(rolesSearchQuery);
      queryUrl += `?or=(nombre.ilike.*${encSearch}*,tipo.ilike.*${encSearch}*)&order=id.asc`;
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
    
    rolesList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        rolesTotalCount = parseInt(parts[1], 10);
      }
    } else {
      rolesTotalCount = rolesList.length;
    }

    if (rolesList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateRolesPaginationUI(0, 0);
    } else {
      rolesList.forEach(role => {
        const statusBadge = role.activo
          ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Activo</span>`
          : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inactivo</span>`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${escapeHtml(role.nombre)}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-400">${escapeHtml(role.tipo)}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            <button onclick="editRole(${role.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
            <button onclick="deleteRole(${role.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
      updateRolesPaginationUI(start + 1, start + rolesList.length);
    }
  } catch (err) {
    console.error("Error loading roles:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando roles.'}
        </td>
      </tr>
    `;
    updateRolesPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateRolesPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('roles-range-start');
  const rangeEndEl = document.getElementById('roles-range-end');
  const totalCountEl = document.getElementById('roles-total-count');
  const currentPageEl = document.getElementById('roles-current-page');
  const totalPagesEl = document.getElementById('roles-total-pages');
  const btnPrev = document.getElementById('roles-btn-prev');
  const btnNext = document.getElementById('roles-btn-next');

  const totalPages = Math.ceil(rolesTotalCount / rolesPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = rolesTotalCount;
  if (currentPageEl) currentPageEl.textContent = rolesPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = rolesPage <= 1;
  if (btnNext) btnNext.disabled = rolesPage >= totalPages;
};

export const initRolesModule = () => {
  const roleModalOverlay = document.getElementById('role-modal-overlay');
  const roleModalCard = document.getElementById('role-modal-card');
  const btnCloseRoleModal = document.getElementById('btn-close-role-modal');
  const btnCancelRoleModal = document.getElementById('btn-cancel-role-modal');
  const btnAddRole = document.getElementById('btn-add-role');
  const roleForm = document.getElementById('role-form');

  const openRoleModal = () => {
    if (!roleModalOverlay || !roleModalCard) return;
    roleModalOverlay.classList.remove('hidden');
    roleModalOverlay.offsetHeight;
    roleModalOverlay.classList.remove('opacity-0');
    roleModalOverlay.classList.add('opacity-100');
    roleModalCard.classList.remove('scale-95', 'opacity-0');
    roleModalCard.classList.add('scale-100', 'opacity-100');
  };

  const closeRoleModal = () => {
    if (!roleModalOverlay || !roleModalCard) return;
    roleModalOverlay.classList.remove('opacity-100');
    roleModalOverlay.classList.add('opacity-0');
    roleModalCard.classList.remove('scale-100', 'opacity-100');
    roleModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      roleModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnAddRole) {
    btnAddRole.addEventListener('click', () => {
      document.getElementById('role-form-id').value = '';
      document.getElementById('role-form-nombre').value = '';
      document.getElementById('role-form-tipo').value = '';
      document.getElementById('role-form-activo').checked = true;

      document.getElementById('role-modal-title').textContent = 'Crear Rol';
      openRoleModal();
    });
  }

  if (btnCloseRoleModal) btnCloseRoleModal.addEventListener('click', closeRoleModal);
  if (btnCancelRoleModal) btnCancelRoleModal.addEventListener('click', closeRoleModal);

  window.editRole = (id) => {
    const role = rolesList.find(r => r.id === id);
    if (!role) return;

    document.getElementById('role-form-id').value = role.id;
    document.getElementById('role-form-nombre').value = role.nombre || '';
    document.getElementById('role-form-tipo').value = role.tipo || '';
    document.getElementById('role-form-activo').checked = role.activo === true;

    document.getElementById('role-modal-title').textContent = 'Editar Rol';
    openRoleModal();
  };

  window.deleteRole = (id) => {
    openDeleteModal(id, 'role');
  };

  if (roleForm) {
    roleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('role-form-id').value;
      const nombre = document.getElementById('role-form-nombre').value;
      const tipo = document.getElementById('role-form-tipo').value;
      const activo = document.getElementById('role-form-activo').checked;

      const saveBtn = document.getElementById('btn-save-role-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const roleData = { nombre, tipo, activo };

        let url = `${supabaseUrl}roles`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}roles?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(roleData)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos del rol en Supabase.");

        showToast(id ? 'Rol actualizado con éxito.' : 'Rol creado con éxito.', true);
        closeRoleModal();
        loadRoles();
      } catch (err) {
        console.error("Save role error:", err);
        showToast(err.message || 'Error al guardar los datos del rol.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Roles Controls
  const rolesSearchInput = document.getElementById('roles-search');
  if (rolesSearchInput) {
    let debounceTimer;
    rolesSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        rolesSearchQuery = e.target.value.trim();
        rolesPage = 1;
        loadRoles();
      }, 300);
    });
  }

  const rolesBtnPrev = document.getElementById('roles-btn-prev');
  const rolesBtnNext = document.getElementById('roles-btn-next');
  if (rolesBtnPrev) {
    rolesBtnPrev.addEventListener('click', () => {
      if (rolesPage > 1) {
        rolesPage--;
        loadRoles();
      }
    });
  }
  if (rolesBtnNext) {
    rolesBtnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(rolesTotalCount / rolesPageSize);
      if (rolesPage < totalPages) {
        rolesPage++;
        loadRoles();
      }
    });
  }
};
