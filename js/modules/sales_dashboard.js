import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml } from './utils.js';

let rawSales = [];
let allPeriodos = [];
let allModelos = [];
let allProductos = [];
let chartPeriodosInstance = null;
let chartProductosInstance = null;
let chartModelosInstance = null;

// Currency Formatter Helper
const formatMoney = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
};

// Integer Formatter Helper
const formatInt = (val) => {
  const num = parseInt(val, 10) || 0;
  return new Intl.NumberFormat('en-US').format(num);
};

// Pre-load supporting catalogs
const loadCatalogs = async () => {
  if (!supabaseUrl || !supabaseKey) await loadEnv();
  const headers = getHeaders();

  try {
    const [resP, resM, resPr] = await Promise.all([
      fetch(`${supabaseUrl}periodos?order=fechadesde.asc,id.desc`, { headers }),
      fetch(`${supabaseUrl}modelos?order=modelo.asc`, { headers }),
      fetch(`${supabaseUrl}producto?order=nombre.asc`, { headers })
    ]);

    if (resP.ok) allPeriodos = await resP.json();
    if (resM.ok) allModelos = await resM.json();
    if (resPr.ok) allProductos = await resPr.json();
  } catch (e) {
    console.warn("Error cargando catálogos para Dashboard:", e);
  }
};

// Populate filter dropdowns
const populateFilters = () => {
  const filterPeriodo = document.getElementById('sd-filter-periodo');
  const filterProducto = document.getElementById('sd-filter-producto');
  const filterModelo = document.getElementById('sd-filter-modelo');
  const filterVendedor = document.getElementById('sd-filter-vendedor');

  if (filterPeriodo) {
    const curVal = filterPeriodo.value;
    filterPeriodo.innerHTML = '<option value="">Todos los Períodos</option>';
    allPeriodos.forEach(p => {
      filterPeriodo.innerHTML += `<option value="${p.id}" ${curVal === String(p.id) ? 'selected' : ''}>${escapeHtml(p.periodo || 'Período #' + p.id)}</option>`;
    });
  }

  if (filterProducto) {
    const curVal = filterProducto.value;
    filterProducto.innerHTML = '<option value="">Todos los Productos</option>';
    allProductos.forEach(pr => {
      filterProducto.innerHTML += `<option value="${pr.id}" ${curVal === String(pr.id) ? 'selected' : ''}>${escapeHtml(pr.nombre || 'Producto #' + pr.id)}</option>`;
    });
  }

  if (filterModelo) {
    const curVal = filterModelo.value;
    filterModelo.innerHTML = '<option value="">Todos los Modelos</option>';
    allModelos.forEach(m => {
      filterModelo.innerHTML += `<option value="${m.id}" ${curVal === String(m.id) ? 'selected' : ''}>${escapeHtml(m.modelo || 'Modelo #' + m.id)}</option>`;
    });
  }

  if (filterVendedor) {
    const curVal = filterVendedor.value;
    const sellers = [...new Set(rawSales.map(s => (s.vendedor || '').trim()).filter(Boolean))].sort();
    filterVendedor.innerHTML = '<option value="">Todos los Vendedores</option>';
    sellers.forEach(v => {
      filterVendedor.innerHTML += `<option value="${escapeHtml(v)}" ${curVal === v ? 'selected' : ''}>${escapeHtml(v)}</option>`;
    });
  }
};

// Main Load Function
export const loadSalesDashboard = async () => {
  const loadingEl = document.getElementById('sd-loading');
  const contentEl = document.getElementById('sd-content');

  loadingEl?.classList.remove('hidden');
  contentEl?.classList.add('opacity-50', 'pointer-events-none');

  if (!supabaseUrl || !supabaseKey) await loadEnv();

  await loadCatalogs();

  try {
    const res = await fetch(`${supabaseUrl}ventas?order=fecha.desc,id.desc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ventas`);
    rawSales = await res.json();

    populateFilters();
    applyFiltersAndRender();
  } catch (err) {
    console.error("Error al cargar dashboard de ventas:", err);
    showToast("Error al cargar datos de volumetría y ventas", false);
  } finally {
    loadingEl?.classList.add('hidden');
    contentEl?.classList.remove('opacity-50', 'pointer-events-none');
  }
};

