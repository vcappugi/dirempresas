export let supabaseUrl = "";
export let supabaseKey = "";
export let itemToDeleteId = null;
export let itemToDeleteType = "";

export const loadEnv = async () => {
  try {
    const res = await fetch('.env');
    if (!res.ok) throw new Error("No se pudo obtener el archivo .env");
    const text = await res.text();
    const env = {};
    
    text.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let val = match[2] ? match[2].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[key] = val;
      }
    });
    
    supabaseUrl = env['DB_SUPABASE'] || "";
    supabaseKey = env['APKEY'] || "";
  } catch (e) {
    console.error("Error cargando variables de entorno desde .env:", e);
  }
};

export const getHeaders = () => {
  return {
    "Content-Type": "application/json",
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Prefer": "return=representation"
  };
};

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

export const showToast = (message, isSuccess = true) => {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  
  const indicator = toast.querySelector('.toast-indicator');
  if (indicator) {
    if (isSuccess) {
      indicator.className = 'toast-indicator inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-800 dark:text-green-200';
      indicator.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/></svg>';
    } else {
      indicator.className = 'toast-indicator inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-red-500 bg-red-100 rounded-lg dark:bg-red-800 dark:text-red-200';
      indicator.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm1.293 9.707a1 1 0 0 1-1.414 1.414L10 10.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L8.586 10 7.293 8.707a1 1 0 0 1 1.414-1.414L10 9.586l1.293-1.293a1 1 0 0 1 1.414 1.414L11.414 10l1.293 1.293Z"/></svg>';
    }
  }

  // Toggle slide animation
  toast.classList.remove('translate-y-24', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 4000);
};

export const escapeHtml = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const openDeleteModal = (id, type) => {
  itemToDeleteId = id;
  itemToDeleteType = type;
  
  const titleEl = document.getElementById('delete-confirm-title');
  const descEl = document.getElementById('delete-confirm-desc');
  
  if (type === 'role') {
    if (titleEl) titleEl.textContent = '¿Eliminar Rol?';
    if (descEl) descEl.textContent = 'Esta acción no se puede deshacer. El rol será eliminado permanentemente de la base de datos.';
  } else if (type === 'region') {
    if (titleEl) titleEl.textContent = '¿Eliminar Región?';
    if (descEl) descEl.textContent = 'Esta acción no se puede deshacer. La región será eliminada permanentemente de la base de datos.';
  } else if (type === 'company') {
    if (titleEl) titleEl.textContent = '¿Eliminar Empresa?';
    if (descEl) descEl.textContent = 'Esta acción no se puede deshacer. La empresa será eliminada permanentemente de la base de datos.';
  } else if (type === 'detail') {
    if (titleEl) titleEl.textContent = '¿Eliminar Detalle?';
    if (descEl) descEl.textContent = 'Esta acción no se puede deshacer. El detalle será eliminado permanentemente de la base de datos.';
  } else {
    if (titleEl) titleEl.textContent = '¿Eliminar Usuario?';
    if (descEl) descEl.textContent = 'Esta acción no se puede deshacer. El usuario será eliminado permanentemente de la base de datos.';
  }

  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const deleteConfirmCard = document.getElementById('delete-confirm-card');
  if (!deleteConfirmModal || !deleteConfirmCard) return;
  
  deleteConfirmModal.classList.remove('hidden');
  deleteConfirmModal.offsetHeight;
  deleteConfirmModal.classList.remove('opacity-0');
  deleteConfirmModal.classList.add('opacity-100');
  deleteConfirmCard.classList.remove('scale-95', 'opacity-0');
  deleteConfirmCard.classList.add('scale-100', 'opacity-100');
};

export const closeDeleteModal = () => {
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const deleteConfirmCard = document.getElementById('delete-confirm-card');
  if (!deleteConfirmModal || !deleteConfirmCard) return;
  
  deleteConfirmModal.classList.remove('opacity-100');
  deleteConfirmModal.classList.add('opacity-0');
  deleteConfirmCard.classList.remove('scale-100', 'opacity-100');
  deleteConfirmCard.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    deleteConfirmModal.classList.add('hidden');
    itemToDeleteId = null;
    itemToDeleteType = "";
  }, 300);
};
