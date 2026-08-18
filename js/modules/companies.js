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

export const loadUsersForSelect = async (selectedUserId = null) => {
  const selectEl = document.getElementById('company-form-usuario');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cargando usuarios...</option>';

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    const res = await fetch(`${supabaseUrl}usuario?order=nombre.asc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron cargar los usuarios.");

    const list = await res.json();
    selectEl.innerHTML = '<option value="">-- Sin usuario asignado --</option>';

    list.forEach(u => {
      const option = document.createElement('option');
      option.value = u.id;
      option.textContent = `${u.nombre} (${u.rol || 'usuario'})`;
      if (selectedUserId && u.id === parseInt(selectedUserId, 10)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading users for select:", err);
    selectEl.innerHTML = '<option value="">Error al cargar usuarios</option>';
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
    let queryUrl = `${supabaseUrl}empresa?select=*,usuario:usuario_id(nombre),region:region_id(nombre)`;

    if (!window.isAdmin) {
      queryUrl += `&usuario_id=eq.${window.userId}`;
    }

    if (companiesSearchQuery) {
      const encSearch = encodeURIComponent(companiesSearchQuery);
      queryUrl += `&or=(razon.ilike.*${encSearch}*,rif.ilike.*${encSearch}*,codigo.ilike.*${encSearch}*)&order=id.asc`;
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

        const userName = comp.usuario ? escapeHtml(comp.usuario.nombre) : `<span class="text-slate-400 italic">No asignado</span>`;
        const regionName = comp.region ? escapeHtml(comp.region.nombre) : `<span class="text-slate-400 italic">No asignada</span>`;

        let fechaAperturaText = '-';
        if (comp.fecha_apertura) {
          const parts = comp.fecha_apertura.split('-');
          if (parts.length === 3) {
            fechaAperturaText = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            fechaAperturaText = comp.fecha_apertura;
          }
        }

        const canWrite = window.hasPermission('view-companies', 'escribir');


        const btnDetalles = `
          <button onclick="openDetailsModal(${comp.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm border border-slate-200/50 dark:border-slate-700/50" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </button>
        `;

        const btnFicha = `
          <button onclick="printCompanyReport(${comp.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100/80 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 transition-all duration-200 shadow-sm border border-emerald-200/40 dark:border-emerald-800/40" title="Imprimir Ficha">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
          </button>
        `;

        const btnEditar = `
          <button onclick="editCompany(${comp.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Empresa">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editCompany(${comp.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteCompany(${comp.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Empresa">
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
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white">${escapeHtml(comp.codigo || '')}</td>
          <td class="px-4 py-3 font-medium">
            <button onclick="editCompany(${comp.id})" class="text-brand hover:text-brand-light font-semibold hover:underline text-left transition-all">
              ${escapeHtml(comp.razon || '')}
            </button>
          </td>
          <td class="px-4 py-3 text-slate-550 dark:text-slate-455 font-mono">${escapeHtml(comp.rif || '')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${fechaAperturaText}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${escapeHtml(comp.codigo_maestro || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize">${escapeHtml(comp.estatus_libro || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${escapeHtml(comp.sistema || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">${comp.participacion !== null && comp.participacion !== undefined ? escapeHtml(comp.participacion) + '%' : '-'}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${escapeHtml(comp.capital_suscrito || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${escapeHtml(comp.registro_merc || '-')}</td>
          <td class="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title="${escapeHtml(comp.direccion_fiscal || '')}">${escapeHtml(comp.direccion_fiscal || '-')}</td>
          <td class="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title="${escapeHtml(comp.objeto || '')}">${escapeHtml(comp.objeto || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${regionName}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400">${userName}</td>
          <td class="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title="${escapeHtml(comp.observacion || '')}">${escapeHtml(comp.observacion || '-')}</td>
          <td class="px-4 py-3">${statusBadge}</td>
        `;
        tableBody.appendChild(row);
      });
      updateCompaniesPaginationUI(start + 1, start + companiesList.length);
    }
  } catch (err) {
    console.error("Error loading companies:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-10 text-center text-red-500 font-semibold">
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

export const printCompanyReport = async (companyId) => {
  const comp = companiesList.find(c => c.id === companyId);
  if (!comp) return;

  showToast("Generando Ficha de Empresa...", true);

  try {
    // Fetch details for this company, ordered by orden.asc,id.asc
    const res = await fetch(`${supabaseUrl}detalle_empresa?empresa_id=eq.${companyId}&order=orden.asc,id.asc`, {
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
            No hay detalles registrados para esta empresa.
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

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha de Empresa - ${escapeHtmlHelper(comp.razon)}</title>
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
      <h1 class="header-title">Ficha Informativa de Empresa</h1>
    </div>

    <div class="grid">
      <div class="field-card">
        <div class="field-label">Código de la Empresa</div>
        <div class="field-value">${escapeHtmlHelper(comp.codigo)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Razón Social</div>
        <div class="field-value">${escapeHtmlHelper(comp.razon)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">R.I.F.</div>
        <div class="field-value" style="font-family: monospace;">${escapeHtmlHelper(comp.rif)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Fecha Apertura</div>
        <div class="field-value" style="font-family: monospace;">${formatFecha(comp.fecha_apertura)}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Código Maestro</div>
        <div class="field-value">${comp.codigo_maestro ? escapeHtmlHelper(comp.codigo_maestro) : '-'}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Estatus del Libro</div>
        <div class="field-value">${comp.estatus_libro ? escapeHtmlHelper(comp.estatus_libro) : '-'}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Capital Suscrito</div>
        <div class="field-value">${comp.capital_suscrito ? escapeHtmlHelper(comp.capital_suscrito) : '-'}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Registro Mercantil</div>
        <div class="field-value">${comp.registro_merc ? escapeHtmlHelper(comp.registro_merc) : '-'}</div>
      </div>
      <div class="field-card col-span-2">
        <div class="field-label">Dirección Fiscal</div>
        <div class="field-value" style="font-weight: 550; font-size: 12px;">${comp.direccion_fiscal ? escapeHtmlHelper(comp.direccion_fiscal) : '-'}</div>
      </div>
      <div class="field-card col-span-2">
        <div class="field-label">Objeto Social</div>
        <div class="field-value" style="font-weight: 550; font-size: 12px; text-align: justify; line-height: 1.45;">${comp.objeto ? escapeHtmlHelper(comp.objeto) : '-'}</div>
      </div>
      <div class="field-card col-span-2">
        <div class="field-label">Observaciones Generales</div>
        <div class="field-value" style="font-weight: 550; font-size: 12px; color: #475569;">${comp.observacion ? escapeHtmlHelper(comp.observacion) : '-'}</div>
      </div>
    </div>

    <div class="section-title">Detalles Adicionales de la Empresa</div>

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
    console.error("Print report error:", err);
    showToast(err.message || "Error al generar la ficha.", false);
  }
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

    const canWrite = window.hasPermission('view-companies', 'escribir');
    const saveBtn = document.getElementById('btn-save-company-modal');
    if (saveBtn) {
      saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    }
    if (companyForm) {
      const inputs = companyForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !canWrite;
      });
    }
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
    const canWrite = window.hasPermission('view-companies', 'escribir');
    btnAddCompany.style.display = canWrite ? 'inline-flex' : 'none';
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
      document.getElementById('company-form-capital').value = '';
      document.getElementById('company-form-registro').value = '';
      document.getElementById('company-form-direccion').value = '';
      document.getElementById('company-form-objeto').value = '';
      document.getElementById('company-form-observacion').value = '';
      document.getElementById('company-form-activo').checked = true;

      const detailsBtn = document.getElementById('btn-manage-company-details');
      if (detailsBtn) detailsBtn.classList.add('hidden');

      await loadRegionsForSelect();
      await loadUsersForSelect();

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

  window.printCompanyReport = printCompanyReport;

  const btnPrintCompaniesList = document.getElementById('btn-print-companies-report');
  if (btnPrintCompaniesList) {
    btnPrintCompaniesList.addEventListener('click', () => {
      printCompaniesListReport();
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
    document.getElementById('company-form-capital').value = comp.capital_suscrito || '';
    document.getElementById('company-form-registro').value = comp.registro_merc || '';
    document.getElementById('company-form-direccion').value = comp.direccion_fiscal || '';
    document.getElementById('company-form-objeto').value = comp.objeto || '';
    document.getElementById('company-form-observacion').value = comp.observacion || '';
    document.getElementById('company-form-activo').checked = comp.activo === true;

    const detailsBtn = document.getElementById('btn-manage-company-details');
    if (detailsBtn) detailsBtn.classList.remove('hidden');

    await loadRegionsForSelect(comp.region_id);
    await loadUsersForSelect(comp.usuario_id);

    const canWrite = window.hasPermission('view-companies', 'escribir');
    document.getElementById('company-modal-title').textContent = canWrite ? 'Editar Empresa' : 'Detalles de la Empresa';
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
      const capital_suscrito = document.getElementById('company-form-capital').value;
      const registro_merc = document.getElementById('company-form-registro').value;
      const direccion_fiscal = document.getElementById('company-form-direccion').value;
      const objeto = document.getElementById('company-form-objeto').value;
      const regionVal = document.getElementById('company-form-region').value;
      const region_id = regionVal ? parseInt(regionVal, 10) : null;
      const usuarioVal = document.getElementById('company-form-usuario').value;
      const usuario_id = usuarioVal ? parseInt(usuarioVal, 10) : null;
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
          estatus_libro, sistema, participacion, capital_suscrito, registro_merc,
          direccion_fiscal, objeto, region_id, usuario_id, observacion, activo
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
export const printCompaniesListReport = async () => {
  showToast("Generando Reporte de Listado...", true);

  try {
    if (!supabaseUrl || !supabaseKey) {
      await loadEnv();
    }

    let queryUrl = `${supabaseUrl}empresa?select=*,usuario:usuario_id(nombre),region:region_id(nombre)`;
    if (!window.isAdmin) {
      queryUrl += `&usuario_id=eq.${window.userId}`;
    }
    if (companiesSearchQuery) {
      const encSearch = encodeURIComponent(companiesSearchQuery);
      queryUrl += `&or=(razon.ilike.*${encSearch}*,rif.ilike.*${encSearch}*,codigo.ilike.*${encSearch}*)&order=id.asc`;
    } else {
      queryUrl += `&order=id.asc`;
    }

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error("No se pudieron obtener las empresas para el reporte.");
    const companies = await res.json();

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
    if (companies.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="16" style="padding: 12px; text-align: center; color: #64748b; font-style: italic; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            No hay empresas registradas.
          </td>
        </tr>
      `;
    } else {
      companies.forEach(comp => {
        const estadoText = comp.activo ? 'Activa' : 'Inactiva';
        const estadoStyle = comp.activo ? 'color: #15803d; font-weight: 600;' : 'color: #64748b;';
        const userText = comp.usuario ? escapeHtmlHelper(comp.usuario.nombre) : '-';
        const regionText = comp.region ? escapeHtmlHelper(comp.region.nombre) : '-';
        const participacionText = comp.participacion !== null && comp.participacion !== undefined ? comp.participacion + '%' : '-';
        
        let fechaAperturaText = '-';
        if (comp.fecha_apertura) {
          const parts = comp.fecha_apertura.split('-');
          if (parts.length === 3) {
            fechaAperturaText = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            fechaAperturaText = comp.fecha_apertura;
          }
        }

        rowsHtml += `
          <tr style="page-break-inside: avoid;">
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; font-size: 9px; color: #0f172a; white-space: nowrap;">${escapeHtmlHelper(comp.codigo)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 9px; color: #0f172a;">${escapeHtmlHelper(comp.razon)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9px; color: #334155; white-space: nowrap;">${escapeHtmlHelper(comp.rif)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9px; color: #334155; white-space: nowrap;">${fechaAperturaText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9px; color: #334155; white-space: nowrap;">${escapeHtmlHelper(comp.codigo_maestro || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #334155; text-transform: capitalize;">${escapeHtmlHelper(comp.estatus_libro || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #334155; white-space: nowrap;">${escapeHtmlHelper(comp.sistema || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9px; color: #334155; white-space: nowrap;">${participacionText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #334155;">${escapeHtmlHelper(comp.capital_suscrito || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #334155;">${escapeHtmlHelper(comp.registro_merc || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8px; color: #475569; max-width: 120px; word-break: break-word;">${escapeHtmlHelper(comp.direccion_fiscal || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8px; color: #475569; max-width: 120px; word-break: break-word;">${escapeHtmlHelper(comp.objeto || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #334155;">${regionText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #334155;">${userText}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8px; color: #475569; max-width: 120px; word-break: break-word;">${escapeHtmlHelper(comp.observacion || '-')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; ${estadoStyle}">${estadoText}</td>
          </tr>
        `;
      });
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Listado de Empresas</title>
  <style>
    @page {
      size: landscape;
      margin: 0.8cm;
    }
    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
        margin: 0;
        padding: 0;
        font-size: 9px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none; }
      .container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
      th, td { padding: 5px 6px !important; font-size: 8px !important; }
      .header-title-container { margin-bottom: 12px !important; padding-bottom: 6px !important; }
      .header-title { font-size: 18px !important; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    .header-title-container {
      border-bottom: 3px solid #1e3a8a;
      padding-bottom: 8px;
      width: 100%;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-info {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
    }
    .print-btn-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }
    .print-btn {
      background-color: #1e3a8a;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 6px -1px rgb(30 58 138 / 0.2);
    }
    .print-btn:hover {
      background-color: #172554;
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
        Imprimir Reporte
      </button>
    </div>

    <div class="header-title-container">
      <h1 class="header-title">Listado de Empresas</h1>
      <span class="meta-info">Total: ${companies.length} empresas</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Razón Social</th>
          <th>RIF</th>
          <th>Fecha Const.</th>
          <th>Código SAP</th>
          <th>Est. Libro</th>
          <th>Sistema</th>
          <th>Part. (%)</th>
          <th>Capital Susc.</th>
          <th>Reg. Mercantil</th>
          <th>Dirección Fiscal</th>
          <th>Objeto Social</th>
          <th>Región</th>
          <th>Usuario</th>
          <th>Observación</th>
          <th>Estatus</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
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
    console.error("Print companies list report error:", err);
    showToast(err.message || "Error al generar el listado de empresas.", false);
  }
};

window.printCompaniesListReport = printCompaniesListReport;

export { companiesPage, companiesPageSize, companiesSearchQuery, companiesTotalCount, companiesList };