// Filter & Recalculate
const applyFiltersAndRender = () => {
  const selPeriodo = document.getElementById('sd-filter-periodo')?.value;
  const selProducto = document.getElementById('sd-filter-producto')?.value;
  const selModelo = document.getElementById('sd-filter-modelo')?.value;
  const selVendedor = document.getElementById('sd-filter-vendedor')?.value;
  const selDesde = document.getElementById('sd-filter-desde')?.value;
  const selHasta = document.getElementById('sd-filter-hasta')?.value;

  const filtered = rawSales.filter(s => {
    if (selPeriodo && String(s.periodo_id) !== String(selPeriodo)) return false;
    if (selModelo && String(s.modelo_id) !== String(selModelo)) return false;
    if (selVendedor && (s.vendedor || '').trim() !== selVendedor.trim()) return false;

    // Filter by Producto (via Modelo relationship)
    if (selProducto) {
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      if (!mod || String(mod.producto_id) !== String(selProducto)) return false;
    }

    // Filter by Date Range
    if (selDesde && s.fecha && s.fecha < selDesde) return false;
    if (selHasta && s.fecha && s.fecha > selHasta) return false;

    return true;
  });

  renderKPIs(filtered);
  renderCharts(filtered);
  renderBreakdownTables(filtered);
};

// Render KPI Cards
const renderKPIs = (sales) => {
  let totalUnidades = 0;
  let totalMonto = 0;
  let totalComisiones = 0;

  sales.forEach(s => {
    const cant = parseInt(s.cantidad, 10) || 1;
    totalUnidades += cant;
    const precio = parseFloat(s.precio_venta) || 0;
    totalMonto += (cant * precio);
    const com = parseFloat(s.comision_vendedor) || 0;
    totalComisiones += com;
  });

  const promedio = totalUnidades > 0 ? (totalMonto / totalUnidades) : 0;

  const kpiUnidades = document.getElementById('sd-kpi-unidades');
  const kpiMonto = document.getElementById('sd-kpi-monto');
  const kpiPromedio = document.getElementById('sd-kpi-promedio');
  const kpiComisiones = document.getElementById('sd-kpi-comisiones');

  if (kpiUnidades) kpiUnidades.textContent = formatInt(totalUnidades);
  if (kpiMonto) kpiMonto.textContent = formatMoney(totalMonto);
  if (kpiPromedio) kpiPromedio.textContent = formatMoney(promedio);
  if (kpiComisiones) kpiComisiones.textContent = formatMoney(totalComisiones);
};

