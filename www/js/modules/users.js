import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let usersPage = 1;
const usersPageSize = 5;
let usersSearchQuery = "";
let usersTotalCount = 0;
export let usersList = [];

export const loadUsers = async () => {
  const loadingEl = document.getElementById('users-loading');
  const tableBody = document.getElementById('users-table-body');
  const emptyEl = document.getElementById('users-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (usersPage - 1) * usersPageSize;
  const end = start + usersPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}usuario`;
    
    if (usersSearchQuery) {
      const encSearch = encodeURIComponent(usersSearchQuery);
      queryUrl += `?or=(nombre.ilike.*${encSearch}*,ci.ilike.*${encSearch}*,mail.ilike.*${encSearch}*,telefono.ilike.*${encSearch}*)&order=id.asc`;
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
    
    usersList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        usersTotalCount = parseInt(parts[1], 10);
      }
    } else {
      usersTotalCount = usersList.length;
    }

    if (usersList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateUsersPaginationUI(0, 0);
    } else {
      usersList.forEach(user => {
        const statusBadge = user.activo
          ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Activo</span>`
          : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inactivo</span>`;

        const canWrite = window.hasPermission('view-users', 'escribir');

        const btnEditar = `
          <button onclick="editUser(${user.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Usuario">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editUser(${user.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteUser(${user.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Usuario">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        `;

        const btnRoles = `
          <button onclick="openUserRolesModal(${user.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 transition-all duration-200 shadow-sm border border-indigo-200/40 dark:border-indigo-800/40" title="Gestionar Roles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
          </button>
        `;

        const btnCompanies = `
          <button onclick="openUserCompaniesModal(${user.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 transition-all duration-200 shadow-sm border border-emerald-200/40 dark:border-emerald-800/40" title="Empresas y Sucursales Asignadas">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
          </button>
        `;

        const editDeleteRow = canWrite ? `${btnEditar}${btnEliminar}` : `${btnVer}`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-4 py-3 text-left whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              ${btnRoles}
              ${btnCompanies}
              ${editDeleteRow}
            </div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(user.nombre)}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${escapeHtml(user.ci)}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${escapeHtml(user.mail)}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${escapeHtml(user.telefono)}</td>
          <td class="px-4 py-3">${statusBadge}</td>
        `;
        tableBody.appendChild(row);
      });
      updateUsersPaginationUI(start + 1, start + usersList.length);
    }
  } catch (err) {
    console.error("Error loading users:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando usuarios.'}
        </td>
      </tr>
    `;
    updateUsersPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateUsersPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('users-range-start');
  const rangeEndEl = document.getElementById('users-range-end');
  const totalCountEl = document.getElementById('users-total-count');
  const currentPageEl = document.getElementById('users-current-page');
  const totalPagesEl = document.getElementById('users-total-pages');
  const btnPrev = document.getElementById('users-btn-prev');
  const btnNext = document.getElementById('users-btn-next');

  const totalPages = Math.ceil(usersTotalCount / usersPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = usersTotalCount;
  if (currentPageEl) currentPageEl.textContent = usersPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = usersPage <= 1;
  if (btnNext) btnNext.disabled = usersPage >= totalPages;
};

export const initUsersModule = () => {
  const modalOverlay = document.getElementById('user-modal-overlay');
  const modalCard = document.getElementById('user-modal-card');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnAddUser = document.getElementById('btn-add-user');
  const userForm = document.getElementById('user-form');
  const btnManageRoles = document.getElementById('btn-manage-user-roles');

  const openModal = () => {
    if (!modalOverlay || !modalCard) return;
    modalOverlay.classList.remove('hidden');
    modalOverlay.offsetHeight;
    modalOverlay.classList.remove('opacity-0');
    modalOverlay.classList.add('opacity-100');
    modalCard.classList.remove('scale-95', 'opacity-0');
    modalCard.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-users', 'escribir');
    const saveBtn = document.getElementById('btn-save-modal');
    if (saveBtn) {
      saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    }
    if (userForm) {
      const inputs = userForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !canWrite;
      });
    }
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

  if (btnAddUser) {
    const canWrite = window.hasPermission('view-users', 'escribir');
    btnAddUser.style.display = canWrite ? 'inline-flex' : 'none';
    btnAddUser.addEventListener('click', () => {
      document.getElementById('form-id').value = '';
      document.getElementById('form-nombre').value = '';
      document.getElementById('form-ci').value = '';
      document.getElementById('form-mail').value = '';
      document.getElementById('form-telefono').value = '';
      document.getElementById('form-clave').value = '';
      document.getElementById('form-clave').required = true;
      document.getElementById('form-activo').checked = true;

      document.getElementById('modal-title').textContent = 'Crear Usuario';
      document.getElementById('password-hint').classList.add('hidden');
      if (btnManageRoles) btnManageRoles.classList.add('hidden');
      
      openModal();
    });
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  if (btnManageRoles) {
    btnManageRoles.addEventListener('click', () => {
      const userId = parseInt(document.getElementById('form-id').value, 10);
      if (userId) {
        closeModal();
        window.openUserRolesModal?.(userId);
      }
    });
  }

  window.editUser = (id) => {
    const user = usersList.find(u => u.id === id);
    if (!user) return;

    document.getElementById('form-id').value = user.id;
    document.getElementById('form-nombre').value = user.nombre || '';
    document.getElementById('form-ci').value = user.ci || '';
    document.getElementById('form-mail').value = user.mail || '';
    document.getElementById('form-telefono').value = user.telefono || '';
    document.getElementById('form-clave').value = '';
    document.getElementById('form-clave').required = false;
    document.getElementById('form-activo').checked = user.activo === true;

    const canWrite = window.hasPermission('view-users', 'escribir');
    document.getElementById('modal-title').textContent = canWrite ? 'Editar Usuario' : 'Detalles del Usuario';
    document.getElementById('password-hint').classList.remove('hidden');
    if (btnManageRoles) btnManageRoles.classList.remove('hidden');
    
    openModal();
  };

  window.deleteUser = (id) => {
    openDeleteModal(id, 'user');
  };

  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('form-id').value;
      const nombre = document.getElementById('form-nombre').value;
      const ci = document.getElementById('form-ci').value;
      const mail = document.getElementById('form-mail').value;
      const telefono = document.getElementById('form-telefono').value;
      const clave = document.getElementById('form-clave').value;
      const activo = document.getElementById('form-activo').checked;

      const saveBtn = document.getElementById('btn-save-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const userData = { nombre, ci, mail, telefono, activo };

        if (clave) {
          const bcryptLib = window.bcrypt || dcodeIO.bcrypt;
          if (bcryptLib) {
            const salt = bcryptLib.genSaltSync(10);
            userData.clave = bcryptLib.hashSync(clave, salt);
          } else {
            console.warn("Bcrypt library not available, saving key in plaintext.");
            userData.clave = clave;
          }
        } else if (!id) {
          throw new Error("La contraseña es requerida para nuevos usuarios.");
        }

        let url = `${supabaseUrl}usuario`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}usuario?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(userData)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos del usuario en Supabase.");

        showToast(id ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.', true);
        closeModal();
        loadUsers();
      } catch (err) {
        console.error("Save error:", err);
        showToast(err.message || 'Error al guardar los datos.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Users Controls
  const usersSearchInput = document.getElementById('users-search');
  if (usersSearchInput) {
    let debounceTimer;
    usersSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        usersSearchQuery = e.target.value.trim();
        usersPage = 1;
        loadUsers();
      }, 300);
    });
  }

  const usersBtnPrev = document.getElementById('users-btn-prev');
  const usersBtnNext = document.getElementById('users-btn-next');
  if (usersBtnPrev) {
    usersBtnPrev.addEventListener('click', () => {
      if (usersPage > 1) {
        usersPage--;
        loadUsers();
      }
    });
  }
  if (usersBtnNext) {
    usersBtnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(usersTotalCount / usersPageSize);
      if (usersPage < totalPages) {
        usersPage++;
        loadUsers();
      }
    });
  }
};
