import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let usersPage = 1;
const usersPageSize = 5;
let usersSearchQuery = "";
let usersTotalCount = 0;
let usersList = [];

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

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(user.nombre)}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-400">${escapeHtml(user.ci)}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-400">${escapeHtml(user.mail)}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-400">${escapeHtml(user.telefono)}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            <button onclick="editUser(${user.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
            <button onclick="deleteUser(${user.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
          </td>
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

  if (btnAddUser) {
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
      
      openModal();
    });
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

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

    document.getElementById('modal-title').textContent = 'Editar Usuario';
    document.getElementById('password-hint').classList.remove('hidden');
    
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

        if (!res.ok) throw new Error("Fallo al guardar datos en Supabase.");

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