// Render Visual Charts with Chart.js
const renderCharts = (sales) => {
  if (typeof Chart === 'undefined') return;

  const isDarkMode = document.documentElement.classList.contains('dark');
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';

  // --- 1. Evolution by Period (Unidades + Monto) ---
  const periodMap = new Map();
  allPeriodos.forEach(p => {
    periodMap.set(p.id, {
      name: p.periodo || `P#${p.id}`,
      unidades: 0,
      monto: 0
    });
  });

  sales.forEach(s => {
    if (s.periodo_id && periodMap.has(s.periodo_id)) {
      const obj = periodMap.get(s.periodo_id);
      const cant = parseInt(s.cantidad, 10) || 1;
      const precio = parseFloat(s.precio_venta) || 0;
      obj.unidades += cant;
      obj.monto += (cant * precio);
    }
  });

  // Filter out periods with 0 if user filtered, or sort by id
  const periodData = Array.from(periodMap.values()).filter(p => p.unidades > 0 || p.monto > 0);
  const pLabels = periodData.map(p => p.name);
  const pUnidades = periodData.map(p => p.unidades);
  const pMontos = periodData.map(p => p.monto);

  const ctxPeriodos = document.getElementById('sd-chart-periodos')?.getContext('2d');
  if (ctxPeriodos) {
    if (chartPeriodosInstance) chartPeriodosInstance.destroy();

    chartPeriodosInstance = new Chart(ctxPeriodos, {
      type: 'bar',
      data: {
        labels: pLabels.length > 0 ? pLabels : ['Sin datos'],
        datasets: [
          {
            type: 'bar',
            label: 'Unidades Vendidas',
            data: pUnidades.length > 0 ? pUnidades : [0],
            backgroundColor: 'rgba(53, 90, 49, 0.75)',
            borderColor: '#355a31',
            borderWidth: 1.5,
            borderRadius: 8,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Monto Total ($ USD)',
            data: pMontos.length > 0 ? pMontos : [0],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                if (context.dataset.yAxisID === 'y1') return `${label}: ${formatMoney(val)}`;
                return `${label}: ${formatInt(val)} und`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: {
            type: 'linear',
            position: 'left',
            ticks: { color: textColor, stepSize: 1 },
            grid: { color: gridColor },
            title: { display: true, text: 'Unidades', color: textColor, font: { size: 10 } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            ticks: {
              color: textColor,
              callback: (v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
            },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Monto ($ USD)', color: textColor, font: { size: 10 } }
          }
        }
      }
    });
  }

  // --- 2. Distribution by Product (Donut) ---
  const prodMap = new Map();
  sales.forEach(s => {
    const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
    const prodId = mod?.producto_id || 'unassigned';
    const prodObj = allProductos.find(p => String(p.id) === String(prodId));
    const prodName = prodObj ? prodObj.nombre : (prodId === 'unassigned' ? 'Sin Producto' : `Producto #${prodId}`);

    const cant = parseInt(s.cantidad, 10) || 1;
    const precio = parseFloat(s.precio_venta) || 0;
    const total = cant * precio;

    if (!prodMap.has(prodName)) {
      prodMap.set(prodName, { unidades: 0, monto: 0 });
    }
    const current = prodMap.get(prodName);
    current.unidades += cant;
    current.monto += total;
  });

  const prLabels = Array.from(prodMap.keys());
  const prMontos = Array.from(prodMap.values()).map(v => v.monto);
  const palette = ['#355a31', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

  const ctxProductos = document.getElementById('sd-chart-productos')?.getContext('2d');
  if (ctxProductos) {
    if (chartProductosInstance) chartProductosInstance.destroy();

    chartProductosInstance = new Chart(ctxProductos, {
      type: 'doughnut',
      data: {
        labels: prLabels.length > 0 ? prLabels : ['Sin datos'],
        datasets: [{
          data: prMontos.length > 0 ? prMontos : [1],
          backgroundColor: prLabels.length > 0 ? palette.slice(0, prLabels.length) : ['#cbd5e1'],
          borderWidth: 2,
          borderColor: isDarkMode ? '#0f172a' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 10 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const val = context.parsed;
                return `${label}: ${formatMoney(val)}`;
              }
            }
          }
        }
      }
    });
  }

  // --- 3. Top Modelos (Horizontal Bar) ---
  const modelMap = new Map();
  sales.forEach(s => {
    const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
    const modName = mod ? mod.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : 'Desconocido');
    const cant = parseInt(s.cantidad, 10) || 1;
    const precio = parseFloat(s.precio_venta) || 0;

    if (!modelMap.has(modName)) {
      modelMap.set(modName, { unidades: 0, monto: 0 });
    }
    const cur = modelMap.get(modName);
    cur.unidades += cant;
    cur.monto += (cant * precio);
  });

  const sortedModels = Array.from(modelMap.entries())
    .sort((a, b) => b[1].unidades - a[1].unidades)
    .slice(0, 8);

  const mLabels = sortedModels.map(m => m[0]);
  const mUnidades = sortedModels.map(m => m[1].unidades);

  const ctxModelos = document.getElementById('sd-chart-modelos')?.getContext('2d');
  if (ctxModelos) {
    if (chartModelosInstance) chartModelosInstance.destroy();

    chartModelosInstance = new Chart(ctxModelos, {
      type: 'bar',
      data: {
        labels: mLabels.length > 0 ? mLabels : ['Sin datos'],
        datasets: [{
          label: 'Unidades Vendidas',
          data: mUnidades.length > 0 ? mUnidades : [0],
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Unidades: ${formatInt(context.parsed.x)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { display: false } }
        }
      }
    });
  }
};

// Render Breakdown Tables
const renderBreakdownTables = (sales) => {
  const tablePeriodosBody = document.getElementById('sd-table-periodos-body');
  const tableModelosBody = document.getElementById('sd-table-modelos-body');
  const tableProductosBody = document.getElementById('sd-table-productos-body');

  let totalGeneralMonto = 0;
  let totalGeneralUnidades = 0;

  sales.forEach(s => {
    const cant = parseInt(s.cantidad, 10) || 1;
    const precio = parseFloat(s.precio_venta) || 0;
    totalGeneralUnidades += cant;
    totalGeneralMonto += (cant * precio);
  });

  // 1. Desglose por Período
  if (tablePeriodosBody) {
    tablePeriodosBody.innerHTML = '';
    const periodMap = new Map();

    allPeriodos.forEach(p => {
      periodMap.set(p.id, {
        id: p.id,
        nombre: p.periodo || `Período #${p.id}`,
        fechas: p.fechadesde && p.fechahasta ? `${p.fechadesde} al ${p.fechahasta}` : '-',
        unidades: 0,
        monto: 0,
        comisiones: 0
      });
    });

    sales.forEach(s => {
      if (s.periodo_id && periodMap.has(s.periodo_id)) {
        const row = periodMap.get(s.periodo_id);
        const cant = parseInt(s.cantidad, 10) || 1;
        const precio = parseFloat(s.precio_venta) || 0;
        row.unidades += cant;
        row.monto += (cant * precio);
        row.comisiones += (parseFloat(s.comision_vendedor) || 0);
      }
    });

    const activePeriods = Array.from(periodMap.values()).filter(p => p.unidades > 0 || p.monto > 0);

    if (activePeriods.length === 0) {
      tablePeriodosBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No hay ventas registradas para los filtros seleccionados.</td></tr>`;
    } else {
      activePeriods.forEach(p => {
        const pct = totalGeneralMonto > 0 ? ((p.monto / totalGeneralMonto) * 100).toFixed(1) : '0.0';
        tablePeriodosBody.innerHTML += `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                ${escapeHtml(p.nombre)}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(p.fechas)}</td>
            <td class="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">${formatInt(p.unidades)}</td>
            <td class="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(p.monto)}</td>
            <td class="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">${formatMoney(p.comisiones)}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div class="bg-brand h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
                <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 w-10 text-right">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      });
    }
  }

  // 2. Desglose por Modelo
  if (tableModelosBody) {
    tableModelosBody.innerHTML = '';
    const modelMap = new Map();

    sales.forEach(s => {
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      const modName = mod ? mod.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : 'Desconocido');
      
      const prod = mod?.producto_id ? allProductos.find(p => String(p.id) === String(mod.producto_id)) : null;
      const prodName = prod ? prod.nombre : '-';

      const cant = parseInt(s.cantidad, 10) || 1;
      const precio = parseFloat(s.precio_venta) || 0;

      if (!modelMap.has(modName)) {
        modelMap.set(modName, {
          nombre: modName,
          producto: prodName,
          linea: mod?.linea ? `Línea #${mod.linea}` : '-',
          unidades: 0,
          monto: 0
        });
      }

      const row = modelMap.get(modName);
      row.unidades += cant;
      row.monto += (cant * precio);
    });

    const activeModels = Array.from(modelMap.values()).sort((a, b) => b.monto - a.monto);

    if (activeModels.length === 0) {
      tableModelosBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">No hay ventas registradas por modelo.</td></tr>`;
    } else {
      activeModels.forEach(m => {
        const pct = totalGeneralMonto > 0 ? ((m.monto / totalGeneralMonto) * 100).toFixed(1) : '0.0';
        const prom = m.unidades > 0 ? (m.monto / m.unidades) : 0;
        tableModelosBody.innerHTML += `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                ${escapeHtml(m.nombre)}
              </span>
            </td>
            <td class="px-4 py-3 text-xs font-medium text-blue-600 dark:text-blue-400">${escapeHtml(m.producto)}</td>
            <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(m.linea)}</td>
            <td class="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">${formatInt(m.unidades)}</td>
            <td class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">${formatMoney(prom)}</td>
            <td class="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(m.monto)}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div class="bg-blue-600 h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
                <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 w-10 text-right">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      });
    }
  }

  // 3. Desglose por Producto
  if (tableProductosBody) {
    tableProductosBody.innerHTML = '';
    const prodMap = new Map();

    allProductos.forEach(p => {
      const modelosCount = allModelos.filter(m => String(m.producto_id) === String(p.id)).length;
      prodMap.set(p.id, {
        id: p.id,
        nombre: p.nombre || `Producto #${p.id}`,
        modelosCount,
        unidades: 0,
        monto: 0
      });
    });

    sales.forEach(s => {
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      const prodId = mod?.producto_id;
      if (prodId && prodMap.has(prodId)) {
        const row = prodMap.get(prodId);
        const cant = parseInt(s.cantidad, 10) || 1;
        const precio = parseFloat(s.precio_venta) || 0;
        row.unidades += cant;
        row.monto += (cant * precio);
      }
    });

    const activeProds = Array.from(prodMap.values()).sort((a, b) => b.monto - a.monto);

    if (activeProds.length === 0) {
      tableProductosBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No hay ventas registradas por producto.</td></tr>`;
    } else {
      activeProds.forEach(p => {
        const pct = totalGeneralMonto > 0 ? ((p.monto / totalGeneralMonto) * 100).toFixed(1) : '0.0';
        const prom = p.unidades > 0 ? (p.monto / p.unidades) : 0;
        tableProductosBody.innerHTML += `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                ${escapeHtml(p.nombre)}
              </span>
            </td>
            <td class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">${p.modelosCount}</td>
            <td class="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">${formatInt(p.unidades)}</td>
            <td class="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(p.monto)}</td>
            <td class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">${formatMoney(prom)}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div class="bg-emerald-600 h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
                <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 w-10 text-right">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      });
    }
  }
};

