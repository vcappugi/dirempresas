import { supabaseUrl, supabaseKey, loadEnv, getHeaders, showToast, escapeHtml, openDeleteModal } from './utils.js';

let productsPage = 1;
const productsPageSize = 5;
let productsSearchQuery = "";
let productsTotalCount = 0;
let productsList = [];

export const loadProducts = async () => {
  const loadingEl = document.getElementById('products-loading');
  const tableBody = document.getElementById('products-table-body');
  const emptyEl = document.getElementById('products-empty');

  if (!tableBody) return;

  loadingEl?.classList.remove('hidden');
  tableBody.innerHTML = '';
  emptyEl?.classList.add('hidden');

  if (!supabaseUrl || !supabaseKey) {
    await loadEnv();
  }

  const start = (productsPage - 1) * productsPageSize;
  const end = start + productsPageSize - 1;

  try {
    let queryUrl = `${supabaseUrl}producto`;

    if (productsSearchQuery) {
      const encSearch = encodeURIComponent(productsSearchQuery);
      queryUrl += `?or=(nombre.ilike.*${encSearch}*,descripcion.ilike.*${encSearch}*)&order=id.asc`;
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
    
    productsList = await res.json();

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length > 1) {
        productsTotalCount = parseInt(parts[1], 10);
      }
    } else {
      productsTotalCount = productsList.length;
    }

    if (productsList.length === 0) {
      emptyEl?.classList.remove('hidden');
      updateProductsPaginationUI(0, 0);
    } else {
      productsList.forEach(prod => {
        let dateStr = '-';
        if (prod.created_at) {
          try {
            dateStr = new Date(prod.created_at).toLocaleDateString();
          } catch(e) {}
        }

        const canWrite = window.hasPermission('view-products', 'escribir');

        const btnEditar = `
          <button onclick="editProduct(${prod.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Editar Producto/Servicio">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
        `;

        const btnVer = `
          <button onclick="editProduct(${prod.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-brand bg-brand/10 hover:bg-brand/20 dark:text-brand-light dark:bg-brand/15 dark:hover:bg-brand/25 transition-all duration-200 shadow-sm border border-brand/20 dark:border-brand/30" title="Ver Detalles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
        `;

        const btnEliminar = `
          <button onclick="deleteProduct(${prod.id})" class="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/20 dark:hover:bg-red-950/40 transition-all duration-200 shadow-sm border border-red-200/40 dark:border-red-800/40" title="Eliminar Producto/Servicio">
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
          <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white font-mono">${prod.id}</td>
          <td class="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">${escapeHtml(prod.nombre || '')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">${escapeHtml(prod.descripcion || '-')}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">${dateStr}</td>
        `;
        tableBody.appendChild(row);
      });
      updateProductsPaginationUI(start + 1, start + productsList.length);
    }
  } catch (err) {
    console.error("Error loading products:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-10 text-center text-red-500 font-semibold">
          ${err.message || 'Error cargando productos/servicios.'}
        </td>
      </tr>
    `;
    updateProductsPaginationUI(0, 0);
  } finally {
    loadingEl?.classList.add('hidden');
  }
};

const updateProductsPaginationUI = (startRange, endRange) => {
  const rangeStartEl = document.getElementById('products-range-start');
  const rangeEndEl = document.getElementById('products-range-end');
  const totalCountEl = document.getElementById('products-total-count');
  const currentPageEl = document.getElementById('products-current-page');
  const totalPagesEl = document.getElementById('products-total-pages');
  const btnPrev = document.getElementById('products-btn-prev');
  const btnNext = document.getElementById('products-btn-next');

  const totalPages = Math.ceil(productsTotalCount / productsPageSize) || 1;

  if (rangeStartEl) rangeStartEl.textContent = startRange;
  if (rangeEndEl) rangeEndEl.textContent = endRange;
  if (totalCountEl) totalCountEl.textContent = productsTotalCount;
  if (currentPageEl) currentPageEl.textContent = productsPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;

  if (btnPrev) btnPrev.disabled = productsPage <= 1;
  if (btnNext) btnNext.disabled = productsPage >= totalPages;
};

export const initProductsModule = () => {
  const productModalOverlay = document.getElementById('product-modal-overlay');
  const productModalCard = document.getElementById('product-modal-card');
  const btnCloseProductModal = document.getElementById('btn-close-product-modal');
  const btnCancelProductModal = document.getElementById('btn-cancel-product-modal');
  const btnAddProduct = document.getElementById('btn-add-product');
  const productForm = document.getElementById('product-form');

  const openProductModal = () => {
    if (!productModalOverlay || !productModalCard) return;
    productModalOverlay.classList.remove('hidden');
    productModalOverlay.offsetHeight;
    productModalOverlay.classList.remove('opacity-0');
    productModalOverlay.classList.add('opacity-100');
    productModalCard.classList.remove('scale-95', 'opacity-0');
    productModalCard.classList.add('scale-100', 'opacity-100');

    const canWrite = window.hasPermission('view-products', 'escribir');
    const saveBtn = document.getElementById('btn-save-product-modal');
    if (saveBtn) {
      saveBtn.style.display = canWrite ? 'inline-block' : 'none';
    }
    if (productForm) {
      const inputs = productForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = !canWrite;
      });
    }
  };

  const closeProductModal = () => {
    if (!productModalOverlay || !productModalCard) return;
    productModalOverlay.classList.remove('opacity-100');
    productModalOverlay.classList.add('opacity-0');
    productModalCard.classList.remove('scale-100', 'opacity-100');
    productModalCard.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      productModalOverlay.classList.add('hidden');
    }, 300);
  };

  if (btnAddProduct) {
    const canWrite = window.hasPermission('view-products', 'escribir');
    btnAddProduct.style.display = canWrite ? 'inline-flex' : 'none';
    btnAddProduct.addEventListener('click', () => {
      document.getElementById('product-form-id').value = '';
      document.getElementById('product-form-nombre').value = '';
      document.getElementById('product-form-descripcion').value = '';

      document.getElementById('product-modal-title').textContent = 'Crear Producto/Servicio';
      openProductModal();
    });
  }

  if (btnCloseProductModal) btnCloseProductModal.addEventListener('click', closeProductModal);
  if (btnCancelProductModal) btnCancelProductModal.addEventListener('click', closeProductModal);

  window.editProduct = (id) => {
    const prod = productsList.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('product-form-id').value = prod.id;
    document.getElementById('product-form-nombre').value = prod.nombre || '';
    document.getElementById('product-form-descripcion').value = prod.descripcion || '';

    const canWrite = window.hasPermission('view-products', 'escribir');
    document.getElementById('product-modal-title').textContent = canWrite ? 'Editar Producto/Servicio' : 'Detalles del Producto/Servicio';
    openProductModal();
  };

  window.deleteProduct = (id) => {
    openDeleteModal(id, 'product');
  };

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('product-form-id').value;
      const nombre = document.getElementById('product-form-nombre').value;
      const descripcion = document.getElementById('product-form-descripcion').value;

      const saveBtn = document.getElementById('btn-save-product-modal');
      const originalBtnText = saveBtn.innerHTML;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Guardando...
      `;

      try {
        const productData = { nombre, descripcion };

        let url = `${supabaseUrl}producto`;
        let method = 'POST';

        if (id) {
          url = `${supabaseUrl}producto?id=eq.${id}`;
          method = 'PATCH';
        }

        const res = await fetch(url, {
          method: method,
          headers: getHeaders(),
          body: JSON.stringify(productData)
        });

        if (!res.ok) throw new Error("Fallo al guardar datos del producto/servicio en Supabase.");

        showToast(id ? 'Producto/Servicio actualizado con éxito.' : 'Producto/Servicio creado con éxito.', true);
        closeProductModal();
        loadProducts();
      } catch (err) {
        console.error("Save product error:", err);
        showToast(err.message || 'Error al guardar los datos del producto/servicio.', false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Products Controls
  const productsSearchInput = document.getElementById('products-search');
  if (productsSearchInput) {
    let debounceTimer;
    productsSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        productsSearchQuery = e.target.value.trim();
        productsPage = 1;
        loadProducts();
      }, 300);
    });
  }

  const productsBtnPrev = document.getElementById('products-btn-prev');
  const productsBtnNext = document.getElementById('products-btn-next');
  if (productsBtnPrev) {
    productsBtnPrev.addEventListener('click', () => {
      if (productsPage > 1) {
        productsPage--;
        loadProducts();
      }
    });
  }
  if (productsBtnNext) {
    productsBtnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(productsTotalCount / productsPageSize);
      if (productsPage < totalPages) {
        productsPage++;
        loadProducts();
      }
    });
  }
};

export { productsTotalCount, productsPage, productsPageSize, productsSearchQuery };
