import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let revisionsPage = 1;
const revisionsPageSize = 5;
let revisionsSearchQuery = "";
let revisionsTotalCount = 0;
let revisionsList = [];
let revisionsViewMode = "table"; // "table" or "calendar"
let calendarCurrentDate = new Date();

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

const renderRevisionsCalendar = () => {
  const daysGrid = document.getElementById('calendar-days-grid');
  const monthYearLabel = document.getElementById('calendar-current-month-year');
  if (!daysGrid || !monthYearLabel) return;

  daysGrid.innerHTML = '';

  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth(); // 0-indexed

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  // Adjust starting day (Monday is 0, Tuesday is 1... Sunday is 6)
  startDay = startDay === 0 ? 6 : startDay - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Draw empty cells for preceding month
  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = "bg-slate-50/30 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-xl min-h-[145px] opacity-40 p-2";
    daysGrid.appendChild(emptyCell);
  }

  // Draw days
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[145px] p-2.5 flex flex-col hover:border-brand/40 dark:hover:border-brand/40 transition-all duration-200";

    const monthStr = (month + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    const cellHeader = document.createElement('div');
    cellHeader.className = "text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5";
    cellHeader.textContent = day;
    cell.appendChild(cellHeader);

    const cellEvents = document.createElement('div');
    cellEvents.className = "flex-1 overflow-y-auto space-y-1 max-h-[110px] custom-scrollbar";

    const dayRevisions = revisionsList.filter(item => item.fecha_revision === dateStr);
    const dayDeadlines = revisionsList.filter(item => item.fecha_compromiso === dateStr);

    dayRevisions.forEach(item => {
      const eventEl = document.createElement('div');
      eventEl.setAttribute('data-revision-id', item.id);
      eventEl.setAttribute('data-event-type', 'event');
      
      const themeClasses = item.cumplido
        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500 hover:bg-emerald-500/20"
        : "bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light border-brand hover:bg-brand/20";

      eventEl.className = `text-[9px] leading-tight p-1 rounded border-l-2 cursor-pointer transition-all font-semibold truncate select-none ${themeClasses}`;
      
      const empName = item.empresa ? item.empresa.razon : 'Sin Empresa';
      const desc = item.descripcion || 'Sin Descripción';
      
      eventEl.innerHTML = `
        <span class="block truncate">${escapeHtml(empName)}</span>
        <span class="block text-[8px] font-normal opacity-85 truncate">${escapeHtml(desc)}</span>
      `;

      eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        window.editRevision(item.id);
      });

      cellEvents.appendChild(eventEl);
    });

    dayDeadlines.forEach(item => {
      const deadlineEl = document.createElement('div');
      deadlineEl.setAttribute('data-revision-id', item.id);
      deadlineEl.setAttribute('data-event-type', 'deadline');
      
      const themeClasses = "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-450 border-rose-500 hover:bg-rose-500/20";
      deadlineEl.className = `text-[9px] leading-tight p-1 rounded border-l-2 cursor-pointer transition-all font-semibold truncate select-none ${themeClasses}`;
      
      const empName = item.empresa ? item.empresa.razon : 'Sin Empresa';
      const compromiso = item.compromiso || 'Sin Compromiso';
      
      deadlineEl.innerHTML = `
        <span class="block truncate">⚠️ Límite: ${escapeHtml(empName)}</span>
        <span class="block text-[8px] font-normal opacity-85 truncate">${escapeHtml(compromiso)}</span>
      `;

      deadlineEl.addEventListener('click', (e) => {
        e.stopPropagation();
        window.editRevision(item.id);
      });

      cellEvents.appendChild(deadlineEl);
    });

    cell.appendChild(cellEvents);
    daysGrid.appendChild(cell);
  }

  // Bind hover connections
  const allEvents = daysGrid.querySelectorAll('[data-revision-id]');
  allEvents.forEach(el => {
    const revId = el.getAttribute('data-revision-id');
    el.addEventListener('mouseenter', () => {
      const related = daysGrid.querySelectorAll(`[data-revision-id="${revId}"]`);
      related.forEach(rel => {
        const isDeadline = rel.getAttribute('data-event-type') === 'deadline';
        rel.classList.add('ring-2', 'scale-[1.02]', 'shadow-md', 'z-10');
        rel.classList.add(isDeadline ? 'ring-rose-500' : 'ring-brand');
      });
    });
    el.addEventListener('mouseleave', () => {
      const related = daysGrid.querySelectorAll(`[data-revision-id="${revId}"]`);
      related.forEach(rel => {
        rel.classList.remove('ring-2', 'ring-brand', 'ring-rose-500', 'scale-[1.02]', 'shadow-md', 'z-10');
      });
    });
  });
};