// Module Initialization
export const initSalesDashboardModule = () => {
  const refreshBtn = document.getElementById('sd-btn-refresh');
  const resetBtn = document.getElementById('sd-btn-reset-filters');
  const filterInputs = [
    'sd-filter-periodo',
    'sd-filter-producto',
    'sd-filter-modelo',
    'sd-filter-vendedor',
    'sd-filter-desde',
    'sd-filter-hasta'
  ];

  if (refreshBtn) refreshBtn.addEventListener('click', loadSalesDashboard);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      filterInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyFiltersAndRender();
    });
  }

  filterInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', applyFiltersAndRender);
      if (el.tagName === 'INPUT') el.addEventListener('input', applyFiltersAndRender);
    }
  });

  // Tabs switching
  const tabBtnPeriodos = document.getElementById('sd-tab-btn-periodos');
  const tabBtnModelos = document.getElementById('sd-tab-btn-modelos');
  const tabBtnProductos = document.getElementById('sd-tab-btn-productos');

  const panelPeriodos = document.getElementById('sd-tab-panel-periodos');
  const panelModelos = document.getElementById('sd-tab-panel-modelos');
  const panelProductos = document.getElementById('sd-tab-panel-productos');

  const activateTab = (activeBtn, activePanel) => {
    [tabBtnPeriodos, tabBtnModelos, tabBtnProductos].forEach(btn => {
      if (!btn) return;
      btn.classList.remove('active', 'text-slate-800', 'dark:text-white', 'bg-white', 'dark:bg-slate-700', 'shadow-sm');
      btn.classList.add('text-slate-500', 'dark:text-slate-400');
    });

    [panelPeriodos, panelModelos, panelProductos].forEach(p => p?.classList.add('hidden'));

    if (activeBtn) {
      activeBtn.classList.add('active', 'text-slate-800', 'dark:text-white', 'bg-white', 'dark:bg-slate-700', 'shadow-sm');
      activeBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
    }
    if (activePanel) activePanel.classList.remove('hidden');
  };

  if (tabBtnPeriodos) tabBtnPeriodos.addEventListener('click', () => activateTab(tabBtnPeriodos, panelPeriodos));
  if (tabBtnModelos) tabBtnModelos.addEventListener('click', () => activateTab(tabBtnModelos, panelModelos));
  if (tabBtnProductos) tabBtnProductos.addEventListener('click', () => activateTab(tabBtnProductos, panelProductos));
};
