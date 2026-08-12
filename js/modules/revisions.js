import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let revisionsPage = 1;
const revisionsPageSize = 5;
let revisionsSearchQuery = "";
let revisionsTotalCount = 0;
let revisionsList = [];

export const loadCompaniesForSelect = async (selectedCompanyId = null) => {
  const selectEl = document.getElementById('revision-form-empresa');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cargando empresas...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const res = await fetch(`${supabaseUrl}empresa?activo=eq.true&order=razon.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar las empresas.");

    const companies = await res.json();
    selectEl.innerHTML = '<option value="">Seleccione una empresa...</option>';

    companies.forEach(comp => {
      const option = document.createElement('option');
      option.value = comp.id;
      option.textContent = comp.razon;
      if (selectedCompanyId && comp.id === parseInt(selectedCompanyId, 10)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading companies for select:", err);
    selectEl.innerHTML = '<option value="">Error al cargar empresas</option>';
  }
};

export const loadRevisions = async () => {
  const loadingEl = document.getElementById('revisions-loading');
  const tableBody = document.getElementById('revisions-table-body');
  const emptyEl = document.getElementById('revisions-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (revisionsPage - 1) * revisionsPageSize;
  const end = start + revisionsPageSize - 1;

  try {
    // Select with company join
    let queryUrl = `${supabaseUrl}revision?select=*,empresa:empresa_id(razon)`;

    if (revisionsSearchQuery) {
      const encSearch = encodeURIComponent(revisionsSearchQuery);
      queryUrl += `&or=(descripcion.ilike.*${encSearch}*,comentario.ilike.*${encSearch}*)&order=id.asc`;
    } else {
      queryUrl += `&order=id.asc`;
    }

    const headers = getHeaders();
    headers["Prefer"] = "count=exact";
    headers["Range"] = `${start}-${end}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} - No se pudo conectar a la base de datos.`);
    
    revisionsList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        revisionsTotalCount = parseInt(parts[1], 10);
      }
    } else {
      revisionsTotalCount = revisionsList.length;
    }

    if (revisionsList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateRevisionsPaginationUI(0, 0);
    } else {
      revisionsList.forEach(item => {
        const empresaName = item.empresa ? item.empresa.razon : `<span class="text-slate-400 italic">No asociada</span>`;
        const descText = item.descripcion ? escapeHtml(item.descripcion) : '-';
        const commentText = item.comentario ? escapeHtml(item.comentario) : '<span class="text-slate-400 italic">Sin comentarios</span>';
        
        let fechaRevText = '-';
        if (item.fecha_revision) {
          const parts = item.fecha_revision.split('-');
          if (parts.length === 3) {
            fechaRevText = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            fechaRevText = item.fecha_revision;
          }
        }

        let fechaText = '-';
        if (item.created_at) {
          const dt = new Date(item.created_at);
          fechaText = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${item.id}</td>
          <td class="px-6 py-4 text-slate-700 dark:text-slate-200 font-semibold">${empresaName}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-200 font-mono text-xs">${fechaRevText}</td>
          <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">${descText}</td>
          <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">${commentText}</td>
          <td class="px-6 py-4 text-slate-500 font-mono text-[10px]">${fechaText}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            <button onclick="editRevision(${item.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
            <button onclick="deleteRevision(${item.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
      updateRevisionsPaginationUI(start + 1, start + revisionsList.length);
    }
  } catch (err) {
    console.error("Error loading revisions:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando revisiones.'}
        </td>
      </tr>
    `;
    updateRevisionsPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateRevisionsPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('revisions-range-start');
  const rangeEndEl = document.getElementById('revisions-range-end');
  const totalCountEl = document.getElementById('revisions-total-count');
  const currentPageEl = document.getElementById('revisions-current-page');
  const totalPagesEl = document.getElementById('revisions-total-pages');
  const btnPrev = document.getElementById('revisions-btn-prev');
  const btnNext = document.getElementById('revisions-btn-next');

  const totalPages = Math.ceil(revisionsTotalCount / revisionsPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = revisionsTotalCount;
  if (currentPageEl) currentPageEl.textContent = revisionsPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = revisionsPage <= 1;
  if (btnNext) btnNext.disabled = revisionsPage >= totalPages;
};

export const initRevisionsModule = () => {
  const modalOverlay = document.getElementById('revision-modal-overlay');
  const modalCard = document.getElementById('revision-modal-card');
  const btnCloseModal = document.getElementById('btn-close-revision-modal');
  const btnCancelModal = document.getElementById('btn-cancel-revision-modal');
  const btnAddRevision = document.getElementById('btn-add-revision');
  const revisionForm = document.getElementById('revision-form');

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

  if (btnAddRevision) {
    btnAddRevision.addEventListener('click', async () => {
      document.getElementById('revision-form-id').value = '';
      document.getElementById('revision-form-fecha').value = new Date().toISOString().split('T')[0];
      document.getElementById('revision-form-descripcion').value = '';
      document.getElementById('revision-form-comentario').value = '';

      document.getElementById('revision-modal-title').textContent = 'Crear Revisión';
      await loadCompaniesForSelect();
      openModal();
    });
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  window.editRevision = async (id) => {
    const item = revisionsList.find(x => x.id === id);
    if (!item) return;

    document.getElementById('revision-form-id').value = item.id;
    document.getElementById('revision-form-fecha').value = item.fecha_revision || '';
    document.getElementById('revision-form-descripcion').value = item.descripcion || '';
    document.getElementById('revision-form-comentario').value = item.comentario || '';

    document.getElementById('revision-modal-title').textContent = 'Editar Revisión';
    await loadCompaniesForSelect(item.empresa_id);
    openModal();
  };

  window.deleteRevision = (id) => {
    openDeleteModal(id, 'revision');
  };

  if (revisionForm) {
    revisionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('revision-form-id').value;
      const empresaVal = document.getElementById('revision-form-empresa').value;
      const empresa_id = empresaVal ? parseInt(empresaVal, 10) : null;
      const fecha_revision = document.getElementById('revision-form-fecha').value;
      const descripcion = document.getElementById('revision-form-descripcion').value;
      const comentario = document.getElementById('revision-form-comentario').value;

      const saveBtn = document.getElementById('btn-save-revision-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const payload = { empresa_id, fecha_revision, descripcion, comentario };

        let url = `${supabaseUrl}revision`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}revision?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos de la revisión en Supabase.");

        showToast(id ? 'Revisión actualizada con éxito.' : 'Revisión creada con éxito.', true);
        closeModal();
        loadRevisions();
      } catch (err) {
        console.error("Save revision error:", err);
        showToast(err.message || 'Error al guardar la revisión.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Bind Search bar input event
  const searchInput = document.getElementById('revisions-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      revisionsSearchQuery = e.target.value;
      revisionsPage = 1;
      loadRevisions();
    });
  }

  // Bind pagination buttons
  const btnPrev = document.getElementById('revisions-btn-prev');
  const btnNext = document.getElementById('revisions-btn-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (revisionsPage > 1) {
        revisionsPage--;
        loadRevisions();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(revisionsTotalCount / revisionsPageSize) || 1;
      if (revisionsPage < totalPages) {
        revisionsPage++;
        loadRevisions();
      }
    });
  }
};