const updateRevisionsViewModeUI = () => {
  const btnTable = document.getElementById('btn-revisions-view-table');
  const btnCalendar = document.getElementById('btn-revisions-view-calendar');
  const tblContainer = document.getElementById('revisions-table-container');
  const calContainer = document.getElementById('revisions-calendar-container');
  const calControls = document.getElementById('calendar-header-controls');
  const searchInput = document.getElementById('revisions-search');
  const paginationControls = document.getElementById('revisions-pagination');

  if (!btnTable || !btnCalendar || !tblContainer || !calContainer || !calControls) return;

  if (revisionsViewMode === 'table') {
    btnTable.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-brand bg-white dark:bg-slate-900 shadow-sm";
    btnCalendar.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
    
    tblContainer.classList.remove('hidden');
    calContainer.classList.add('hidden');
    calControls.classList.add('hidden');
    if (searchInput) searchInput.disabled = false;
  } else {
    btnTable.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
    btnCalendar.className = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-brand bg-white dark:bg-slate-900 shadow-sm";
    
    tblContainer.classList.add('hidden');
    calContainer.classList.remove('hidden');
    calControls.classList.remove('hidden');
    if (searchInput) searchInput.disabled = true;
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

  const start = revisionsViewMode === "table" ? (revisionsPage - 1) * revisionsPageSize : 0;
  const end = revisionsViewMode === "table" ? start + revisionsPageSize - 1 : 499;

  try {
    // Select with company join
    let queryUrl = `${supabaseUrl}revision?select=*,empresa:empresa_id(razon)`;

    if (!window.isAdmin) {
      const compId = window.userCompanyId || -1;
      queryUrl += `&empresa_id=eq.${compId}`;
    }

    if (revisionsSearchQuery && revisionsViewMode === "table") {
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

    if (revisionsViewMode === "calendar") {
      renderRevisionsCalendar();
    } else {
      if (revisionsList.length === 0) {
        emptyEl?.classList.remove('hidden');
        updateRevisionsPaginationUI(0, 0);
      } else {
        revisionsList.forEach(item => {
          const empresaName = item.empresa ? item.empresa.razon : `<span class="text-slate-400 italic">No asociada</span>`;
          const descText = item.descripcion ? escapeHtml(item.descripcion) : '-';
          const compromisoText = item.compromiso ? escapeHtml(item.compromiso) : '-';
          
          let fechaRevText = '-';
          if (item.fecha_revision) {
            const parts = item.fecha_revision.split('-');
            if (parts.length === 3) {
              fechaRevText = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
              fechaRevText = item.fecha_revision;
            }
          }

          let fechaCompText = '-';
          if (item.fecha_compromiso) {
            const parts = item.fecha_compromiso.split('-');
            if (parts.length === 3) {
              fechaCompText = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
              fechaCompText = item.fecha_compromiso;
            }
          }

          const cumplidoBadge = item.cumplido
            ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Sí</span>`
            : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">No</span>`;

          const anexoLink = item.anexo
            ? `<a href="${escapeHtml(item.anexo)}" target="_blank" class="text-brand hover:text-brand-light text-xs font-semibold underline inline-flex items-center gap-1">Ver <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`
            : `<span class="text-slate-400 italic text-xs">-</span>`;

          const editDeleteBtns = window.isAdmin
            ? `<button onclick="editRevision(${item.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
               <button onclick="deleteRevision(${item.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>`
            : `<button onclick="editRevision(${item.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Ver</button>`;

          const row = document.createElement('tr');
          row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
          row.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${item.id}</td>
            <td class="px-6 py-4 text-slate-700 dark:text-slate-200 font-semibold">${empresaName}</td>
            <td class="px-6 py-4 text-slate-650 dark:text-slate-200 font-mono text-xs">${fechaRevText}</td>
            <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">${descText}</td>
            <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">${compromisoText}</td>
            <td class="px-6 py-4 text-slate-650 dark:text-slate-200 font-mono text-xs">${fechaCompText}</td>
            <td class="px-6 py-4 text-center">${cumplidoBadge}</td>
            <td class="px-6 py-4 text-center">${anexoLink}</td>
            <td class="px-6 py-4 text-right space-x-1.5">
              ${editDeleteBtns}
            </td>
          `;
          tableBody.appendChild(row);
        });
        updateRevisionsPaginationUI(start + 1, start + revisionsList.length);
      }
    }
  } catch (err) {
    console.error("Error loading revisions:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-10 text-center text-red-500 font-semibold">
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

    const saveBtn = document.getElementById('btn-save-revision-modal');
    if (saveBtn) {
      saveBtn.style.display = window.isAdmin ? 'inline-block' : 'none';
    }
    if (revisionForm) {
      const inputs = revisionForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !window.isAdmin;
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

  if (btnAddRevision) {
    if (!window.isAdmin) {
      btnAddRevision.style.display = 'none';
    }
    btnAddRevision.addEventListener('click', async () => {
      document.getElementById('revision-form-id').value = '';
      document.getElementById('revision-form-fecha').value = new Date().toISOString().split('T')[0];
      document.getElementById('revision-form-descripcion').value = '';
      document.getElementById('revision-form-compromiso').value = '';
      document.getElementById('revision-form-fecha-compromiso').value = '';
      document.getElementById('revision-form-anexo').value = '';
      document.getElementById('revision-form-cumplido').checked = false;
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
    document.getElementById('revision-form-compromiso').value = item.compromiso || '';
    document.getElementById('revision-form-fecha-compromiso').value = item.fecha_compromiso || '';
    document.getElementById('revision-form-anexo').value = item.anexo || '';
    document.getElementById('revision-form-cumplido').checked = !!item.cumplido;
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
      const compromiso = document.getElementById('revision-form-compromiso').value;
      const fechaCompVal = document.getElementById('revision-form-fecha-compromiso').value;
      const fecha_compromiso = fechaCompVal !== '' ? fechaCompVal : null;
      const anexo = document.getElementById('revision-form-anexo').value;
      const cumplido = document.getElementById('revision-form-cumplido').checked;
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
        const payload = { 
          empresa_id, 
          fecha_revision, 
          descripcion, 
          compromiso, 
          fecha_compromiso, 
          anexo, 
          cumplido, 
          comentario 
        };

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

  // Bind View Mode Switches
  const btnTable = document.getElementById('btn-revisions-view-table');
  const btnCalendar = document.getElementById('btn-revisions-view-calendar');

  if (btnTable) {
    btnTable.addEventListener('click', () => {
      if (revisionsViewMode !== 'table') {
        revisionsViewMode = 'table';
        updateRevisionsViewModeUI();
        loadRevisions();
      }
    });
  }

  if (btnCalendar) {
    btnCalendar.addEventListener('click', () => {
      if (revisionsViewMode !== 'calendar') {
        revisionsViewMode = 'calendar';
        updateRevisionsViewModeUI();
        loadRevisions();
      }
    });
  }

  // Bind Calendar Month Navigation buttons
  const btnCalPrev = document.getElementById('btn-calendar-prev');
  const btnCalNext = document.getElementById('btn-calendar-next');

  if (btnCalPrev) {
    btnCalPrev.addEventListener('click', () => {
      calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
      renderRevisionsCalendar();
    });
  }

  if (btnCalNext) {
    btnCalNext.addEventListener('click', () => {
      calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
      renderRevisionsCalendar();
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
