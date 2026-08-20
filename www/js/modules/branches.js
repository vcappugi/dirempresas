import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let branchesPage = 1;
const branchesPageSize = 5;
let branchesSearchQuery = "";
let branchesFilterEmpresa = "";
let branchesFilterRegion = "";
let branchesFilterParticipacion = "";
let branchesFilterSistema = "";
let branchesTotalCount = 0;
let branchesList = [];

// Populate companies select dynamically
export const loadCompaniesForSelect = async (selectedEmpresaId = null) => {
  const selectEl = document.getElementById('branch-form-empresa');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cargando empresas...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    let url = `${supabaseUrl}empresa?activo=eq.true&order=razon.asc`;
    if (!window.isAdmin) {
      if (window.userAllowedCompanyIds && window.userAllowedCompanyIds.length > 0) {
        url = `${supabaseUrl}empresa?id=in.(${window.userAllowedCompanyIds.join(',')})&order=razon.asc`;
      } else {
        url = `${supabaseUrl}empresa?id=eq.-1`;
      }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar las empresas.");

    const companies = await res.json();
    selectEl.innerHTML = window.isAdmin 
      ? '<option value="">Seleccione una empresa...</option>'
      : '';

    companies.forEach(comp => {
      const option = document.createElement('option');
      option.value = comp.id;
      option.textContent = comp.razon;
      if (selectedEmpresaId && comp.id === parseInt(selectedEmpresaId, 10)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading companies for select:", err);
    selectEl.innerHTML = '<option value="">Error al cargar empresas</option>';
  }
};

// Populate regions select dynamically
export const loadRegionsForSelect = async (selectedRegionId = null) => {
  const selectEl = document.getElementById('branch-form-region');
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

export const loadCompaniesForFilter = async () => {
  const selectEl = document.getElementById('branches-filter-empresa');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Todas las empresas</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    let url = `${supabaseUrl}empresa?activo=eq.true&order=razon.asc`;
    if (!window.isAdmin) {
      if (window.userAllowedCompanyIds && window.userAllowedCompanyIds.length > 0) {
        url = `${supabaseUrl}empresa?id=in.(${window.userAllowedCompanyIds.join(',')})&order=razon.asc`;
      } else {
        url = `${supabaseUrl}empresa?id=eq.-1`;
      }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar las empresas para filtro.");

    const companies = await res.json();
    companies.forEach(comp => {
      const option = document.createElement('option');
      option.value = comp.id;
      option.textContent = comp.razon;
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading companies for filter:", err);
  }
};

export const loadRegionsForFilter = async () => {
  const selectEl = document.getElementById('branches-filter-region');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Todas las regiones</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const res = await fetch(`${supabaseUrl}region?activo=eq.true&order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar las regiones para filtro.");

    const regions = await res.json();
    regions.forEach(reg => {
      const option = document.createElement('option');
      option.value = reg.id;
      option.textContent = reg.nombre;
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading regions for filter:", err);
  }
};

export const loadParticipationsForFilter = async () => {
  const selectEl = document.getElementById('branches-filter-participacion');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cualquier participación</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    let url = `${supabaseUrl}sucursales?select=participacion`;
    if (!window.isAdmin) {
      const compId = window.userCompanyId || -1;
      url += `&empresa_id=eq.${compId}`;
    }
    
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar las participaciones.");

    const data = await res.json();
    const parts = data
      .map(item => item.participacion)
      .filter(p => p !== null && p !== undefined);
    const uniqueParts = [...new Set(parts)].sort((a, b) => b - a);

    uniqueParts.forEach(val => {
      const option = document.createElement('option');
      option.value = val;
      option.textContent = `${val}%`;
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading participations for filter:", err);
  }
};

export const loadSystemsForFilter = async () => {
  const selectEl = document.getElementById('branches-filter-sistema');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cualquier sistema</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    let url = `${supabaseUrl}sucursales?select=sistema`;
    if (!window.isAdmin) {
      const compId = window.userCompanyId || -1;
      url += `&empresa_id=eq.${compId}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar los sistemas.");

    const data = await res.json();
    const systems = data
      .map(item => item.sistema)
      .filter(s => s !== null && s !== undefined && s.trim() !== "");
    const uniqueSystems = [...new Set(systems)].sort();

    uniqueSystems.forEach(val => {
      const option = document.createElement('option');
      option.value = val;
      option.textContent = val;
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading systems for filter:", err);
  }
};

export const loadBranches = async () => {
  const loadingEl = document.getElementById('branches-loading');
  const tableBody = document.getElementById('branches-table-body');
  const emptyEl = document.getElementById('branches-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (branchesPage - 1) * branchesPageSize;
  const end = start + branchesPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}sucursales?select=*,empresa:empresa_id(razon,participacion),region:region_id(nombre)`;

    if (!window.isAdmin) {
      if (!window.userAllowedBranchIds || window.userAllowedBranchIds.length === 0) {
        branchesList = [];
        branchesTotalCount = 0;
        emptyEl?.classList.remove('hidden');
        updateBranchesPaginationUI(0, 0);
        loadingEl?.classList.add('hidden');
        return;
      }
      queryUrl += `&id=in.(${window.userAllowedBranchIds.join(',')})`;
    }

    if (branchesFilterEmpresa) {
      queryUrl += `&empresa_id=eq.${branchesFilterEmpresa}`;
    }

    if (branchesFilterRegion) {
      queryUrl += `&region_id=eq.${branchesFilterRegion}`;
    }

    if (branchesFilterParticipacion) {
      queryUrl += `&participacion=eq.${branchesFilterParticipacion}`;
    }

    if (branchesFilterSistema) {
      queryUrl += `&sistema=eq.${encodeURIComponent(branchesFilterSistema)}`;
    }

    if (branchesSearchQuery) {
      const encSearch = encodeURIComponent(branchesSearchQuery);
      queryUrl += `&nombre=ilike.*${encSearch}*`;
    }

    queryUrl += `&order=id.asc`;

    const headers = getHeaders();
    headers["Prefer"] = "count=exact";
    headers["Range"] = `${start}-${end}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} - No se pudo conectar a la base de datos.`);
    
    branchesList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        branchesTotalCount = parseInt(parts[1], 10);
      }
    } else {
      branchesTotalCount = branchesList.length;
    }

    if (branchesList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateBranchesPaginationUI(0, 0);
    } else {
      branchesList.forEach(branch => {
        const empresaName = branch.empresa ? escapeHtml(branch.empresa.razon) : `<span class="text-slate-400 italic">No asignada</span>`;
        const regionName = branch.region ? escapeHtml(branch.region.nombre) : `<span class="text-slate-400 italic">No asignada</span>`;
        const sistemaVal = branch.sistema ? escapeHtml(branch.sistema) : '-';
        const estatusVal = branch.estatus_operativo ? escapeHtml(branch.estatus_operativo) : '-';
        
        let fechaAperturaText = '-';
        if (branch.fecha_apertura) {
          const parts = branch.fecha_apertura.split('-');
          if (parts.length === 3) {
            fechaAperturaText = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            fechaAperturaText = branch.fecha_apertura;
          }
        }

        const canWrite = window.hasPermission('view-branches', 'escribir') && (window.isAdmin || window.canEditBranch?.(branch.id, branch.empresa_id));
        
        const btnDetalles = `
          <button onclick="openBranchDetailsModal(${branch.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm border border-slate-200/50 dark:border-slate-700/50" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </button>
        `;

        const btnFicha = `
          <button onclick="printBranchReport(${branch.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100/80 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 transition-all duration-200 shadow-sm border border-emerald-200/40 dark:border-emerald-800/40" title="Imprimir Ficha">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
          </button>
        `;

        const btnEditar = `
          <button onclick="editBranch(${branch.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Sucursal">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editBranch(${branch.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteBranch(${branch.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Sucursal">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        `;

        const editDeleteRow = canWrite
          ? `${btnEditar}${btnEliminar}`
          : `${btnVer}`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200 text-xs';
        row.innerHTML = `
          <td class="px-4 py-3 text-left whitespace-nowrap">
            <div class="flex flex-col gap-1.5 w-max">
              <div class="flex items-center gap-1.5">
                ${btnDetalles}
                ${btnFicha}
              </div>
              <div class="flex items-center gap-1.5">
                ${editDeleteRow}
              </div>
            </div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white">${branch.id}</td>
          <td class="px-4 py-3 font-medium">
            <button onclick="editBranch(${branch.id})" class="text-brand hover:text-brand-light font-semibold hover:underline text-left transition-all">
              ${escapeHtml(branch.nombre || '')}
            </button>
          </td>
          <td class="px-4 py-3 text-slate-650 dark:text-slate-205 font-medium">${empresaName}</td>
          <td class="px-4 py-3 text-slate-650 dark:text-slate-205 font-medium">${regionName}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${sistemaVal}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${fechaAperturaText}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${estatusVal}</td>
        `;
        tableBody.appendChild(row);
      });
      updateBranchesPaginationUI(start + 1, start + branchesList.length);
    }
  } catch (err) {
    console.error("Error loading branches:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando sucursales.'}
        </td>
      </tr>
    `;
    updateBranchesPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateBranchesPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('branches-range-start');
  const rangeEndEl = document.getElementById('branches-range-end');
  const totalCountEl = document.getElementById('branches-total-count');
  const currentPageEl = document.getElementById('branches-current-page');
  const totalPagesEl = document.getElementById('branches-total-pages');
  const btnPrev = document.getElementById('branches-btn-prev');
  const btnNext = document.getElementById('branches-btn-next');

  const totalPages = Math.ceil(branchesTotalCount / branchesPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = branchesTotalCount;
  if (currentPageEl) currentPageEl.textContent = branchesPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = branchesPage <= 1;
  if (btnNext) btnNext.disabled = branchesPage >= totalPages;
};

export const initBranchesModule = () => {
  const branchModalOverlay = document.getElementById('branch-modal-overlay');
  const branchModalCard = document.getElementById('branch-modal-card');
  const btnCloseBranchModal = document.getElementById('btn-close-branch-modal');
  const btnCancelBranchModal = document.getElementById('btn-cancel-branch-modal');
  const btnAddBranch = document.getElementById('btn-add-branch');
  const branchForm = document.getElementById('branch-form');

  const openBranchModal = (branchId = null, companyId = null) => {
    if (!branchModalOverlay || !branchModalCard) return;
    branchModalOverlay.classList.remove('hidden');
    branchModalOverlay.offsetHeight;
    branchModalOverlay.classList.remove('opacity-0');
    branchModalOverlay.classList.add('opacity-100');
    branchModalCard.classList.remove('scale-95', 'opacity-0');
    branchModalCard.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-branches', 'escribir') && (window.isAdmin || (branchId ? window.canEditBranch?.(branchId, companyId) : true));
    const saveBtn = document.getElementById('btn-save-branch-modal');
    if (saveBtn) {
      saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    }
    if (branchForm) {
      const inputs = branchForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !canWrite;
      });
    }
  };

  const closeBranchModal = () => {
    if (!branchModalOverlay || !branchModalCard) return;
    branchModalOverlay.classList.remove('opacity-100');
    branchModalOverlay.classList.add('opacity-0');
    branchModalCard.classList.remove('scale-100', 'opacity-100');
    branchModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      branchModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnAddBranch) {
    const canWrite = window.hasPermission('view-branches', 'escribir');
    btnAddBranch.style.display = canWrite ? 'inline-flex' : 'none';
    btnAddBranch.addEventListener('click', async () => {
      document.getElementById('branch-form-id').value = '';
      document.getElementById('branch-form-nombre').value = '';
      document.getElementById('branch-form-sistema').value = '';
      document.getElementById('branch-form-fecha').value = '';
      document.getElementById('branch-form-estatus').value = '';

      const detailsBtn = document.getElementById('btn-manage-branch-details');
      if (detailsBtn) detailsBtn.classList.add('hidden');

      const reportBtn = document.getElementById('btn-print-branch-report');
      if (reportBtn) reportBtn.classList.add('hidden');

      await loadCompaniesForSelect();
      await loadRegionsForSelect();

      document.getElementById('branch-modal-title').textContent = 'Crear Sucursal';
      openBranchModal();
    });
  }

  if (btnCloseBranchModal) btnCloseBranchModal.addEventListener('click', closeBranchModal);
  if (btnCancelBranchModal) btnCancelBranchModal.addEventListener('click', closeBranchModal);

  const btnManageDetails = document.getElementById('btn-manage-branch-details');
  if (btnManageDetails) {
    btnManageDetails.addEventListener('click', () => {
      const branchId = document.getElementById('branch-form-id').value;
      if (branchId) {
        closeBranchModal();
        window.openBranchDetailsModal?.(parseInt(branchId, 10));
      }
    });
  }

  const btnPrintReport = document.getElementById('btn-print-branch-report');
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      const branchId = document.getElementById('branch-form-id').value;
      if (branchId) {
        printBranchReport(parseInt(branchId, 10));
      }
    });
  }

  window.editBranch = async (id) => {
    const branch = branchesList.find(b => b.id === id);
    if (!branch) return;

    document.getElementById('branch-form-id').value = branch.id;
    document.getElementById('branch-form-nombre').value = branch.nombre || '';
    document.getElementById('branch-form-sistema').value = branch.sistema || '';
    document.getElementById('branch-form-fecha').value = branch.fecha_apertura || '';
    document.getElementById('branch-form-estatus').value = branch.estatus_operativo || '';

    const detailsBtn = document.getElementById('btn-manage-branch-details');
    if (detailsBtn) detailsBtn.classList.remove('hidden');

    const reportBtn = document.getElementById('btn-print-branch-report');
    if (reportBtn) reportBtn.classList.remove('hidden');

    await loadCompaniesForSelect(branch.empresa_id);
    await loadRegionsForSelect(branch.region_id);

    const canWrite = window.hasPermission('view-branches', 'escribir') && (window.isAdmin || window.canEditBranch?.(branch.id, branch.empresa_id));
    document.getElementById('branch-modal-title').textContent = canWrite ? 'Editar Sucursal' : 'Detalles de la Sucursal (Solo Lectura)';
    openBranchModal(branch.id, branch.empresa_id);
  };

  window.deleteBranch = (id) => {
    openDeleteModal(id, 'branch');
  };

  if (branchForm) {
    branchForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('branch-form-id').value;
      const nombre = document.getElementById('branch-form-nombre').value;
      const empresaVal = document.getElementById('branch-form-empresa').value;
      const empresa_id = empresaVal ? parseInt(empresaVal, 10) : null;
      const regionVal = document.getElementById('branch-form-region').value;
      const region_id = regionVal ? parseInt(regionVal, 10) : null;
      const sistema = document.getElementById('branch-form-sistema').value;
      const fechaAperturaVal = document.getElementById('branch-form-fecha').value;
      const fecha_apertura = fechaAperturaVal !== '' ? fechaAperturaVal : null;
      const estatus_operativo = document.getElementById('branch-form-estatus').value;

      const saveBtn = document.getElementById('btn-save-branch-modal');
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
          nombre, empresa_id, region_id, sistema, fecha_apertura, estatus_operativo
        };

        let url = `${supabaseUrl}sucursales`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}sucursales?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos de la sucursal en Supabase.");

        showToast(id ? 'Sucursal actualizada con éxito.' : 'Sucursal creada con éxito.', true);
        closeBranchModal();
        loadBranches();
        loadSystemsForFilter();
      } catch (err) {
        console.error("Save branch error:", err);
        showToast(err.message || 'Error al guardar los datos de la sucursal.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Initialize and register filters
  const filterEmpresaEl = document.getElementById('branches-filter-empresa');
  const filterRegionEl = document.getElementById('branches-filter-region');
  const filterParticipacionEl = document.getElementById('branches-filter-participacion');
  const filterSistemaEl = document.getElementById('branches-filter-sistema');
  const filterEmpresaContainer = document.getElementById('branches-filter-empresa-container');

  if (!window.isAdmin && filterEmpresaContainer) {
    filterEmpresaContainer.style.display = 'none';
  }

  // Load select options
  loadCompaniesForFilter();
  loadRegionsForFilter();
  loadParticipationsForFilter();
  loadSystemsForFilter();

  if (filterEmpresaEl) {
    filterEmpresaEl.addEventListener('change', (e) => {
      branchesFilterEmpresa = e.target.value;
      branchesPage = 1;
      loadBranches();
    });
  }

  if (filterRegionEl) {
    filterRegionEl.addEventListener('change', (e) => {
      branchesFilterRegion = e.target.value;
      branchesPage = 1;
      loadBranches();
    });
  }

  if (filterParticipacionEl) {
    filterParticipacionEl.addEventListener('change', (e) => {
      branchesFilterParticipacion = e.target.value;
      branchesPage = 1;
      loadBranches();
    });
  }

  if (filterSistemaEl) {
    filterSistemaEl.addEventListener('change', (e) => {
      branchesFilterSistema = e.target.value;
      branchesPage = 1;
      loadBranches();
    });
  }

  // Search input with debounce
  const searchInput = document.getElementById('branches-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        branchesSearchQuery = e.target.value.trim();
        branchesPage = 1;
        loadBranches();
      }, 300);
    });
  }

  // Pagination buttons
  const btnPrev = document.getElementById('branches-btn-prev');
  const btnNext = document.getElementById('branches-btn-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (branchesPage > 1) {
        branchesPage--;
        loadBranches();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(branchesTotalCount / branchesPageSize);
      if (branchesPage < totalPages) {
        branchesPage++;
        loadBranches();
      }
    });
  }

  // Print and Export Excel buttons
  const btnPrintBranches = document.getElementById('btn-print-branches-report');
  if (btnPrintBranches) {
    btnPrintBranches.addEventListener('click', () => {
      printBranchesListReport();
    });
  }

  const btnExportBranches = document.getElementById('btn-export-branches-excel');
  if (btnExportBranches) {
    btnExportBranches.addEventListener('click', () => {
      exportBranchesToExcel();
    });
  }
};

export const printBranchReport = async (branchId) => {
  const branch = branchesList.find(b => b.id === branchId);
  if (!branch) return;

  showToast("Generando Ficha de Sucursal...", true);

  try {
    // Fetch details for this branch, ordered by orden.asc,id.asc
    const res = await fetch(`${supabaseUrl}detalle_sucursales?sucursal_id=eq.${branchId}&order=orden.asc,id.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron obtener los detalles para la ficha.");
    const details = await res.json();

    // Construct print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast("Por favor, permite las ventanas emergentes para poder imprimir.", false);
      return;
    }

    const escapeHtmlHelper = (str) => {
      if (!str) return '';
      return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const formatFecha = (f) => {
      if (!f) return '-';
      const parts = f.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return f;
    };

    // Build the details rows HTML
    let detailsRows = '';
    if (details.length === 0) {
      detailsRows = `
        <tr>
          <td colspan="5" style="padding: 10px; text-align: center; color: #64748b; font-style: italic; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            No hay detalles registrados para esta sucursal.
          </td>
        </tr>
      `;
    } else {
      details.forEach(det => {
        detailsRows += `
          <tr style="page-break-inside: avoid;">
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; font-size: 11px; text-align: center; color: #0f172a;">${det.orden !== null && det.orden !== undefined ? det.orden : '-'}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 11px; color: #0f172a;">${escapeHtmlHelper(det.tipo)}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 10px; color: #64748b;">${formatFecha(det.fecha)}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 600; color: #0f172a; word-break: break-all;">${escapeHtmlHelper(det.valor)}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #475569;">${det.comentario ? escapeHtmlHelper(det.comentario) : '-'}</td>
          </tr>
        `;
      });
    }

    const empresaName = branch.empresa ? branch.empresa.razon : 'No asignada';
    const regionName = branch.region ? branch.region.nombre : 'No asignada';

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha de Sucursal - ${escapeHtmlHelper(branch.nombre)}</title>
  <style>
    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
        margin: 0;
        padding: 0;
        font-size: 11px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none; }
      .container { max-width: 100% !important; margin: 0 !important; padding: 10px !important; box-shadow: none !important; border: none !important; }
      .grid { gap: 10px !important; margin-bottom: 15px !important; }
      .field-card { padding: 8px 12px !important; border-radius: 8px !important; }
      .field-label { font-size: 9px !important; margin-bottom: 2px !important; }
      .field-value { font-size: 12px !important; }
      .section-title { font-size: 14px !important; margin: 15px 0 8px 0 !important; }
      th, td { padding: 6px 10px !important; font-size: 10px !important; }
      .header-title-container { margin-bottom: 15px !important; padding-bottom: 8px !important; }
      .header-title { font-size: 20px !important; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 30px 15px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 30px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    .header-title-container {
      border-bottom: 3px solid #10b981;
      padding-bottom: 10px;
      width: 100%;
      margin-bottom: 20px;
    }
    .header-title {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .field-card {
      background-color: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .field-value {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    .col-span-2 {
      grid-column: span 2;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0f172a;
      border-left: 4px solid #10b981;
      padding-left: 8px;
      margin: 25px 0 10px 0;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
    }
    .print-btn-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 15px;
    }
    .print-btn {
      background-color: #10b981;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 6px -1px rgb(16 185 129 / 0.2);
    }
    .print-btn:hover {
      background-color: #059669;
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="print-btn-bar no-print">
      <button class="print-btn" onclick="window.print()">
        <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm-1 9H8v3h4v-3z" clip-rule="evenodd"></path>
        </svg>
        Imprimir Ficha
      </button>
    </div>

    <div class="header-title-container">
      <h1 class="header-title">Ficha Informativa de Sucursal</h1>
    </div>

    <div class="grid">
      <div class="field-card">
        <div class="field-label">ID Sucursal</div>
        <div class="field-value">${branch.id}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Nombre de Sucursal</div>
        <div class="field-value">${escapeHtmlHelper(branch.nombre)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Empresa Asociada</div>
        <div class="field-value">${escapeHtmlHelper(empresaName)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Región</div>
        <div class="field-value">${escapeHtmlHelper(regionName)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Sistema Operativo / ERP</div>
        <div class="field-value">${branch.sistema ? escapeHtmlHelper(branch.sistema) : '-'}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Fecha de Apertura</div>
        <div class="field-value" style="font-family: monospace;">${formatFecha(branch.fecha_apertura)}</div>
      </div>
      <div class="field-card col-span-2">
        <div class="field-label">Estatus Operativo</div>
        <div class="field-value">${branch.estatus_operativo ? escapeHtmlHelper(branch.estatus_operativo) : '-'}</div>
      </div>
    </div>

    <div class="section-title">Detalles Adicionales de la Sucursal</div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px; text-align: center;">Orden</th>
          <th style="width: 140px;">Tipo de Detalle</th>
          <th style="width: 100px;">Fecha Reg.</th>
          <th>Valor / Registro</th>
          <th>Comentario / Descripción</th>
        </tr>
      </thead>
      <tbody>
        ${detailsRows}
      </tbody>
    </table>
  </div>

</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Trigger print automatically after slight delay to ensure browser loads document structure
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);

  } catch (err) {
    console.error("Print branch report error:", err);
    showToast(err.message || "Error al generar la ficha de sucursal.", false);
  }
};

window.printBranchReport = printBranchReport;

const getFilteredBranchesUrl = () => {
  let queryUrl = `${supabaseUrl}sucursales?select=*,empresa:empresa_id(razon,participacion),region:region_id(nombre)`;

  if (!window.isAdmin) {
    const compId = window.userCompanyId || -1;
    queryUrl += `&empresa_id=eq.${compId}`;
  } else if (branchesFilterEmpresa) {
    queryUrl += `&empresa_id=eq.${branchesFilterEmpresa}`;
  }

  if (branchesFilterRegion) {
    queryUrl += `&region_id=eq.${branchesFilterRegion}`;
  }

  if (branchesFilterParticipacion) {
    queryUrl += `&participacion=eq.${branchesFilterParticipacion}`;
  }

  if (branchesFilterSistema) {
    queryUrl += `&sistema=eq.${encodeURIComponent(branchesFilterSistema)}`;
  }

  if (branchesSearchQuery) {
    const encSearch = encodeURIComponent(branchesSearchQuery);
    queryUrl += `&nombre=ilike.*${encSearch}*`;
  }

  queryUrl += `&order=id.asc`;
  return queryUrl;
};

export const printBranchesListReport = async () => {
  showToast("Generando Reporte de Listado...", true);

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const queryUrl = getFilteredBranchesUrl();
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron obtener las sucursales para el reporte.");
    const branches = await res.json();

    // Construct print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast("Por favor, permite las ventanas emergentes para poder imprimir.", false);
      return;
    }

    const escapeHtmlHelper = (str) => {
      if (!str) return '';
      return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // Build rows HTML
    let rowsHtml = '';
    if (branches.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" style="padding: 12px; text-align: center; color: #64748b; font-style: italic; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            No hay sucursales registradas.
          </td>
        </tr>
      `;
    } else {
      branches.forEach(branch => {
        const estadoText = branch.estatus_operativo ? escapeHtmlHelper(branch.estatus_operativo) : '-';
        const estadoStyle = (branch.estatus_operativo && branch.estatus_operativo.toLowerCase() === 'activa') ? 'color: #15803d; font-weight: 600;' : 'color: #64748b;';
        const empresaText = branch.empresa ? escapeHtmlHelper(branch.empresa.razon) : '-';
        const regionText = branch.region ? escapeHtmlHelper(branch.region.nombre) : '-';
        const sistemaText = branch.sistema ? escapeHtmlHelper(branch.sistema) : '-';
        
        let fechaAperturaText = '-';
        if (branch.fecha_apertura) {
          const parts = branch.fecha_apertura.split('-');
          if (parts.length === 3) {
            fechaAperturaText = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            fechaAperturaText = branch.fecha_apertura;
          }
        }

        rowsHtml += `
          <tr style="page-break-inside: avoid;">
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; font-size: 10px; color: #0f172a; white-space: nowrap;">${branch.id}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 10px; color: #0f172a;">${escapeHtmlHelper(branch.nombre)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #334155;">${empresaText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #334155;">${regionText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #334155;">${sistemaText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 10px; color: #334155; white-space: nowrap;">${fechaAperturaText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; ${estadoStyle}">${estadoText}</td>
          </tr>
        `;
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte de Sucursales</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; line-height: 1.4; }
          .header { margin-bottom: 25px; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
          .header h1 { font-size: 20px; margin: 0 0 5px 0; color: #4f46e5; font-weight: bold; text-transform: uppercase; }
          .header p { margin: 0; font-size: 11px; color: #64748b; }
          .meta-info { margin-bottom: 15px; font-size: 10px; color: #475569; background-color: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #f1f5f9; display: inline-block; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #f8fafc; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 9px; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; border-top: 1px solid #e2e8f0; }
          tr:nth-child(even) { background-color: #f8fafc; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            @page { size: letter landscape; margin: 0.8cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Reporte General de Sucursales</h1>
          <p>Listado del total de sucursales según filtros activos.</p>
        </div>
        <div class="meta-info font-mono">
          <strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | 
          <strong>Total Registros:</strong> ${branches.length}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">ID</th>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Región</th>
              <th>Sistema</th>
              <th style="width: 100px;">Fecha Apertura</th>
              <th style="width: 80px;">Estatus</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

  } catch (err) {
    console.error("Print report error:", err);
    showToast(err.message || 'Error al generar el reporte de impresión.', false);
  }
};

export const exportBranchesToExcel = async () => {
  showToast("Exportando Listado a Excel...", true);

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const queryUrl = getFilteredBranchesUrl();
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron obtener las sucursales para exportar.");
    const branches = await res.json();

    if (branches.length === 0) {
      showToast("No hay registros para exportar.", false);
      return;
    }

    let csvContent = "\uFEFF";
    
    // Header row
    csvContent += "ID;Nombre;Empresa;Región;Sistema;Fecha Apertura;Estatus\n";

    branches.forEach(item => {
      const id = item.id;
      const nombre = (item.nombre || '').replace(/;/g, ',');
      const empresa = (item.empresa ? item.empresa.razon : '-').replace(/;/g, ',');
      const region = (item.region ? item.region.nombre : '-').replace(/;/g, ',');
      const sistema = (item.sistema || '-').replace(/;/g, ',');
      const fecha = item.fecha_apertura || '-';
      const estatus = item.estatus_operativo || '-';

      csvContent += `${id};${nombre};${empresa};${region};${sistema};${fecha};${estatus}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `listado_sucursales_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Exportación completada con éxito.", true);

  } catch (err) {
    console.error("Export to Excel error:", err);
    showToast(err.message || 'Error al exportar a Excel.', false);
  }
};

window.printBranchesListReport = printBranchesListReport;
window.exportBranchesToExcel = exportBranchesToExcel;

export { branchesPage, branchesPageSize, branchesSearchQuery, branchesTotalCount, branchesList };
