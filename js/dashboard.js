import { 
  supabaseUrl, 
  supabaseKey, 
  loadEnv, 
  getHeaders, 
  showToast, 
  openDeleteModal, 
  closeDeleteModal, 
  itemToDeleteId, 
  itemToDeleteType 
} from './modules/utils.js';

import { initUsersModule, loadUsers } from './modules/users.js';
import { initRolesModule, loadRoles } from './modules/roles.js';
import { initRegionsModule, loadRegions } from './modules/regions.js';
import { initCompaniesModule, loadCompanies } from './modules/companies.js';
import { initDetailsModule, loadDetails, currentCompanyIdForDetails } from './modules/details.js';

document.addEventListener('DOMContentLoaded', async () => {
  // --- Session & Profile Validation ---
  const session = JSON.parse(localStorage.getItem('sb-session'));
  const profile = JSON.parse(localStorage.getItem('sb-profile'));

  if (!session || !profile) {
    window.location.href = 'login.html';
    return;
  }

  // Bind dynamic user profile info
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayEmail = document.getElementById('user-display-email');
  const userAvatar = document.getElementById('user-avatar');
  const companyDisplayName = document.getElementById('company-display-name');

  if (userDisplayName) userDisplayName.textContent = profile.nombre;
  if (userDisplayEmail) userDisplayEmail.textContent = profile.mail;
  if (userAvatar) {
    userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.nombre)}&background=355a31&color=fff`;
  }
  if (companyDisplayName && profile.empresa) {
    companyDisplayName.textContent = profile.empresa.razon;
  }

  // --- Role-Based View Access Control ---
  if (profile.rol && profile.rol.nombre === 'DEALER_MANAGER') {
    const parentSettings = document.getElementById('btn-toggle-settings-submenu');
    if (parentSettings) parentSettings.style.display = 'none';
    const btnCompanies = document.querySelector('[data-view="view-companies"]');
    if (btnCompanies) btnCompanies.style.display = 'none';
  }

  // --- Logout Event Listener ---
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const { logout } = await import('./supabase-service.js');
      await logout();
    });
  }

  // --- Configuración Sub-menu Handlers ---
  const btnToggleSubmenu = document.getElementById('btn-toggle-settings-submenu');
  const submenuContainer = document.getElementById('settings-submenu');
  const arrowSubmenu = document.getElementById('arrow-settings-submenu');

  if (btnToggleSubmenu && submenuContainer && arrowSubmenu) {
    btnToggleSubmenu.addEventListener('click', () => {
      const isHidden = submenuContainer.classList.contains('hidden');
      if (isHidden) {
        submenuContainer.classList.remove('hidden');
        arrowSubmenu.classList.add('rotate-180');
      } else {
        submenuContainer.classList.add('hidden');
        arrowSubmenu.classList.remove('rotate-180');
      }
    });
  }

  // Auto-expand settings submenu if a child item is active on load
  const activeItemOnLoad = document.querySelector('.sidebar-item.active-item');
  if (activeItemOnLoad && activeItemOnLoad.closest('#settings-submenu')) {
    submenuContainer?.classList.remove('hidden');
    arrowSubmenu?.classList.add('rotate-180');
  }

  // --- Accent Themes Definitions ---
  const accentThemes = {
    green: {
      primary: '#355a31',
      light: '#528a4c',
      dark: '#223a20',
      rgb: '53, 90, 49'
    },
    blue: {
      primary: '#1e3a8a',
      light: '#3b82f6',
      dark: '#172554',
      rgb: '30, 58, 138'
    },
    emerald: {
      primary: '#065f46',
      light: '#10b981',
      dark: '#064e3b',
      rgb: '6, 95, 70'
    },
    indigo: {
      primary: '#3730a3',
      light: '#6366f1',
      dark: '#312e81',
      rgb: '55, 48, 163'
    }
  };

  // Function to apply accent color theme dynamically
  const applyAccentTheme = (themeName) => {
    const theme = accentThemes[themeName] || accentThemes.green;
    const root = document.documentElement;
    
    root.style.setProperty('--color-brand', theme.primary);
    root.style.setProperty('--color-brand-light', theme.light);
    root.style.setProperty('--color-brand-dark', theme.dark);
    root.style.setProperty('--color-brand-rgb', theme.rgb);
    
    localStorage.setItem('dashboard-accent-theme', themeName);

    document.querySelectorAll('.theme-selector-btn').forEach((btn) => {
      if (btn.getAttribute('data-theme') === themeName) {
        btn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-400', 'dark:ring-offset-slate-900');
      } else {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400', 'dark:ring-offset-slate-900');
      }
    });
  };

  const savedAccent = localStorage.getItem('dashboard-accent-theme') || 'green';
  applyAccentTheme(savedAccent);

  document.querySelectorAll('.theme-selector-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeName = btn.getAttribute('data-theme');
      if (themeName) {
        applyAccentTheme(themeName);
      }
    });
  });

  // --- Dark Mode Handlers ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
  const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

  const updateDarkModeUI = (isDark) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      themeToggleLightIcon?.classList.remove('hidden');
      themeToggleDarkIcon?.classList.add('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      themeToggleLightIcon?.classList.add('hidden');
      themeToggleDarkIcon?.classList.remove('hidden');
    }
  };

  const isDarkInitial = localStorage.getItem('color-theme') === 'dark' || 
    (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  updateDarkModeUI(isDarkInitial);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const nextDark = !isDark;
      localStorage.setItem('color-theme', nextDark ? 'dark' : 'light');
      updateDarkModeUI(nextDark);
    });
  }

  // --- Sidebar Collapse/Expand Handling (Desktop and Mobile) ---
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const mobileToggleSidebarBtn = document.getElementById('mobile-toggle-sidebar-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  const toggleSidebarDesktop = () => {
    if (!sidebar || !mainContent) return;
    
    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
    
    if (isCollapsed) {
      sidebar.classList.remove('sidebar-collapsed');
      sidebar.classList.remove('w-20');
      sidebar.classList.add('w-64');
      mainContent.classList.remove('md:ml-20');
      mainContent.classList.add('md:ml-64');
      
      const collapseIcon = document.getElementById('collapse-icon');
      if (collapseIcon) collapseIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />';
    } else {
      sidebar.classList.add('sidebar-collapsed');
      sidebar.classList.remove('w-64');
      sidebar.classList.add('w-20');
      mainContent.classList.remove('md:ml-64');
      mainContent.classList.add('md:ml-20');
      
      const collapseIcon = document.getElementById('collapse-icon');
      if (collapseIcon) collapseIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />';
    }
  };

  const toggleSidebarMobile = () => {
    if (!sidebar || !sidebarBackdrop) return;
    
    const isHidden = sidebar.classList.contains('-translate-x-full');
    
    if (isHidden) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      sidebarBackdrop.classList.remove('hidden');
      sidebarBackdrop.classList.add('block');
    } else {
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
      sidebarBackdrop.classList.remove('block');
      sidebarBackdrop.classList.add('hidden');
    }
  };

  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', toggleSidebarDesktop);
  }
  if (mobileToggleSidebarBtn) {
    mobileToggleSidebarBtn.addEventListener('click', toggleSidebarMobile);
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', toggleSidebarMobile);
  }

  // --- Profile and Notifications Dropdown Handlers ---
  const userMenuBtn = document.getElementById('user-menu-button');
  const userDropdown = document.getElementById('user-dropdown');
  const notifyBtn = document.getElementById('notification-button');
  const notifyDropdown = document.getElementById('notification-dropdown');

  const setupDropdown = (trigger, dropdown) => {
    if (!trigger || !dropdown) return;
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      if (dropdown === userDropdown) notifyDropdown?.classList.add('hidden');
      if (dropdown === notifyDropdown) userDropdown?.classList.add('hidden');
    });
  };

  setupDropdown(userMenuBtn, userDropdown);
  setupDropdown(notifyBtn, notifyDropdown);

  document.addEventListener('click', () => {
    userDropdown?.classList.add('hidden');
    notifyDropdown?.classList.add('hidden');
  });

  // --- Initialize Supabase Environment ---
  await loadEnv();

  // --- Initialize Modular Sub-modules ---
  initUsersModule();
  initRolesModule();
  initRegionsModule();
  initCompaniesModule();
  initDetailsModule();

  // --- Tab Navigation System (Simulate Views) ---
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const views = document.querySelectorAll('.dashboard-view');

  sidebarItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      const targetViewId = item.getAttribute('data-view');
      if (!targetViewId) return;

      sidebarItems.forEach((el) => {
        el.classList.remove('bg-brand/10', 'text-brand', 'border-l-4', 'border-brand', 'dark:text-white', 'active-item');
        el.classList.add('text-slate-600', 'dark:text-slate-400');
      });

      item.classList.add('bg-brand/10', 'text-brand', 'border-l-4', 'border-brand', 'dark:text-white', 'active-item');
      item.classList.remove('text-slate-600', 'dark:text-slate-400');

      views.forEach((view) => {
        if (view.id === targetViewId) {
          view.classList.remove('hidden');
          const reveals = view.querySelectorAll('.reveal');
          reveals.forEach(r => r.classList.add('active'));

          if (targetViewId === 'view-users') loadUsers();
          if (targetViewId === 'view-roles') loadRoles();
          if (targetViewId === 'view-regions') loadRegions();
          if (targetViewId === 'view-companies') loadCompanies();
        } else {
          view.classList.add('hidden');
        }
      });

      if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
        toggleSidebarMobile();
      }
    });
  });

  // --- Global Delete Confirmation Routing & Fetch ---
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');

  if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', closeDeleteModal);
  }

  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (!itemToDeleteId || !itemToDeleteType) return;
      
      const id = itemToDeleteId;
      const type = itemToDeleteType;
      closeDeleteModal();

      if (type === 'role') {
        const loadingEl = document.getElementById('roles-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}roles?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el rol.");
          showToast('Rol eliminado con éxito.', true);
          loadRoles();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el rol.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'region') {
        const loadingEl = document.getElementById('regions-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}region?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar la región.");
          showToast('Región eliminada con éxito.', true);
          loadRegions();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar la región.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'company') {
        const loadingEl = document.getElementById('companies-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}empresa?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar la empresa.");
          showToast('Empresa eliminada con éxito.', true);
          loadCompanies();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar la empresa.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'detail') {
        const loadingEl = document.getElementById('details-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}detalle_empresa?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el detalle.");
          showToast('Detalle de empresa eliminado con éxito.', true);
          loadDetails(currentCompanyIdForDetails);
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el detalle.', false);
          loadingEl?.classList.add('hidden');
        }
      } else {
        // User delete
        const loadingEl = document.getElementById('users-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}usuario?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el usuario.");
          showToast('Usuario eliminado con éxito.', true);
          loadUsers();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar the usuario.', false);
          loadingEl?.classList.add('hidden');
        }
      }
    });
  }
});
