import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let periodsPage = 1;
const periodsPageSize = 10;
let periodsSearchQuery = '';
let periodsFilterActivo = '';
let periodsTotalCount = 0;
let periodsList = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '-';
  const parts = iso.split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
};

const fmtDateInput = (iso) => {
  if (!iso) return '';
  return iso.split('T')[0];
};

// ─── Load ─────────────────────────────────────────────────────────────────────

export const loadPeriods = async () => {
  const loadingEl = document.getElementById('periods-loading');
  const tableBody = document.getElementById('periods-table-body');
  const emptyEl   = document.getElementById('periods-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) await loadEnv();

  const start = (periodsPage - 1) * periodsPageSize;
  const end   = start + periodsPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}periodos?order=id.desc`;

    if (periodsSearchQuery) {
      const enc = encodeURIComponent(periodsSearchQuery);
      queryUrl += `&periodo=ilike.*${enc}*`;
    }

    if (periodsFilterActivo !== '') {
      queryUrl += `&activo=eq.${periodsFilterActivo}`;
    }

    const headers = getHeaders();
    headers['Prefer'] = 'count=exact';
    headers['Range']  = `${start}-${end}`;

    const res = await fetch(queryUrl, { method: 'GET', headers });

    if (!res.ok) throw new Error(`HTTP ${res.status} – No se pudo conectar a la base de datos.`);

    periodsList = await res.json();

    const cr = res.headers.get('content-range');
    periodsTotalCount = cr ? parseInt(cr.split('/')[1], 10) : periodsList.length;

    if (periodsList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updatePeriodsPaginationUI(0, 0);
    } else {
      periodsList.forEach(p => {
        const statusBadge = p.activo
          ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Activo</span>`
          : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inactivo</span>`;

        const canWrite = window.hasPermission('view-periods', 'escribir');

        const btnEditar = `
          <button onclick="editPeriod(${p.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Período">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editPeriod(${p.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deletePeriod(${p.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Período">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        `;

        const editDeleteRow = canWrite ? `${btnEditar}${btnEliminar}` : `${btnVer}`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-4 py-3 text-left whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              ${editDeleteRow}
            </div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${p.id}</td>
          <td class="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">${escapeHtml(p.periodo || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${fmtDate(p.fechadesde)}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${fmtDate(p.fechahasta)}</td>
          <td class="px-4 py-3 text-slate-550 dark:text-slate-400 max-w-xs truncate">${escapeHtml(p.comentario || '-')}</td>
          <td class="px-4 py-3">${statusBadge}</td>
        `;
        tableBody.appendChild(row);
      });
      updatePeriodsPaginationUI(start + 1, start + periodsList.length);
    }
  } catch (err) {
    console.error('Error loading periods:', err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando períodos.'}
        </td>
      </tr>`;
    updatePeriodsPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

// ─── Pagination UI ────────────────────────────────────────────────────────────

const updatePeriodsPaginationUI = (startRange, endRange) => {
  const totalPages = Math.ceil(periodsTotalCount / periodsPageSize) || 1;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('periods-range-start',  startRange);
  set('periods-range-end',    endRange);
  set('periods-total-count',  periodsTotalCount);
  set('periods-current-page', periodsPage);
  set('periods-total-pages',  totalPages);

  const btnPrev = document.getElementById('periods-btn-prev');
  const btnNext = document.getElementById('periods-btn-next');
  if (btnPrev) btnPrev.disabled = periodsPage <= 1;
  if (btnNext) btnNext.disabled = periodsPage >= totalPages;
};

// ─── Generate Full Year Periods ───────────────────────────────────────────────

export const generateYearPeriods = async (year, format = 'short') => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  const y = parseInt(year, 10);
  if (!y || y < 2000 || y > 2099) {
    throw new Error('Por favor ingresa un año válido entre 2000 y 2099.');
  }

  const months = [
    { num: 1, short: 'ene', name: 'Enero' },
    { num: 2, short: 'feb', name: 'Febrero' },
    { num: 3, short: 'mar', name: 'Marzo' },
    { num: 4, short: 'abr', name: 'Abril' },
    { num: 5, short: 'may', name: 'Mayo' },
    { num: 6, short: 'jun', name: 'Junio' },
    { num: 7, short: 'jul', name: 'Julio' },
    { num: 8, short: 'ago', name: 'Agosto' },
    { num: 9, short: 'sep', name: 'Septiembre' },
    { num: 10, short: 'oct', name: 'Octubre' },
    { num: 11, short: 'nov', name: 'Noviembre' },
    { num: 12, short: 'dic', name: 'Diciembre' }
  ];

  // Check existing periods to avoid duplicates
  const checkRes = await fetch(`${supabaseUrl}periodos?fechadesde=gte.${y}-01-01&fechahasta=lte.${y}-12-31`, {
    headers: getHeaders()
  });
  const existing = checkRes.ok ? await checkRes.json() : [];
  const existingNames = new Set(existing.map(p => (p.periodo || '').toLowerCase().trim()));
  const existingStartDates = new Set(existing.map(p => p.fechadesde));

  const periodsToInsert = [];

  for (const m of months) {
    const mmStr = String(m.num).padStart(2, '0');
    const fechadesde = `${y}-${mmStr}-01`;
    const lastDay = new Date(y, m.num, 0).getDate();
    const fechahasta = `${y}-${mmStr}-${String(lastDay).padStart(2, '0')}`;

    let periodoName = '';
    if (format === 'full') {
      periodoName = `${m.name} ${y}`;
    } else if (format === 'iso') {
      periodoName = `${y}-${mmStr}`;
    } else {
      periodoName = `${m.short}-${y}`;
    }

    if (existingNames.has(periodoName.toLowerCase()) || existingStartDates.has(fechadesde)) {
      continue;
    }

    periodsToInsert.push({
      periodo: periodoName,
      fechadesde,
      fechahasta,
      comentario: `Mes de ${m.name} del año ${y}`,
      activo: true
    });
  }

  if (periodsToInsert.length === 0) {
    return { created: 0, total: 12, message: `Todos los meses del año ${y} ya estaban registrados.` };
  }

  const insertRes = await fetch(`${supabaseUrl}periodos`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(periodsToInsert)
  });

  if (!insertRes.ok) {
    throw new Error('Error al registrar los períodos en Supabase.');
  }

  return { created: periodsToInsert.length, total: 12 };
};

// ─── Init ─────────────────────────────────────────────────────────────────────

export const initPeriodsModule = () => {
  const overlay  = document.getElementById('period-modal-overlay');
  const card     = document.getElementById('period-modal-card');
  const form     = document.getElementById('period-form');
  const btnAdd   = document.getElementById('btn-add-period');

  const openModal = () => {
    if (!overlay || !card) return;
    overlay.classList.remove('hidden');
    overlay.offsetHeight; // reflow
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    card.classList.remove('scale-95', 'opacity-0');
    card.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-periods', 'escribir');
    const saveBtn  = document.getElementById('btn-save-period-modal');
    if (saveBtn) saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    if (form) {
      form.querySelectorAll('input, textarea').forEach(el => { el.disabled = !canWrite; });
    }
  };

  const closeModal = () => {
    if (!overlay || !card) return;
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  };

  // Visibility based on write permission
  if (btnAdd) {
    btnAdd.style.display = window.hasPermission('view-periods', 'escribir') ? 'inline-flex' : 'none';
    btnAdd.addEventListener('click', () => {
      document.getElementById('period-form-id').value        = '';
      document.getElementById('period-form-periodo').value   = '';
      document.getElementById('period-form-fechadesde').value = '';
      document.getElementById('period-form-fechahasta').value = '';
      document.getElementById('period-form-comentario').value = '';
      document.getElementById('period-form-activo').checked  = true;
      document.getElementById('period-modal-title').textContent = 'Crear Período';
      openModal();
    });
  }

  document.getElementById('btn-close-period-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-period-modal')?.addEventListener('click', closeModal);

  // ── Generation Modal Handlers ─────────────────────────────────────────────
  const genOverlay = document.getElementById('generate-year-periods-modal-overlay');
  const genCard    = document.getElementById('generate-year-periods-modal-card');
  const genForm    = document.getElementById('generate-year-periods-form');
  const btnGenOpen = document.getElementById('btn-generate-year-periods');

  const openGenModal = () => {
    if (!genOverlay || !genCard) return;
    const yearInput = document.getElementById('gen-periods-year');
    if (yearInput && !yearInput.value) {
      yearInput.value = new Date().getFullYear();
    }
    genOverlay.classList.remove('hidden');
    genOverlay.offsetHeight;
    genOverlay.classList.remove('opacity-0');
    genOverlay.classList.add('opacity-100');
    genCard.classList.remove('scale-95', 'opacity-0');
    genCard.classList.add('scale-100', 'opacity-100');
  };

  const closeGenModal = () => {
    if (!genOverlay || !genCard) return;
    genOverlay.classList.remove('opacity-100');
    genOverlay.classList.add('opacity-0');
    genCard.classList.remove('scale-100', 'opacity-100');
    genCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => genOverlay.classList.add('hidden'), 300);
  };

  if (btnGenOpen) {
    btnGenOpen.style.display = window.hasPermission('view-periods', 'escribir') ? 'inline-flex' : 'none';
    btnGenOpen.addEventListener('click', openGenModal);
  }

  document.getElementById('btn-close-generate-year-periods-modal')?.addEventListener('click', closeGenModal);
  document.getElementById('btn-cancel-generate-year-periods-modal')?.addEventListener('click', closeGenModal);

  if (genForm) {
    genForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const year = document.getElementById('gen-periods-year').value;
      const format = document.getElementById('gen-periods-format').value;
      const submitBtn = document.getElementById('btn-submit-generate-year-periods');
      const origHtml = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generando...`;

      try {
        const result = await generateYearPeriods(year, format);
        if (result.created > 0) {
          showToast(`¡Se generaron ${result.created} períodos para el año ${year} con éxito!`, true);
        } else {
          showToast(result.message || `No fue necesario crear períodos.`, true);
        }
        closeGenModal();
        loadPeriods();
      } catch (err) {
        console.error('Error generating periods:', err);
        showToast(err.message || 'Error al generar períodos del año.', false);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  window.editPeriod = (id) => {
    const p = periodsList.find(x => x.id === id);
    if (!p) return;

    document.getElementById('period-form-id').value         = p.id;
    document.getElementById('period-form-periodo').value    = p.periodo || '';
    document.getElementById('period-form-fechadesde').value = fmtDateInput(p.fechadesde);
    document.getElementById('period-form-fechahasta').value = fmtDateInput(p.fechahasta);
    document.getElementById('period-form-comentario').value = p.comentario || '';
    document.getElementById('period-form-activo').checked   = p.activo === true;

    const canWrite = window.hasPermission('view-periods', 'escribir');
    document.getElementById('period-modal-title').textContent = canWrite ? 'Editar Período' : 'Detalles del Período';
    openModal();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  window.deletePeriod = (id) => openDeleteModal(id, 'period');

  // ── Submit ────────────────────────────────────────────────────────────────
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id          = document.getElementById('period-form-id').value;
    const periodo     = document.getElementById('period-form-periodo').value.trim();
    const fechadesde  = document.getElementById('period-form-fechadesde').value || null;
    const fechahasta  = document.getElementById('period-form-fechahasta').value || null;
    const comentario  = document.getElementById('period-form-comentario').value.trim() || null;
    const activo      = document.getElementById('period-form-activo').checked;

    const saveBtn = document.getElementById('btn-save-period-modal');
    const origTxt = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg> Guardando...`;

    try {
      const payload = { periodo, fechadesde, fechahasta, comentario, activo };
      const url    = id ? `${supabaseUrl}periodos?id=eq.${id}` : `${supabaseUrl}periodos`;
      const method = id ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Fallo al guardar el período en Supabase.');

      showToast(id ? 'Período actualizado con éxito.' : 'Período creado con éxito.', true);
      closeModal();
      loadPeriods();
    } catch (err) {
      console.error('Save period error:', err);
      showToast(err.message || 'Error al guardar el período.', false);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origTxt;
    }
  });

  // ── Search ────────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('periods-search');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        periodsSearchQuery = e.target.value.trim();
        periodsPage = 1;
        loadPeriods();
      }, 300);
    });
  }

  // ── Filter Activo ─────────────────────────────────────────────────────────
  const filterActivo = document.getElementById('periods-filter-activo');
  if (filterActivo) {
    filterActivo.addEventListener('change', (e) => {
      periodsFilterActivo = e.target.value;
      periodsPage = 1;
      loadPeriods();
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  document.getElementById('periods-btn-prev')?.addEventListener('click', () => {
    if (periodsPage > 1) { periodsPage--; loadPeriods(); }
  });
  document.getElementById('periods-btn-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(periodsTotalCount / periodsPageSize);
    if (periodsPage < totalPages) { periodsPage++; loadPeriods(); }
  });
};

window.generateYearPeriods = generateYearPeriods;

export { periodsTotalCount, periodsPage, periodsPageSize, periodsSearchQuery };

