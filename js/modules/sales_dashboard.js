import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml } from './utils.js';

let allSales = [];
let allModelos = [];
let allPeriodos = [];
let allProductos = [];
let allLineas = [];
let allFamilias = [];
let currentFilteredSales = [];

let chartPeriodosInstance = null;
let chartProductosInstance = null;
let chartModelosInstance = null;
let selectedModelSegment = 'all';

// Product Colors Palette
const productColors = [
  { bg: 'rgba(59, 130, 246, 0.85)', border: '#3b82f6', hex: '#3b82f6', lightBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  { bg: 'rgba(16, 185, 129, 0.85)', border: '#10b981', hex: '#10b981', lightBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  { bg: 'rgba(139, 92, 246, 0.85)', border: '#8b5cf6', hex: '#8b5cf6', lightBg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' },
  { bg: 'rgba(245, 158, 11, 0.85)', border: '#f59e0b', hex: '#f59e0b', lightBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  { bg: 'rgba(236, 72, 153, 0.85)', border: '#ec4899', hex: '#ec4899', lightBg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300' },
  { bg: 'rgba(6, 182, 212, 0.85)', border: '#06b6d4', hex: '#06b6d4', lightBg: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' },
  { bg: 'rgba(100, 116, 139, 0.85)', border: '#64748b', hex: '#64748b', lightBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
];

const getProductColorConfig = (productId) => {
  if (productId === 'unassigned' || !productId) return productColors[productColors.length - 1];
  const idx = typeof productId === 'number' ? Math.abs(productId) % (productColors.length - 1) : 0;
  return productColors[idx];
};

const formatMoney = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const formatInt = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-US').format(val);
};

// Main Entry: Load Dashboard Data
export const loadSalesDashboard = async () => {
  const loadingEl = document.getElementById('sd-loading');
  const contentEl = document.getElementById('sd-content');

  loadingEl?.classList.remove('hidden');
  contentEl?.classList.add('opacity-50');

  try {
    if (!supabaseUrl || !supabaseKey) await loadEnv();
    const h = getHeaders();

    const [salesRes, modRes, perRes, prodRes, linRes, famRes] = await Promise.all([
      fetch(`${supabaseUrl}ventas?order=fecha.desc&limit=5000`, { headers: h }),
      fetch(`${supabaseUrl}modelos?order=modelo.asc&limit=1000`, { headers: h }),
      fetch(`${supabaseUrl}periodos?order=fechadesde.asc,id.desc&limit=200`, { headers: h }),
      fetch(`${supabaseUrl}producto?order=nombre.asc&limit=200`, { headers: h }),
      fetch(`${supabaseUrl}lineas?order=nombre.asc&limit=200`, { headers: h }),
      fetch(`${supabaseUrl}familia?order=nombre.asc&limit=200`, { headers: h })
    ]);

    allSales = salesRes.ok ? await salesRes.json() : [];
    allModelos = modRes.ok ? await modRes.json() : [];
    allPeriodos = perRes.ok ? await perRes.json() : [];
    allProductos = prodRes.ok ? await prodRes.json() : [];
    allLineas = linRes.ok ? await linRes.json() : [];
    allFamilias = famRes.ok ? await famRes.json() : [];

    populateFilterDropdowns();
    applyDashboardFilters();
  } catch (err) {
    console.error("Error al cargar datos del dashboard de volumetría:", err);
    showToast("Error al cargar métricas de volumetría y ventas.", false);
  } finally {
    loadingEl?.classList.add('hidden');
    contentEl?.classList.remove('opacity-50');
  }
};

// Populate Filter Controls
const populateFilterDropdowns = () => {
  const filterPeriodo = document.getElementById('sd-filter-periodo');
  const filterProducto = document.getElementById('sd-filter-producto');
  const filterModelo = document.getElementById('sd-filter-modelo');
  const filterVendedor = document.getElementById('sd-filter-vendedor');

  if (filterPeriodo) {
    const curVal = filterPeriodo.value;
    filterPeriodo.innerHTML = '<option value="">Todos los Períodos</option>';
    allPeriodos.forEach(p => {
      filterPeriodo.innerHTML += `<option value="${p.id}" ${curVal == p.id ? 'selected' : ''}>${escapeHtml(p.periodo || 'P#' + p.id)}</option>`;
    });
  }

  if (filterProducto) {
    const curVal = filterProducto.value;
    filterProducto.innerHTML = '<option value="">Todos los Productos</option>';
    allProductos.forEach(pr => {
      filterProducto.innerHTML += `<option value="${pr.id}" ${curVal == pr.id ? 'selected' : ''}>${escapeHtml(pr.nombre || 'Prod#' + pr.id)}</option>`;
    });
  }

  if (filterModelo) {
    const curVal = filterModelo.value;
    filterModelo.innerHTML = '<option value="">Todos los Modelos</option>';
    allModelos.forEach(m => {
      filterModelo.innerHTML += `<option value="${m.id}" ${curVal == m.id ? 'selected' : ''}>${escapeHtml(m.modelo || 'Mod#' + m.id)}</option>`;
    });
  }

  if (filterVendedor) {
    const curVal = filterVendedor.value;
    const vendedoresSet = new Set();
    allSales.forEach(s => {
      if (s.vendedor && s.vendedor.trim()) vendedoresSet.add(s.vendedor.trim());
    });
    filterVendedor.innerHTML = '<option value="">Todos los Vendedores</option>';
    Array.from(vendedoresSet).sort().forEach(v => {
      filterVendedor.innerHTML += `<option value="${escapeHtml(v)}" ${curVal === v ? 'selected' : ''}>${escapeHtml(v)}</option>`;
    });
  }
};

// Apply Current Filters & Re-render Visuals
export const applyDashboardFilters = () => {
  const fPeriodo = document.getElementById('sd-filter-periodo')?.value || '';
  const fProducto = document.getElementById('sd-filter-producto')?.value || '';
  const fModelo = document.getElementById('sd-filter-modelo')?.value || '';
  const fVendedor = document.getElementById('sd-filter-vendedor')?.value || '';
  const fDesde = document.getElementById('sd-filter-desde')?.value || '';
  const fHasta = document.getElementById('sd-filter-hasta')?.value || '';

  currentFilteredSales = allSales.filter(s => {
    if (fPeriodo && String(s.periodo_id) !== String(fPeriodo)) return false;

    if (fModelo && String(s.modelo_id) !== String(fModelo)) return false;

    if (fProducto) {
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      if (!mod || String(mod.producto_id) !== String(fProducto)) return false;
    }

    if (fVendedor && (s.vendedor || '').trim() !== fVendedor.trim()) return false;

    if (s.fecha) {
      const saleDate = s.fecha.split('T')[0];
      if (fDesde && saleDate < fDesde) return false;
      if (fHasta && saleDate > fHasta) return false;
    }

    return true;
  });

  calculateKpis(currentFilteredSales);
  renderCharts(currentFilteredSales);
  renderBreakdownTables(currentFilteredSales);
};

// Calculate and Display Global and Product-Segmented KPIs
const calculateKpis = (sales) => {
  let totalUnidades = 0;
  let totalMonto = 0;
  let totalComisiones = 0;

  // Product Segmentation Map for KPIs
  const productSegmentKpiMap = new Map();

  sales.forEach(s => {
    const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
    const prodId = mod?.producto_id || 'unassigned';
    const prodObj = allProductos.find(p => String(p.id) === String(prodId));
    const prodName = prodObj ? prodObj.nombre : (prodId === 'unassigned' ? 'Sin Producto Asignado' : `Producto #${prodId}`);
    
    const modId = s.modelo_id || 'unassigned';
    const modName = mod ? mod.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : 'Desconocido');

    const cant = parseInt(s.cantidad, 10) || 1;
    const precio = parseFloat(s.precio_venta) || 0;
    const total = cant * precio;
    const com = parseFloat(s.comision_vendedor) || 0;

    totalUnidades += cant;
    totalMonto += total;
    totalComisiones += com;

    if (!productSegmentKpiMap.has(prodId)) {
      productSegmentKpiMap.set(prodId, {
        id: prodId,
        nombre: prodName,
        unidades: 0,
        monto: 0,
        comisiones: 0,
        modelosMap: new Map()
      });
    }

    const prodKpi = productSegmentKpiMap.get(prodId);
    prodKpi.unidades += cant;
    prodKpi.monto += total;
    prodKpi.comisiones += com;

    if (!prodKpi.modelosMap.has(modId)) {
      prodKpi.modelosMap.set(modId, {
        id: modId,
        nombre: modName,
        linea: mod?.linea ? `Línea #${mod.linea}` : '-',
        unidades: 0,
        monto: 0
      });
    }

    const mObj = prodKpi.modelosMap.get(modId);
    mObj.unidades += cant;
    mObj.monto += total;
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

  // Render Product & Inner Model Segmented KPI Grid
  const productKpiGrid = document.getElementById('sd-product-kpi-grid');
  const productKpiCount = document.getElementById('sd-product-kpi-count');

  const productSegmentsList = Array.from(productSegmentKpiMap.values()).sort((a, b) => b.monto - a.monto);

  if (productKpiCount) {
    productKpiCount.textContent = `${productSegmentsList.length} Producto(s) Activo(s)`;
  }

  if (productKpiGrid) {
    productKpiGrid.innerHTML = '';

    if (productSegmentsList.length === 0) {
      productKpiGrid.innerHTML = `
        <div class="col-span-full py-6 text-center text-xs text-slate-400">
          No hay ventas registradas para el rango de filtros seleccionado.
        </div>
      `;
    } else {
      productSegmentsList.forEach(seg => {
        const colorCfg = getProductColorConfig(seg.id);
        const segPct = totalMonto > 0 ? ((seg.monto / totalMonto) * 100).toFixed(1) : '0.0';
        const segPromedio = seg.unidades > 0 ? (seg.monto / seg.unidades) : 0;

        const innerModels = Array.from(seg.modelosMap.values()).sort((a, b) => b.unidades - a.unidades);

        let modelsListHtml = '';
        innerModels.forEach((m, idx) => {
          const modPct = seg.unidades > 0 ? ((m.unidades / seg.unidades) * 100).toFixed(0) : 0;
          modelsListHtml += `
            <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100/60 dark:border-slate-800/60 last:border-0">
              <div class="flex items-center gap-1.5 truncate pr-2">
                <span class="text-[10px] font-bold text-slate-400">#${idx + 1}</span>
                <span class="font-semibold text-slate-800 dark:text-slate-200 truncate" title="${escapeHtml(m.nombre)}">
                  ${escapeHtml(m.nombre)}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="font-bold text-slate-700 dark:text-slate-300 font-mono text-[11px]">${formatInt(m.unidades)} un.</span>
                <span class="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">${formatMoney(m.monto)}</span>
                <span class="text-[10px] text-slate-400 w-8 text-right">(${modPct}%)</span>
              </div>
            </div>
          `;
        });

        productKpiGrid.innerHTML += `
          <div class="p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
            <div>
              <!-- Header -->
              <div class="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/70 pb-2.5 mb-2.5">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${colorCfg.hex};"></span>
                  <h4 class="font-display font-bold text-sm text-slate-900 dark:text-white truncate" title="${escapeHtml(seg.nombre)}">
                    ${escapeHtml(seg.nombre)}
                  </h4>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${colorCfg.lightBg}">
                  ${segPct}% del Total
                </span>
              </div>

              <!-- Main KPI Numbers -->
              <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div class="text-[10px] font-semibold text-slate-400 uppercase">Unidades</div>
                  <div class="text-base font-bold text-slate-900 dark:text-white font-mono">${formatInt(seg.unidades)}</div>
                </div>
                <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div class="text-[10px] font-semibold text-slate-400 uppercase">Facturación</div>
                  <div class="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(seg.monto)}</div>
                </div>
              </div>

              <div class="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                <span>Precio Prom: <strong class="text-slate-700 dark:text-slate-300">${formatMoney(segPromedio)}</strong></span>
                <span>Comisiones: <strong class="text-amber-600 dark:text-amber-400">${formatMoney(seg.comisiones)}</strong></span>
              </div>

              <!-- Inner Models Breakdown Container -->
              <div class="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Desglose de Modelos (${innerModels.length})</span>
                  <span>Unidades & Monto</span>
                </div>
                <div class="space-y-0.5 max-h-36 overflow-y-auto pr-1">
                  ${modelsListHtml}
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }
  }
};

// Render Visual Charts with Chart.js
const renderCharts = (sales) => {
  if (typeof Chart === 'undefined') return;

  const isDarkMode = document.documentElement.classList.contains('dark');
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';

  // --- 1. Evolution by Period (Stacked by Product + Total Line) ---
  const periodMap = new Map();
  allPeriodos.forEach(p => {
    periodMap.set(p.id, {
      id: p.id,
      name: p.periodo || `P#${p.id}`,
      totalMonto: 0,
      totalUnidades: 0,
      productUnits: new Map()
    });
  });

  sales.forEach(s => {
    if (s.periodo_id && periodMap.has(s.periodo_id)) {
      const pObj = periodMap.get(s.periodo_id);
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      const prodId = mod?.producto_id || 'unassigned';
      
      const cant = parseInt(s.cantidad, 10) || 1;
      const precio = parseFloat(s.precio_venta) || 0;
      const total = cant * precio;

      pObj.totalUnidades += cant;
      pObj.totalMonto += total;

      const currentPUnits = pObj.productUnits.get(prodId) || 0;
      pObj.productUnits.set(prodId, currentPUnits + cant);
    }
  });

  const activePeriods = Array.from(periodMap.values()).filter(p => p.totalUnidades > 0 || p.totalMonto > 0);
  const pLabels = activePeriods.map(p => p.name);
  const pTotalMontos = activePeriods.map(p => p.totalMonto);

  // Distinct products with sales
  const activeProductIds = new Set();
  activePeriods.forEach(p => {
    Array.from(p.productUnits.keys()).forEach(prId => activeProductIds.add(prId));
  });

  const stackedDatasets = Array.from(activeProductIds).map(prId => {
    const prodObj = allProductos.find(p => String(p.id) === String(prId));
    const prodName = prodObj ? prodObj.nombre : (prId === 'unassigned' ? 'Sin Producto' : `Producto #${prId}`);
    const colorCfg = getProductColorConfig(prId);

    const data = activePeriods.map(p => p.productUnits.get(prId) || 0);

    return {
      type: 'bar',
      label: `${prodName} (Unid.)`,
      data: data,
      backgroundColor: colorCfg.bg,
      borderColor: colorCfg.border,
      borderWidth: 1,
      borderRadius: 4,
      stack: 'products',
      yAxisID: 'y'
    };
  });

  // Add overall Monto total line
  stackedDatasets.push({
    type: 'line',
    label: 'Total Facturación ($ USD)',
    data: pTotalMontos.length > 0 ? pTotalMontos : [0],
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 2.5,
    fill: true,
    tension: 0.35,
    pointRadius: 4,
    pointBackgroundColor: '#10b981',
    yAxisID: 'y1'
  });

  const ctxPeriodos = document.getElementById('sd-chart-periodos')?.getContext('2d');
  if (ctxPeriodos) {
    if (chartPeriodosInstance) chartPeriodosInstance.destroy();

    chartPeriodosInstance = new Chart(ctxPeriodos, {
      type: 'bar',
      data: {
        labels: pLabels.length > 0 ? pLabels : ['Sin datos'],
        datasets: stackedDatasets.length > 0 ? stackedDatasets : [{
          label: 'Sin ventas',
          data: [0],
          backgroundColor: '#cbd5e1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Inter', size: 10 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                if (context.dataset.yAxisID === 'y1') {
                  return `${label}: ${formatMoney(val)}`;
                }
                return `${label}: ${formatInt(val)} un.`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
          y: {
            stacked: true,
            type: 'linear',
            display: true,
            position: 'left',
            ticks: { color: textColor, stepSize: 1 },
            grid: { color: gridColor },
            title: { display: true, text: 'Unidades por Producto', color: textColor, font: { size: 10 } }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#10b981', callback: (val) => `$${val}` },
            title: { display: true, text: 'Monto Total ($)', color: '#10b981', font: { size: 10 } }
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
      prodMap.set(prodName, { id: prodId, unidades: 0, monto: 0 });
    }
    const current = prodMap.get(prodName);
    current.unidades += cant;
    current.monto += total;
  });

  const prLabels = Array.from(prodMap.keys());
  const prMontos = Array.from(prodMap.values()).map(v => v.monto);
  const prColors = Array.from(prodMap.values()).map(v => getProductColorConfig(v.id).hex);

  const ctxProductos = document.getElementById('sd-chart-productos')?.getContext('2d');
  if (ctxProductos) {
    if (chartProductosInstance) chartProductosInstance.destroy();

    chartProductosInstance = new Chart(ctxProductos, {
      type: 'doughnut',
      data: {
        labels: prLabels.length > 0 ? prLabels : ['Sin datos'],
        datasets: [{
          data: prMontos.length > 0 ? prMontos : [1],
          backgroundColor: prColors.length > 0 ? prColors : ['#cbd5e1'],
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

  // --- 3. Top Modelos Segmentados por Producto (Horizontal Bar + Segment Cards) ---
  renderProductSegmentedModels(sales, isDarkMode, textColor, gridColor);
};

// Render Product-Segmented Models (Chart + Segment Cards + Filter Pills)
const renderProductSegmentedModels = (sales, isDarkMode, textColor, gridColor) => {
  const segmentButtonsContainer = document.getElementById('sd-model-segment-buttons');
  const segmentCardsContainer = document.getElementById('sd-model-segments-container');
  const chartTitleEl = document.getElementById('sd-models-chart-title');

  // 1. Group sales by Product and then by Model
  const productSegmentMap = new Map();

  sales.forEach(s => {
    const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
    const prodId = mod?.producto_id || 'unassigned';
    const prodObj = allProductos.find(p => String(p.id) === String(prodId));
    const prodName = prodObj ? prodObj.nombre : (prodId === 'unassigned' ? 'Sin Producto' : `Producto #${prodId}`);
    
    const modId = s.modelo_id || 'unassigned';
    const modName = mod ? mod.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : 'Desconocido');
    
    const cant = parseInt(s.cantidad, 10) || 1;
    const precio = parseFloat(s.precio_venta) || 0;
    const total = cant * precio;

    if (!productSegmentMap.has(prodId)) {
      productSegmentMap.set(prodId, {
        id: prodId,
        nombre: prodName,
        totalUnidades: 0,
        totalMonto: 0,
        modelosMap: new Map()
      });
    }

    const prodSegment = productSegmentMap.get(prodId);
    prodSegment.totalUnidades += cant;
    prodSegment.totalMonto += total;

    if (!prodSegment.modelosMap.has(modId)) {
      prodSegment.modelosMap.set(modId, {
        id: modId,
        nombre: modName,
        linea: mod?.linea ? `Línea #${mod.linea}` : '-',
        familia: mod?.familia ? `Familia #${mod.familia}` : '-',
        unidades: 0,
        monto: 0
      });
    }

    const modObj = prodSegment.modelosMap.get(modId);
    modObj.unidades += cant;
    modObj.monto += total;
  });

  const segmentsList = Array.from(productSegmentMap.values()).map(seg => ({
    ...seg,
    modelos: Array.from(seg.modelosMap.values()).sort((a, b) => b.unidades - a.unidades)
  })).sort((a, b) => b.totalMonto - a.totalMonto);

  // 2. Render Filter Pills (Segment Buttons)
  if (segmentButtonsContainer) {
    segmentButtonsContainer.innerHTML = `
      <button onclick="window.setSalesDashboardModelSegment('all')" class="sd-model-seg-btn px-3 py-1 rounded-xl text-xs font-semibold transition-all ${selectedModelSegment === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}">
        Todos (${segmentsList.length})
      </button>
    `;

    segmentsList.forEach(seg => {
      const isSel = String(selectedModelSegment) === String(seg.id);
      segmentButtonsContainer.innerHTML += `
        <button onclick="window.setSalesDashboardModelSegment('${seg.id}')" class="sd-model-seg-btn px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${isSel ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}">
          ${escapeHtml(seg.nombre)} (${seg.totalUnidades})
        </button>
      `;
    });
  }

  // 3. Render Segmented Summary Cards
  if (segmentCardsContainer) {
    segmentCardsContainer.innerHTML = '';
    
    const displaySegments = selectedModelSegment === 'all' 
      ? segmentsList 
      : segmentsList.filter(s => String(s.id) === String(selectedModelSegment));

    if (displaySegments.length === 0) {
      segmentCardsContainer.innerHTML = `
        <div class="col-span-full py-6 text-center text-xs text-slate-400">
          No hay modelos con ventas registradas para este segmento de producto.
        </div>
      `;
    } else {
      displaySegments.forEach(seg => {
        const colorCfg = getProductColorConfig(seg.id);
        const topModels = seg.modelos.slice(0, 4);

        let modelsListHtml = '';
        topModels.forEach((m, idx) => {
          const pctOfSegment = seg.totalUnidades > 0 ? ((m.unidades / seg.totalUnidades) * 100).toFixed(0) : 0;
          modelsListHtml += `
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2" title="${escapeHtml(m.nombre)}">
                  ${idx + 1}. ${escapeHtml(m.nombre)}
                </span>
                <span class="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">${formatInt(m.unidades)} un. (${formatMoney(m.monto)})</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div class="h-1.5 rounded-full transition-all duration-500" style="width: ${pctOfSegment}%; background-color: ${colorCfg.hex};"></div>
              </div>
            </div>
          `;
        });

        if (seg.modelos.length > 4) {
          modelsListHtml += `
            <div class="text-[11px] text-slate-400 pt-1 text-right">
              +${seg.modelos.length - 4} modelos adicionales
            </div>
          `;
        }

        segmentCardsContainer.innerHTML += `
          <div class="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 hover:shadow-md transition-all space-y-3">
            <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${colorCfg.hex};"></span>
                <h4 class="font-display font-bold text-sm text-slate-900 dark:text-white truncate" title="${escapeHtml(seg.nombre)}">
                  ${escapeHtml(seg.nombre)}
                </h4>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${colorCfg.lightBg}">
                ${formatInt(seg.totalUnidades)} un.
              </span>
            </div>

            <div class="text-xs text-slate-500 flex items-center justify-between">
              <span>Facturación Segmento:</span>
              <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(seg.totalMonto)}</span>
            </div>

            <!-- Top Models Progress List -->
            <div class="space-y-2.5 pt-1">
              ${modelsListHtml}
            </div>
          </div>
        `;
      });
    }
  }

  // 4. Render Segmented Chart (Chart.js)
  const ctxModelos = document.getElementById('sd-chart-modelos')?.getContext('2d');
  if (ctxModelos) {
    if (chartModelosInstance) chartModelosInstance.destroy();

    let chartLabels = [];
    let chartUnidades = [];
    let chartColors = [];
    let chartMontos = [];
    let chartSubtitles = [];

    if (selectedModelSegment === 'all') {
      if (chartTitleEl) chartTitleEl.textContent = 'Comparativa General de Modelos por Producto';
      
      const flattened = [];
      segmentsList.forEach(seg => {
        const colorCfg = getProductColorConfig(seg.id);
        seg.modelos.forEach(m => {
          flattened.push({
            label: `[${seg.nombre}] ${m.nombre}`,
            unidades: m.unidades,
            monto: m.monto,
            color: colorCfg.bg,
            border: colorCfg.border,
            prodName: seg.nombre
          });
        });
      });

      const topFlat = flattened.sort((a, b) => b.unidades - a.unidades).slice(0, 10);
      chartLabels = topFlat.map(f => f.label);
      chartUnidades = topFlat.map(f => f.unidades);
      chartColors = topFlat.map(f => f.color);
      chartMontos = topFlat.map(f => f.monto);
      chartSubtitles = topFlat.map(f => f.prodName);
    } else {
      const activeSeg = segmentsList.find(s => String(s.id) === String(selectedModelSegment));
      if (chartTitleEl) chartTitleEl.textContent = `Modelos del Producto: ${activeSeg?.nombre || 'Seleccionado'}`;
      
      if (activeSeg) {
        const colorCfg = getProductColorConfig(activeSeg.id);
        const topSegModels = activeSeg.modelos.slice(0, 10);
        chartLabels = topSegModels.map(m => m.nombre);
        chartUnidades = topSegModels.map(m => m.unidades);
        chartColors = topSegModels.map(() => colorCfg.bg);
        chartMontos = topSegModels.map(m => m.monto);
        chartSubtitles = topSegModels.map(() => activeSeg.nombre);
      }
    }

    chartModelosInstance = new Chart(ctxModelos, {
      type: 'bar',
      data: {
        labels: chartLabels.length > 0 ? chartLabels : ['Sin datos'],
        datasets: [{
          label: 'Unidades Vendidas',
          data: chartUnidades.length > 0 ? chartUnidades : [0],
          backgroundColor: chartColors.length > 0 ? chartColors : ['rgba(59, 130, 246, 0.8)'],
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
              label: (context) => {
                const idx = context.dataIndex;
                const un = chartUnidades[idx] || 0;
                const mo = chartMontos[idx] || 0;
                const pr = chartSubtitles[idx] || '';
                return [`Producto: ${pr}`, `Unidades: ${formatInt(un)}`, `Monto Total: ${formatMoney(mo)}`];
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
          y: { 
            ticks: { 
              color: textColor, 
              font: { size: 10 },
              callback: function(val, index) {
                const label = this.getLabelForValue(val);
                return label.length > 28 ? label.substring(0, 26) + '...' : label;
              }
            }, 
            grid: { display: false } 
          }
        }
      }
    });
  }
};

window.setSalesDashboardModelSegment = (segmentId) => {
  selectedModelSegment = segmentId;
  const isDarkMode = document.documentElement.classList.contains('dark');
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';
  renderProductSegmentedModels(currentFilteredSales, isDarkMode, textColor, gridColor);
};

// Render Breakdown Tables with Full Product -> Models Hierarchy
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

  // 1. Desglose por Período con Jerarquía: Período -> Producto -> Modelos
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
        comisiones: 0,
        productMap: new Map()
      });
    });

    sales.forEach(s => {
      if (s.periodo_id && periodMap.has(s.periodo_id)) {
        const pObj = periodMap.get(s.periodo_id);
        const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
        const prodId = mod?.producto_id || 'unassigned';
        const prodObj = allProductos.find(p => String(p.id) === String(prodId));
        const prodName = prodObj ? prodObj.nombre : (prodId === 'unassigned' ? 'Sin Producto' : `Producto #${prodId}`);
        const modName = mod ? mod.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : 'Desconocido');

        const cant = parseInt(s.cantidad, 10) || 1;
        const precio = parseFloat(s.precio_venta) || 0;
        const total = cant * precio;
        const com = parseFloat(s.comision_vendedor) || 0;

        pObj.unidades += cant;
        pObj.monto += total;
        pObj.comisiones += com;

        if (!pObj.productMap.has(prodId)) {
          pObj.productMap.set(prodId, {
            id: prodId,
            nombre: prodName,
            unidades: 0,
            monto: 0,
            modelosMap: new Map()
          });
        }

        const prSeg = pObj.productMap.get(prodId);
        prSeg.unidades += cant;
        prSeg.monto += total;

        const curMod = prSeg.modelosMap.get(modName) || { unidades: 0, monto: 0 };
        curMod.unidades += cant;
        curMod.monto += total;
        prSeg.modelosMap.set(modName, curMod);
      }
    });

    const activePeriods = Array.from(periodMap.values()).filter(p => p.unidades > 0 || p.monto > 0);

    if (activePeriods.length === 0) {
      tablePeriodosBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No hay ventas registradas en el rango seleccionado.</td></tr>`;
    } else {
      activePeriods.forEach(p => {
        const pct = totalGeneralMonto > 0 ? ((p.monto / totalGeneralMonto) * 100).toFixed(1) : '0.0';

        // Main Period Header Row
        tablePeriodosBody.innerHTML += `
          <tr class="bg-purple-50/60 dark:bg-purple-950/30 font-bold border-t border-purple-200/60 dark:border-purple-800/60">
            <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-300/50">
                📅 ${escapeHtml(p.nombre)}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(p.fechas)}</td>
            <td class="px-4 py-3 text-center font-bold text-slate-900 dark:text-white font-mono">${formatInt(p.unidades)}</td>
            <td class="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(p.monto)}</td>
            <td class="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400 font-mono">${formatMoney(p.comisiones)}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div class="bg-purple-600 h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 w-10 text-right">${pct}%</span>
              </div>
            </td>
          </tr>
        `;

        // Sub-rows by Product & Model inside this Period
        p.productMap.forEach((prSeg) => {
          const colorCfg = getProductColorConfig(prSeg.id);
          const modelsSummary = Array.from(prSeg.modelosMap.entries())
            .map(([mName, mData]) => `${mName} (${mData.unidades} un.)`)
            .join(' • ');

          tablePeriodosBody.innerHTML += `
            <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-xs">
              <td class="px-4 py-2 pl-8 text-slate-800 dark:text-slate-200 font-medium">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" style="background-color: ${colorCfg.hex};"></span>
                  <span class="font-semibold">${escapeHtml(prSeg.nombre)}</span>
                </div>
              </td>
              <td class="px-4 py-2 text-slate-400 text-[11px] truncate max-w-xs" title="${escapeHtml(modelsSummary)}">
                ${escapeHtml(modelsSummary)}
              </td>
              <td class="px-4 py-2 text-center text-slate-700 dark:text-slate-300 font-mono">${formatInt(prSeg.unidades)}</td>
              <td class="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(prSeg.monto)}</td>
              <td class="px-4 py-2 text-right text-slate-400">-</td>
              <td class="px-4 py-2 text-slate-400 text-[11px] italic">
                Subtotal Producto
              </td>
            </tr>
          `;
        });
      });
    }
  }

  // 2. Desglose por Modelo Segmentado por Producto
  if (tableModelosBody) {
    tableModelosBody.innerHTML = '';
    const productSegmentMap = new Map();

    sales.forEach(s => {
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      const prodId = mod?.producto_id || 'unassigned';
      const prodObj = allProductos.find(p => String(p.id) === String(prodId));
      const prodName = prodObj ? prodObj.nombre : (prodId === 'unassigned' ? 'Sin Producto Asignado' : `Producto #${prodId}`);
      
      const modId = s.modelo_id || 'unassigned';
      const modName = mod ? mod.modelo : (s.modelo_id ? `Modelo #${s.modelo_id}` : 'Desconocido');
      
      const cant = parseInt(s.cantidad, 10) || 1;
      const precio = parseFloat(s.precio_venta) || 0;
      const total = cant * precio;

      if (!productSegmentMap.has(prodId)) {
        productSegmentMap.set(prodId, {
          id: prodId,
          nombre: prodName,
          totalUnidades: 0,
          totalMonto: 0,
          modelosMap: new Map()
        });
      }

      const prodSeg = productSegmentMap.get(prodId);
      prodSeg.totalUnidades += cant;
      prodSeg.totalMonto += total;

      if (!prodSeg.modelosMap.has(modId)) {
        prodSeg.modelosMap.set(modId, {
          id: modId,
          nombre: modName,
          linea: mod?.linea ? `Línea #${mod.linea}` : '-',
          familia: mod?.familia ? `Familia #${mod.familia}` : '-',
          unidades: 0,
          monto: 0
        });
      }

      const mRow = prodSeg.modelosMap.get(modId);
      mRow.unidades += cant;
      mRow.monto += total;
    });

    const segments = Array.from(productSegmentMap.values()).sort((a, b) => b.totalMonto - a.totalMonto);

    if (segments.length === 0) {
      tableModelosBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">No hay ventas registradas por modelo.</td></tr>`;
    } else {
      segments.forEach(seg => {
        const segPct = totalGeneralMonto > 0 ? ((seg.totalMonto / totalGeneralMonto) * 100).toFixed(1) : '0.0';
        const colorCfg = getProductColorConfig(seg.id);

        tableModelosBody.innerHTML += `
          <tr class="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-200 dark:border-slate-700">
            <td colspan="3" class="px-4 py-2.5 text-xs text-slate-900 dark:text-white">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" style="background-color: ${colorCfg.hex};"></span>
                <span class="uppercase tracking-wider">📦 Segmento Producto: ${escapeHtml(seg.nombre)}</span>
                <span class="text-[11px] font-normal text-slate-500 dark:text-slate-400">(${seg.modelosMap.size} modelos con ventas)</span>
              </div>
            </td>
            <td class="px-4 py-2.5 text-center text-xs text-slate-900 dark:text-white font-mono">${formatInt(seg.totalUnidades)} un.</td>
            <td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-slate-400">Subtotal:</td>
            <td class="px-4 py-2.5 text-right text-xs text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(seg.totalMonto)}</td>
            <td class="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">${segPct}% del Total</td>
          </tr>
        `;

        const sortedSegModels = Array.from(seg.modelosMap.values()).sort((a, b) => b.unidades - a.unidades);
        sortedSegModels.forEach(m => {
          const modelPct = totalGeneralMonto > 0 ? ((m.monto / totalGeneralMonto) * 100).toFixed(1) : '0.0';
          const prom = m.unidades > 0 ? (m.monto / m.unidades) : 0;

          tableModelosBody.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td class="px-4 py-2.5 pl-8 font-bold text-slate-900 dark:text-white">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                  ${escapeHtml(m.nombre)}
                </span>
              </td>
              <td class="px-4 py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400">${escapeHtml(seg.nombre)}</td>
              <td class="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(m.linea)}</td>
              <td class="px-4 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200 font-mono">${formatInt(m.unidades)}</td>
              <td class="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${formatMoney(prom)}</td>
              <td class="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(m.monto)}</td>
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div class="h-1.5 rounded-full" style="width: ${modelPct}%; background-color: ${colorCfg.hex};"></div>
                  </div>
                  <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 w-10 text-right">${modelPct}%</span>
                </div>
              </td>
            </tr>
          `;
        });
      });
    }
  }

  // 3. Desglose por Producto con Modelos Anidados
  if (tableProductosBody) {
    tableProductosBody.innerHTML = '';
    const prodMap = new Map();

    allProductos.forEach(p => {
      const modelosCount = allModelos.filter(m => String(m.producto_id) === String(p.id)).length;
      prodMap.set(p.id, {
        id: p.id,
        nombre: p.nombre,
        modelosRegistrados: modelosCount,
        unidades: 0,
        monto: 0,
        modelosMap: new Map()
      });
    });

    sales.forEach(s => {
      const mod = allModelos.find(m => String(m.id) === String(s.modelo_id));
      const prodId = mod?.producto_id;
      const cant = parseInt(s.cantidad, 10) || 1;
      const precio = parseFloat(s.precio_venta) || 0;
      const total = cant * precio;

      if (prodId && prodMap.has(prodId)) {
        const pr = prodMap.get(prodId);
        pr.unidades += cant;
        pr.monto += total;

        const mName = mod.modelo || `Modelo #${mod.id}`;
        const curM = pr.modelosMap.get(mName) || { unidades: 0, monto: 0 };
        curM.unidades += cant;
        curM.monto += total;
        pr.modelosMap.set(mName, curM);
      }
    });

    const activeProducts = Array.from(prodMap.values()).filter(p => p.unidades > 0 || p.monto > 0).sort((a, b) => b.monto - a.monto);

    if (activeProducts.length === 0) {
      tableProductosBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No hay ventas registradas por producto.</td></tr>`;
    } else {
      activeProducts.forEach(p => {
        const pct = totalGeneralMonto > 0 ? ((p.monto / totalGeneralMonto) * 100).toFixed(1) : '0.0';
        const prom = p.unidades > 0 ? (p.monto / p.unidades) : 0;
        const colorCfg = getProductColorConfig(p.id);

        tableProductosBody.innerHTML += `
          <tr class="bg-blue-50/60 dark:bg-blue-950/30 font-bold border-t border-blue-200/60 dark:border-blue-800/60">
            <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" style="background-color: ${colorCfg.hex};"></span>
                <span>${escapeHtml(p.nombre)}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">${p.modelosRegistrados} modelos</td>
            <td class="px-4 py-3 text-center font-bold text-slate-900 dark:text-white font-mono">${formatInt(p.unidades)}</td>
            <td class="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(p.monto)}</td>
            <td class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${formatMoney(prom)}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div class="h-2 rounded-full" style="width: ${pct}%; background-color: ${colorCfg.hex};"></div>
                </div>
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 w-10 text-right">${pct}%</span>
              </div>
            </td>
          </tr>
        `;

        // Sub-rows for each Model within this Product
        const innerModels = Array.from(p.modelosMap.entries()).sort((a, b) => b[1].unidades - a[1].unidades);
        innerModels.forEach(([mName, mData]) => {
          const modPct = p.monto > 0 ? ((mData.monto / p.monto) * 100).toFixed(1) : '0.0';
          const modProm = mData.unidades > 0 ? (mData.monto / mData.unidades) : 0;

          tableProductosBody.innerHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs">
              <td class="px-4 py-2 pl-8 font-semibold text-slate-800 dark:text-slate-200">
                <span class="inline-flex items-center gap-1.5">
                  <span class="text-slate-400 font-normal">↳</span>
                  ${escapeHtml(mName)}
                </span>
              </td>
              <td class="px-4 py-2 text-center text-slate-400 text-[11px]">-</td>
              <td class="px-4 py-2 text-center text-slate-700 dark:text-slate-300 font-mono">${formatInt(mData.unidades)}</td>
              <td class="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 font-mono">${formatMoney(mData.monto)}</td>
              <td class="px-4 py-2 text-right text-slate-600 dark:text-slate-400 font-mono">${formatMoney(modProm)}</td>
              <td class="px-4 py-2 text-slate-400 text-[11px]">
                ${modPct}% del producto
              </td>
            </tr>
          `;
        });
      });
    }
  }
};

// Initialize Listeners and Tabs
export const initSalesDashboardModule = () => {
  const filterPeriodo = document.getElementById('sd-filter-periodo');
  const filterProducto = document.getElementById('sd-filter-producto');
  const filterModelo = document.getElementById('sd-filter-modelo');
  const filterVendedor = document.getElementById('sd-filter-vendedor');
  const filterDesde = document.getElementById('sd-filter-desde');
  const filterHasta = document.getElementById('sd-filter-hasta');
  const resetBtn = document.getElementById('sd-btn-reset-filters');

  [filterPeriodo, filterProducto, filterModelo, filterVendedor, filterDesde, filterHasta].forEach(el => {
    if (el) {
      el.addEventListener('change', applyDashboardFilters);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (filterPeriodo) filterPeriodo.value = '';
      if (filterProducto) filterProducto.value = '';
      if (filterModelo) filterModelo.value = '';
      if (filterVendedor) filterVendedor.value = '';
      if (filterDesde) filterDesde.value = '';
      if (filterHasta) filterHasta.value = '';
      selectedModelSegment = 'all';
      applyDashboardFilters();
      showToast("Filtros restablecidos.", true);
    });
  }

  // Tabs switching
  const tabBtnPeriodos = document.getElementById('sd-tab-btn-periodos');
  const tabBtnModelos = document.getElementById('sd-tab-btn-modelos');
  const tabBtnProductos = document.getElementById('sd-tab-btn-productos');

  const panelPeriodos = document.getElementById('sd-tab-panel-periodos');
  const panelModelos = document.getElementById('sd-tab-panel-modelos');
  const panelProductos = document.getElementById('sd-tab-panel-productos');

  const switchTab = (activeBtn, activePanel) => {
    [tabBtnPeriodos, tabBtnModelos, tabBtnProductos].forEach(btn => {
      btn?.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-sm');
      btn?.classList.add('text-slate-500', 'hover:text-slate-800', 'dark:text-slate-400', 'dark:hover:text-white');
    });

    activeBtn?.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-sm');
    activeBtn?.classList.remove('text-slate-500', 'hover:text-slate-800', 'dark:text-slate-400', 'dark:hover:text-white');

    [panelPeriodos, panelModelos, panelProductos].forEach(panel => {
      panel?.classList.add('hidden');
    });
    activePanel?.classList.remove('hidden');
  };

  if (tabBtnPeriodos && panelPeriodos) {
    tabBtnPeriodos.addEventListener('click', () => switchTab(tabBtnPeriodos, panelPeriodos));
  }
  if (tabBtnModelos && panelModelos) {
    tabBtnModelos.addEventListener('click', () => switchTab(tabBtnModelos, panelModelos));
  }
  if (tabBtnProductos && panelProductos) {
    tabBtnProductos.addEventListener('click', () => switchTab(tabBtnProductos, panelProductos));
  }
};
