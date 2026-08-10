import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let companiesPage = 1;
const companiesPageSize = 5;
let companiesSearchQuery = "";
let companiesTotalCount = 0;
let companiesList = [];

export const loadRegionsForSelect = async (selectedRegionId = null) => {
  const selectEl = document.getElementById('company-form-region');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cargando regiones...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const res = await fetch(`${supabaseUrl}region?activo=eq.true&order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar las regiones.");

    const regions = await res.json();
    selectEl.innerHTML = '<option value="">Seleccione una región...</option>';

    regions.forEach(reg => {
      const option = document.createElement('option');
      option.value = reg.id;
      option.textContent = reg.nombre;
      if (selectedRegionId && reg.id === parseInt(selectedRegionId, 10)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading regions for select:", err);
    selectEl.innerHTML = '<option value="">Error al cargar regiones</option>';
  }
};

export const loadCompanies = async () => {
  const loadingEl = document.getElementById('companies-loading');
  const tableBody = document.getElementById('companies-table-body');
  const emptyEl = document.getElementById('companies-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (companiesPage - 1) * companiesPageSize;
  const end = start + companiesPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}empresa`;

    if (companiesSearchQuery) {
      const encSearch = encodeURIComponent(companiesSearchQuery);
      queryUrl += `?or=(razon.ilike.*${encSearch}*,rif.ilike.*${encSearch}*,codigo.ilike.*${encSearch}*)&order=id.asc`;
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
    
    companiesList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        companiesTotalCount = parseInt(parts[1], 10);
      }
    } else {
      companiesTotalCount = companiesList.length;
    }

    if (companiesList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateCompaniesPaginationUI(0, 0);
    } else {
      companiesList.forEach(comp => {
        const statusBadge = comp.activo
          ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Activa</span>`
          : `<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inactiva</span>`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${escapeHtml(comp.codigo)}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-255 font-medium">${escapeHtml(comp.razon)}</td>
          <td class="px-6 py-4 text-slate-550 dark:text-slate-400 font-mono text-xs">${escapeHtml(comp.rif)}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            <button onclick="openDetailsModal(${comp.id})" class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-500/10 transition-colors">Detalles</button>
            <button onclick="editCompany(${comp.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
            <button onclick="deleteCompany(${comp.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
      updateCompaniesPaginationUI(start + 1, start + companiesList.length);
    }
  } catch (err) {
    console.error("Error loading companies:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando empresas.'}
        </td>
      </tr>
    `;
    updateCompaniesPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateCompaniesPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('companies-range-start');
  const rangeEndEl = document.getElementById('companies-range-end');
  const totalCountEl = document.getElementById('companies-total-count');
  const currentPageEl = document.getElementById('companies-current-page');
  const totalPagesEl = document.getElementById('companies-total-pages');
  const btnPrev = document.getElementById('companies-btn-prev');
  const btnNext = document.getElementById('companies-btn-next');

  const totalPages = Math.ceil(companiesTotalCount / companiesPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = companiesTotalCount;
  if (currentPageEl) currentPageEl.textContent = companiesPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = companiesPage <= 1;
  if (btnNext) btnNext.disabled = companiesPage >= totalPages;
};

export const initCompaniesModule = () => {
  const companyModalOverlay = document.getElementById('company-modal-overlay');
  const companyModalCard = document.getElementById('company-modal-card');
  const btnCloseCompanyModal = document.getElementById('btn-close-company-modal');
  const btnCancelCompanyModal = document.getElementById('btn-cancel-company-modal');
  const btnAddCompany = document.getElementById('btn-add-company');
  const companyForm = document.getElementById('company-form');

  const openCompanyModal = () => {
    if (!companyModalOverlay || !companyModalCard) return;
    companyModalOverlay.classList.remove('hidden');
    companyModalOverlay.offsetHeight;
    companyModalOverlay.classList.remove('opacity-0');
    companyModalOverlay.classList.add('opacity-100');
    companyModalCard.classList.remove('scale-95', 'opacity-0');
    companyModalCard.classList.add('scale-100', 'opacity-100');
  };

  const closeCompanyModal = () => {
    if (!companyModalOverlay || !companyModalCard) return;
    companyModalOverlay.classList.remove('opacity-100');
    companyModalOverlay.classList.add('opacity-0');
    companyModalCard.classList.remove('scale-100', 'opacity-100');
    companyModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      companyModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnAddCompany) {
    btnAddCompany.addEventListener('click', async () => {
      document.getElementById('company-form-id').value = '';
      document.getElementById('company-form-codigo').value = '';
      document.getElementById('company-form-razon').value = '';
      document.getElementById('company-form-rif').value = '';
      document.getElementById('company-form-fecha').value = '';
      document.getElementById('company-form-maestro').value = '';
      document.getElementById('company-form-libro').value = 'activo';
      document.getElementById('company-form-sistema').value = '';
      document.getElementById('company-form-participacion').value = '';
      document.getElementById('company-form-observacion').value = '';
      document.getElementById('company-form-activo').checked = true;

      const detailsBtn = document.getElementById('btn-manage-company-details');
      if (detailsBtn) detailsBtn.classList.add('hidden');

      await loadRegionsForSelect();

      document.getElementById('company-modal-title').textContent = 'Crear Empresa';
      openCompanyModal();
    });
  }

  if (btnCloseCompanyModal) btnCloseCompanyModal.addEventListener('click', closeCompanyModal);
  if (btnCancelCompanyModal) btnCancelCompanyModal.addEventListener('click', closeCompanyModal);

  const btnManageDetails = document.getElementById('btn-manage-company-details');
  if (btnManageDetails) {
    btnManageDetails.addEventListener('click', () => {
      const companyId = document.getElementById('company-form-id').value;
      if (companyId) {
        closeCompanyModal();
        window.openDetailsModal?.(parseInt(companyId, 10));
      }
    });
  }

  window.editCompany = async (id) => {
    const comp = companiesList.find(c => c.id === id);
    if (!comp) return;

    document.getElementById('company-form-id').value = comp.id;
    document.getElementById('company-form-codigo').value = comp.codigo || '';
    document.getElementById('company-form-razon').value = comp.razon || '';
    document.getElementById('company-form-rif').value = comp.rif || '';
    document.getElementById('company-form-fecha').value = comp.fecha_apertura || '';
    document.getElementById('company-form-maestro').value = comp.codigo_maestro || '';
    document.getElementById('company-form-libro').value = comp.estatus_libro || 'activo';
    document.getElementById('company-form-sistema').value = comp.sistema || '';
    document.getElementById('company-form-participacion').value = comp.participacion || '';
    document.getElementById('company-form-observacion').value = comp.observacion || '';
    document.getElementById('company-form-activo').checked = comp.activo === true;

    const detailsBtn = document.getElementById('btn-manage-company-details');
    if (detailsBtn) detailsBtn.classList.remove('hidden');

    await loadRegionsForSelect(comp.region_id);

    document.getElementById('company-modal-title').textContent = 'Editar Empresa';
    openCompanyModal();
  };

  window.deleteCompany = (id) => {
    openDeleteModal(id, 'company');
  };

  if (companyForm) {
    companyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('company-form-id').value;
      const codigo = document.getElementById('company-form-codigo').value;
      const razon = document.getElementById('company-form-razon').value;
      const rif = document.getElementById('company-form-rif').value;
      const fecha_apertura = document.getElementById('company-form-fecha').value;
      const codigo_maestro = document.getElementById('company-form-maestro').value;
      const estatus_libro = document.getElementById('company-form-libro').value;
      const sistema = document.getElementById('company-form-sistema').value;
      const participacion = document.getElementById('company-form-participacion').value;
      const regionVal = document.getElementById('company-form-region').value;
      const region_id = regionVal ? parseInt(regionVal, 10) : null;
      const observacion = document.getElementById('company-form-observacion').value;
      const activo = document.getElementById('company-form-activo').checked;

      const saveBtn = document.getElementById('btn-save-company-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const companyData = {
          codigo, razon, rif, fecha_apertura, codigo_maestro,
          estatus_libro, sistema, participacion, region_id, observacion, activo
        };

        let url = `${supabaseUrl}empresa`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}empresa?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(companyData)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos de la empresa en Supabase.");

        showToast(id ? 'Empresa actualizada con éxito.' : 'Empresa creada con éxito.', true);
        closeCompanyModal();
        loadCompanies();
      } catch (err) {
        console.error("Save company error:", err);
        showToast(err.message || 'Error al guardar los datos de la empresa.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Companies Controls
  const companiesSearchInput = document.getElementById('companies-search');
  if (companiesSearchInput) {
    let debounceTimer;
    companiesSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        companiesSearchQuery = e.target.value.trim();
        companiesPage = 1;
        loadCompanies();
      }, 300);
    });
  }

  const companiesBtnPrev = document.getElementById('companies-btn-prev');
  const companiesBtnNext = document.getElementById('companies-btn-next');
  if (companiesBtnPrev) {
    companiesBtnPrev.addEventListener('click', () => {
      if (companiesPage > 1) {
        companiesPage--;
        loadCompanies();
      }
    });
  }
  if (companiesBtnNext) {
    companiesBtnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(companiesTotalCount / companiesPageSize);
      if (companiesPage < totalPages) {
        companiesPage++;
        loadCompanies();
      }
    });
  }
};
export { companiesPage, companiesPageSize, companiesSearchQuery, companiesTotalCount, companiesList };
