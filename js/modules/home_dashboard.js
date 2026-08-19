import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml } from './utils.js';

let dashboardDataCache = null;

const fmtDate = (iso) => {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

const fmtNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('es-VE', { maximumFractionDigits: 2 });
};

export const loadHomeDashboard = async () => {
  const container = document.getElementById('view-dashboard');
  if (!container) return;

  const loadingEl = document.getElementById('home-dashboard-loading');
  loadingEl?.classList.remove('hidden');

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();
    const h = getHeaders();

    const isAdmin = window.isAdmin === true;
    const allowedCompanyIds = window.userAllowedCompanyIds || [];
    const allowedBranchIds = window.userAllowedBranchIds || [];

    // 1. Prepare queries with company & branch access filters
    let compUrl = `${supabaseUrl}empresa?select=id,codigo,razon,rif,activo,region_id,region:region_id(nombre)`;
    let branchUrl = `${supabaseUrl}sucursales?select=id,nombre,empresa_id,region_id,sistema,estatus_operativo,empresa:empresa_id(razon),region:region_id(nombre)`;
    let volUrl = `${supabaseUrl}volumne_periodo?select=id,periodo_id,sucursal_id,producto_id,cantidad,fecha_registro,descripcion,periodos:periodo_id(periodo),sucursales:sucursal_id(nombre),producto:producto_id(nombre)&order=fecha_registro.desc&limit=100`;
    let prodUrl = `${supabaseUrl}producto?select=id,nombre,descripcion,activo&order=nombre.asc`;
    let perUrl = `${supabaseUrl}periodos?select=id,periodo,fechadesde,fechahasta,activo&order=id.desc`;
    let revUrl = `${supabaseUrl}revision?select=id,empresa_id,compromiso,estatus,fechalimite&order=id.desc&limit=50`;

    if (!isAdmin) {
      if (allowedCompanyIds.length > 0) {
        compUrl += `&id=in.(${allowedCompanyIds.join(',')})`;
        revUrl += `&empresa_id=in.(${allowedCompanyIds.join(',')})`;
      } else {
        compUrl += `&id=eq.-1`;
        revUrl += `&id=eq.-1`;
      }

      if (allowedBranchIds.length > 0) {
        branchUrl += `&id=in.(${allowedBranchIds.join(',')})`;
        volUrl += `&sucursal_id=in.(${allowedBranchIds.join(',')})`;
      } else {
        branchUrl += `&id=eq.-1`;
        volUrl += `&sucursal_id=eq.-1`;
      }
    }

    const [compRes, branchRes, volRes, prodRes, perRes, revRes] = await Promise.all([
      fetch(compUrl, { headers: h }),
      fetch(branchUrl, { headers: h }),
      fetch(volUrl, { headers: h }),
      fetch(prodUrl, { headers: h }),
      fetch(perUrl, { headers: h }),
      fetch(revUrl, { headers: h })
    ]);

    const companies = compRes.ok ? await compRes.json() : [];
    const branches = branchRes.ok ? await branchRes.json() : [];
    const volumes = volRes.ok ? await volRes.json() : [];
    const products = prodRes.ok ? await prodRes.json() : [];
    const periods = perRes.ok ? await perRes.json() : [];
    const revisions = revRes.ok ? await revRes.json() : [];

    dashboardDataCache = { companies, branches, volumes, products, periods, revisions };

    renderDashboardContent(dashboardDataCache);
  } catch (err) {
    console.error("Error loading home dashboard:", err);
    container.innerHTML = `
      <div class="p-8 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-center space-y-3">
        <svg class="w-12 h-12 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="text-lg font-bold text-red-700 dark:text-red-400">Error al cargar datos del Dashboard</h3>
        <p class="text-sm text-red-600 dark:text-red-300">${err.message || 'No se pudo obtener la información de las tablas.'}</p>
        <button onclick="loadHomeDashboard()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-all">Reintentar</button>
      </div>
    `;
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const renderDashboardContent = (data) => {
  const container = document.getElementById('view-dashboard');
  if (!container) return;

  const { companies, branches, volumes, products, periods, revisions } = data;
  const isAdmin = window.isAdmin === true;

  // Compute KPIs
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => c.activo !== false).length;

  const totalBranches = branches.length;
  const activeBranches = branches.filter(b => (b.estatus_operativo || '').toLowerCase().includes('act') || b.estatus_operativo === null).length;

  const totalVolume = volumes.reduce((acc, v) => acc + (parseFloat(v.cantidad) || 0), 0);
  const totalVolumeRecords = volumes.length;

  const totalProducts = products.length;

  const activePeriod = periods.find(p => p.activo === true) || periods[0] || null;

  // Compute Volume by Product
  const volumeByProductMap = {};
  volumes.forEach(v => {
    const prodName = v.producto?.nombre || `Producto #${v.producto_id || 'N/A'}`;
    const qty = parseFloat(v.cantidad) || 0;
    volumeByProductMap[prodName] = (volumeByProductMap[prodName] || 0) + qty;
  });

  const sortedProductsByVol = Object.entries(volumeByProductMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Compute Branches by Region
  const branchesByRegionMap = {};
  branches.forEach(b => {
    const regName = b.region?.nombre || 'Sin Región';
    branchesByRegionMap[regName] = (branchesByRegionMap[regName] || 0) + 1;
  });

  // Recent Volumetry Rows (Last 6)
  const recentVolumes = volumes.slice(0, 6);
  const recentVolumesHtml = recentVolumes.length === 0
    ? `<tr><td colspan="5" class="py-8 text-center text-slate-400 italic text-xs">No hay registros de volumetría para las sucursales autorizadas.</td></tr>`
    : recentVolumes.map(v => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-xs">
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${escapeHtml(v.periodos?.periodo || `Período #${v.periodo_id}`)}</td>
          <td class="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">${escapeHtml(v.sucursales?.nombre || `Sucursal #${v.sucursal_id}`)}</td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light">
              ${escapeHtml(v.producto?.nombre || `Prod #${v.producto_id}`)}
            </span>
          </td>
          <td class="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono">${fmtNumber(v.cantidad)}</td>
          <td class="px-4 py-3 text-slate-400 font-mono text-[11px]">${fmtDate(v.fecha_registro)}</td>
        </tr>
      `).join('');

  // Companies List (Top 5)
  const topCompaniesHtml = companies.slice(0, 5).map(c => `
    <div class="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 hover:border-brand/30 transition-all">
      <div class="space-y-0.5">
        <h4 class="text-xs font-bold text-slate-800 dark:text-white">${escapeHtml(c.razon)}</h4>
        <div class="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>${escapeHtml(c.rif || 'Sin RIF')}</span>
          ${c.codigo ? `<span>• Cod: ${escapeHtml(c.codigo)}</span>` : ''}
        </div>
      </div>
      <span class="px-2.5 py-1 text-[10px] font-bold rounded-xl ${c.activo !== false ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-slate-100 text-slate-500'}">
        ${c.activo !== false ? 'Activa' : 'Inactiva'}
      </span>
    </div>
  `).join('');

  // Top Products Volume Progress Bars
  const topProductsHtml = sortedProductsByVol.length === 0
    ? `<p class="py-6 text-center text-slate-400 italic text-xs">Sin registros de volumen de productos.</p>`
    : sortedProductsByVol.map(([name, qty]) => {
        const percentage = totalVolume > 0 ? Math.min(100, Math.round((qty / totalVolume) * 100)) : 0;
        return `
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-slate-700 dark:text-slate-200">${escapeHtml(name)}</span>
              <span class="font-mono text-brand dark:text-brand-light">${fmtNumber(qty)} <span class="text-slate-400 font-normal text-[10px]">(${percentage}%)</span></span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full bg-brand rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');

  // Branches Region Badges
  const regionBadgesHtml = Object.entries(branchesByRegionMap).length === 0
    ? `<p class="py-4 text-center text-slate-400 italic text-xs">Sin sucursales asignadas.</p>`
    : Object.entries(branchesByRegionMap).map(([region, count]) => `
        <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 text-xs">
          <span class="font-medium text-slate-600 dark:text-slate-300">${escapeHtml(region)}</span>
          <span class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold font-mono text-[11px]">${count}</span>
        </div>
      `).join('');

  const accessNotice = isAdmin
    ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        Acceso Total (Administrador)
      </span>`
    : `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        Acceso Filtrado: ${totalCompanies} Empresas / ${totalBranches} Sucursales
      </span>`;

  container.innerHTML = `
    <!-- Hero Banner -->
    <div class="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-brand to-brand-dark text-white shadow-xl shadow-brand/10 space-y-4">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2.5">
            <h2 class="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">Panel de Control</h2>
            ${activePeriod ? `<span class="px-3 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-md">Período: ${escapeHtml(activePeriod.periodo)}</span>` : ''}
          </div>
          <p class="text-white/80 text-sm max-w-xl">
            Resumen consolidado de volumetría, concesionarios y estado operativo de tus empresas asignadas.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          ${accessNotice}
          <button onclick="loadHomeDashboard()" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all border border-white/20" title="Actualizar datos">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Actualizar
          </button>
        </div>
      </div>
    </div>

    <!-- 4 KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

      <!-- KPI 1: Empresas -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Empresas</span>
          <div class="p-2.5 rounded-2xl bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
          </div>
        </div>
        <div>
          <h3 class="text-3xl font-display font-extrabold text-slate-900 dark:text-white font-mono">${totalCompanies}</h3>
          <p class="text-xs text-slate-400 mt-1">${activeCompanies} activas autorizadas</p>
        </div>
      </div>

      <!-- KPI 2: Sucursales -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sucursales</span>
          <div class="p-2.5 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
          </div>
        </div>
        <div>
          <h3 class="text-3xl font-display font-extrabold text-slate-900 dark:text-white font-mono">${totalBranches}</h3>
          <p class="text-xs text-slate-400 mt-1">${activeBranches} operativas</p>
        </div>
      </div>

      <!-- KPI 3: Volumetría -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Volumen Registrado</span>
          <div class="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
        </div>
        <div>
          <h3 class="text-3xl font-display font-extrabold text-slate-900 dark:text-white font-mono">${fmtNumber(totalVolume)}</h3>
          <p class="text-xs text-slate-400 mt-1">${totalVolumeRecords} registros acumulados</p>
        </div>
      </div>

      <!-- KPI 4: Productos -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Productos / Servicios</span>
          <div class="p-2.5 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
        </div>
        <div>
          <h3 class="text-3xl font-display font-extrabold text-slate-900 dark:text-white font-mono">${totalProducts}</h3>
          <p class="text-xs text-slate-400 mt-1">Catálogo activo</p>
        </div>
      </div>

    </div>

    <!-- 2 Column Section: Volumetry Table + Product Breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Left 2 Cols: Recent Volumetry Table -->
      <div class="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 class="text-lg font-bold font-display text-slate-900 dark:text-white">Últimos Registros de Volumetría</h3>
            <p class="text-xs text-slate-400">Transacciones registradas por sucursal autorizada</p>
          </div>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
          <table class="w-full text-left">
            <thead class="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950">
              <tr>
                <th class="px-4 py-3">Período</th>
                <th class="px-4 py-3">Sucursal</th>
                <th class="px-4 py-3">Producto</th>
                <th class="px-4 py-3">Cantidad</th>
                <th class="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              ${recentVolumesHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right 1 Col: Top Products & Regions Distribution -->
      <div class="space-y-6">

        <!-- Top Products Volume -->
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 class="text-base font-bold font-display text-slate-900 dark:text-white">Volumen por Producto</h3>
            <p class="text-xs text-slate-400">Participación en volumen registrado</p>
          </div>
          <div class="space-y-4">
            ${topProductsHtml}
          </div>
        </div>

        <!-- Branches by Region -->
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 class="text-base font-bold font-display text-slate-900 dark:text-white">Sucursales por Región</h3>
            <p class="text-xs text-slate-400">Distribución territorial asignada</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${regionBadgesHtml}
          </div>
        </div>

      </div>

    </div>

    <!-- Bottom Section: Authorized Companies Cards -->
    <div class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 class="text-lg font-bold font-display text-slate-900 dark:text-white">Empresas Asociadas</h3>
          <p class="text-xs text-slate-400">Concesionarios y empresas con acceso autorizado</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${topCompaniesHtml || '<p class="text-xs text-slate-400 italic">No hay empresas asignadas.</p>'}
      </div>
    </div>
  `;
};
