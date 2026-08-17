import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let branchesPage = 1;
const branchesPageSize = 5;
let branchesSearchQuery = "";
let branchesFilterEmpresa = "";
let branchesFilterRegion = "";
let branchesFilterParticipacion = "";
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
      const compId = window.userCompanyId || -1;
      url = `${supabaseUrl}empresa?id=eq.${compId}&order=razon.asc`;
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
      const compId = window.userCompanyId || -1;
      url = `${supabaseUrl}empresa?id=eq.${compId}&order=razon.asc`;
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

        const canWrite = window.hasPermission('view-branches', 'escribir');
        const editDeleteBtns = canWrite
          ? `<button onclick="openBranchDetailsModal(${branch.id})" class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-500/10 transition-colors">Detalles</button>
             <button onclick="editBranch(${branch.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Editar</button>
             <button onclick="deleteBranch(${branch.id})" class="text-red-500 hover:text-red-650 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>`
          : `<button onclick="openBranchDetailsModal(${branch.id})" class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-500/10 transition-colors">Detalles</button>
             <button onclick="editBranch(${branch.id})" class="text-brand hover:text-brand-light text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand/10 transition-colors">Ver</button>`;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors duration-200';
        row.innerHTML = `
          <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white">${branch.id}</td>
          <td class="px-6 py-4 text-slate-700 dark:text-slate-200 font-semibold">${escapeHtml(branch.nombre || '')}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-205 font-medium text-xs">${empresaName}</td>
          <td class="px-6 py-4 text-slate-650 dark:text-slate-205 font-medium text-xs">${regionName}</td>
          <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">${sistemaVal}</td>
          <td class="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">${fechaAperturaText}</td>
          <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">${estatusVal}</td>
          <td class="px-6 py-4 text-right space-x-1.5">
            ${editDeleteBtns}
          </td>
        `;
        tableBody.appendChild(row);
      });
      updateBranchesPaginationUI(start + 1, start + branchesList.length);
    }
  } catch (err) {
    console.error("Error loading branches:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-10 text-center text-red-500 font-semibold">
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

  const openBranchModal = () => {
    if (!branchModalOverlay || !branchModalCard) return;
    branchModalOverlay.classList.remove('hidden');
    branchModalOverlay.offsetHeight;
    branchModalOverlay.classList.remove('opacity-0');
    branchModalOverlay.classList.add('opacity-100');
    branchModalCard.classList.remove('scale-95', 'opacity-0');
    branchModalCard.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-branches', 'escribir');
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

    await loadCompaniesForSelect(branch.empresa_id);
    await loadRegionsForSelect(branch.region_id);

    const canWrite = window.hasPermission('view-branches', 'escribir');
    document.getElementById('branch-modal-title').textContent = canWrite ? 'Editar Sucursal' : 'Detalles de la Sucursal';
    openBranchModal();
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
  const filterEmpresaContainer = document.getElementById('branches-filter-empresa-container');

  if (!window.isAdmin && filterEmpresaContainer) {
    filterEmpresaContainer.style.display = 'none';
  }

  // Load select options
  loadCompaniesForFilter();
  loadRegionsForFilter();
  loadParticipationsForFilter();

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
};

export { branchesPage, branchesPageSize, branchesSearchQuery, branchesTotalCount, branchesList };
