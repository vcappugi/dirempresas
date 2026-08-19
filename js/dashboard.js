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
import { initRolePermissionsModule, loadRolePermissions } from './modules/role_permissions.js';
import { initRegionsModule, loadRegions } from './modules/regions.js';
import { initCompaniesModule, loadCompanies } from './modules/companies.js';
import { initDetailsModule, loadDetails, currentCompanyIdForDetails } from './modules/details.js';
import { initBranchDetailsModule, loadBranchDetails, currentBranchIdForDetails } from './modules/branch_details.js';
import { initDetailTypesModule, loadDetailTypes } from './modules/detail_types.js';
import { initRevisionsModule, loadRevisions } from './modules/revisions.js';
import { initBranchesModule, loadBranches } from './modules/branches.js';
import { initProductsModule, loadProducts } from './modules/products.js';
import { initPeriodsModule, loadPeriods } from './modules/periods.js';
import { initVolumePeriodModule, loadVolumePeriod } from './modules/volume_period.js';
import { initUserRolesModule, loadUserRoles, currentUserIdForRoles } from './modules/user_roles.js';
import { initUserCompaniesModule, loadUserCompanies, currentUserIdForCompanies } from './modules/user_companies.js';

const loadTemplates = async () => {
  const container = document.querySelector('main');
  const body = document.querySelector('body');
  
  const templates = [
    'templates/companies.html',
    'templates/branches.html',
    'templates/users.html',
    'templates/roles.html',
    'templates/regions.html',
    'templates/detail_types.html',
    'templates/revisions.html',
    'templates/products.html',
    'templates/periods.html',
    'templates/volume_period.html'
  ];

  for (const url of templates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Mover vistas al contenedor principal <main>
        const sections = temp.querySelectorAll('section');
        sections.forEach(sec => container.appendChild(sec));
        
        // Mover overlays y modales al body para posicionamiento fixed correcto
        const overlays = temp.querySelectorAll('[id$="-overlay"]');
        overlays.forEach(ov => body.appendChild(ov));
      } else {
        console.error(`Error al cargar la plantilla ${url}: estado ${res.status}`);
      }
    } catch (e) {
      console.error(`Excepción al cargar la plantilla ${url}:`, e);
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar las plantillas HTML dinámicamente
  await loadTemplates();

  // --- Session & Profile Validation ---
  const session = JSON.parse(localStorage.getItem('sb-session'));
  const profile = JSON.parse(localStorage.getItem('sb-profile'));

  if (!session || !profile) {
    window.location.href = 'login.html';
    return;
  }

  // --- Role-Based View Access Control ---
  const getRoleName = () => {
    if (!profile.rol) return '';
    if (typeof profile.rol === 'string') return profile.rol.toLowerCase();
    if (typeof profile.rol === 'object') {
      return (profile.rol.nombre || '').toLowerCase();
    }
    return '';
  };
  const hasAdminRole = Array.isArray(profile.roles) && profile.roles.some(r => ((r.nombre || '').toLowerCase() === 'admin' || r.id === 1));
  const isAdmin = getRoleName() === 'admin' || (profile.rol && profile.rol.id === 1) || hasAdminRole;
  
  window.isAdmin = isAdmin;
  window.userId = profile.id;
  window.userCompanyId = null;
  window.userCompanyName = null;

  window.hasPermission = (viewId, action = 'leer') => {
    if (!profile) return false;

    // Admins always have full access to every view
    if (isAdmin) return true;

    // Direct access if allowed via usuarios_empresas
    if (action === 'leer') {
      if (viewId === 'view-companies' && window.userAllowedCompanyIds?.length > 0) return true;
      if (viewId === 'view-branches' && window.userAllowedBranchIds?.length > 0) return true;
      if (viewId === 'view-volume-period' && window.userAllowedBranchIds?.length > 0) return true;
      if (viewId === 'view-dashboard') return true;
    }

    if (action === 'escribir') {
      if (viewId === 'view-companies' && window.userCompanyAssignments?.some(a => a.edicion === true)) return true;
      if (viewId === 'view-branches' && window.userCompanyAssignments?.some(a => a.edicion === true)) return true;
      if (viewId === 'view-volume-period' && window.userCompanyAssignments?.some(a => a.edicion === true)) return true;
    }
    
    // Fallback if no permissions are configured/loaded in the session
    if (!profile.permissions) {
      const allowedRead = ['view-dashboard', 'view-companies', 'view-branches', 'view-revisions', 'view-products', 'view-periods', 'view-volume-period'];
      if (action === 'leer') {
        return allowedRead.includes(viewId);
      }
      return false;
    }
    
    const viewPerm = profile.permissions[viewId];
    if (!viewPerm) return false;
    
    return !!viewPerm[action];
  };

  const applySidebarPermissions = () => {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    let visibleSettingsCount = 0;
    
    sidebarItems.forEach(item => {
      const viewId = item.getAttribute('data-view');
      if (viewId) {
        const hasRead = window.hasPermission(viewId, 'leer');
        if (!hasRead) {
          item.style.display = 'none';
        } else {
          item.style.display = 'flex';
          if (item.closest('#settings-submenu')) {
            visibleSettingsCount++;
          }
        }
      }
    });
    
    const parentSettings = document.getElementById('btn-toggle-settings-submenu');
    if (parentSettings) {
      if (visibleSettingsCount === 0) {
        parentSettings.style.display = 'none';
      } else {
        parentSettings.style.display = 'flex';
      }
    }
  };

  window.userCompanyAssignments = [];
  window.userAllowedCompanyIds = [];
  window.userFullAccessCompanyIds = [];
  window.userSpecificBranchIds = [];
  window.userAllowedBranchIds = [];

  window.isCompanyAllowed = () => true;
  window.isBranchAllowed = () => true;
  window.isVolumetryAllowed = () => true;
  window.canEditCompany = () => true;
  window.canEditBranch = () => true;

  const loadUserCompanyPermissions = async () => {
    if (isAdmin) {
      window.isCompanyAllowed = () => true;
      window.isBranchAllowed = () => true;
      window.isVolumetryAllowed = () => true;
      window.canEditCompany = () => true;
      window.canEditBranch = () => true;
      return;
    }

    try {
      if (!supabaseUrl || !supabaseKey) await loadEnv();
      const h = getHeaders();

      // 1. Query usuarios_empresas
      let ueRows = [];
      try {
        let res = await fetch(`${supabaseUrl}usuarios_empresas?select=*`, { headers: h });
        if (res.ok) {
          const allRows = await res.json();
          ueRows = allRows.filter(r => {
            const rowUser = r.usuario_id ?? r.user_id;
            return rowUser === profile.id || rowUser === undefined || rowUser === null;
          });
        }
      } catch (e) {
        console.warn("Could not query usuarios_empresas:", e);
      }

      const activeAssignments = ueRows.filter(r => r.lectura !== false);
      window.userCompanyAssignments = activeAssignments;

      // 2. Direct empresa assignment fallback (empresa.usuario_id)
      let directCompanies = [];
      try {
        const dRes = await fetch(`${supabaseUrl}empresa?usuario_id=eq.${profile.id}&select=id,razon`, { headers: h });
        if (dRes.ok) directCompanies = await dRes.json();
      } catch (e) {}

      if (directCompanies.length > 0) {
        window.userCompanyId = directCompanies[0].id;
        window.userCompanyName = directCompanies[0].razon;
      }

      const allowedCompanySet = new Set();
      const fullAccessCompanySet = new Set();
      const specificBranchSet = new Set();

      directCompanies.forEach(c => {
        allowedCompanySet.add(c.id);
        fullAccessCompanySet.add(c.id);
      });

      activeAssignments.forEach(a => {
        if (a.empresa_id) {
          allowedCompanySet.add(a.empresa_id);
          if (!a.sucursal_id) {
            fullAccessCompanySet.add(a.empresa_id);
          } else {
            specificBranchSet.add(a.sucursal_id);
          }
        }
      });

      window.userAllowedCompanyIds = Array.from(allowedCompanySet);
      window.userFullAccessCompanyIds = Array.from(fullAccessCompanySet);
      window.userSpecificBranchIds = Array.from(specificBranchSet);

      // 3. Fetch branches for fullAccessCompanyIds to populate all allowed branches
      const allowedBranchSet = new Set(specificBranchSet);
      if (window.userFullAccessCompanyIds.length > 0) {
        try {
          const compFilter = `empresa_id=in.(${window.userFullAccessCompanyIds.join(',')})`;
          const bRes = await fetch(`${supabaseUrl}sucursales?${compFilter}&select=id,empresa_id`, { headers: h });
          if (bRes.ok) {
            const bData = await bRes.json();
            bData.forEach(b => allowedBranchSet.add(b.id));
          }
        } catch (e) {
          console.warn("Could not resolve branches for full access companies:", e);
        }
      }

      window.userAllowedBranchIds = Array.from(allowedBranchSet);

      window.isCompanyAllowed = (companyId) => {
        if (isAdmin) return true;
        if (!companyId) return false;
        return window.userAllowedCompanyIds.includes(parseInt(companyId, 10));
      };

      window.isBranchAllowed = (branchId, companyId = null) => {
        if (isAdmin) return true;
        const bId = branchId ? parseInt(branchId, 10) : null;
        const cId = companyId ? parseInt(companyId, 10) : null;
        if (bId && window.userAllowedBranchIds.includes(bId)) return true;
        if (cId && window.userFullAccessCompanyIds.includes(cId)) return true;
        return false;
      };

      window.isVolumetryAllowed = (sucursalId) => {
        if (isAdmin) return true;
        if (!sucursalId) return false;
        return window.userAllowedBranchIds.includes(parseInt(sucursalId, 10));
      };

      window.canEditCompany = (companyId) => {
        if (isAdmin) return true;
        const cId = parseInt(companyId, 10);
        return activeAssignments.some(a => a.empresa_id === cId && a.edicion === true);
      };

      window.canEditBranch = (branchId, companyId = null) => {
        if (isAdmin) return true;
        const bId = branchId ? parseInt(branchId, 10) : null;
        const cId = companyId ? parseInt(companyId, 10) : null;
        return activeAssignments.some(a => {
          if (a.edicion !== true) return false;
          if (bId && a.sucursal_id === bId) return true;
          if (cId && a.empresa_id === cId && !a.sucursal_id) return true;
          return false;
        });
      };

    } catch (err) {
      console.error("Error loading user company permissions:", err);
    }
  };

  // Load user company/branch permissions immediately
  await loadUserCompanyPermissions();

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
  if (companyDisplayName) {
    if (isAdmin) {
      companyDisplayName.textContent = "Administración";
    } else if (window.userCompanyName) {
      companyDisplayName.textContent = window.userCompanyName;
    } else {
      companyDisplayName.textContent = "Sin empresa asociada";
    }
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
  initBranchDetailsModule();
  initDetailTypesModule();
  initRolePermissionsModule();
  initRevisionsModule();
  initBranchesModule();
  initProductsModule();
  initPeriodsModule();
  initVolumePeriodModule();
  initUserRolesModule();
  initUserCompaniesModule();

  // --- Volumetría Sub-menu Handler ---
  const btnToggleVolumetria = document.getElementById('btn-toggle-volumetria-submenu');
  const volumetriaSubmenu = document.getElementById('volumetria-submenu');
  const arrowVolumetria = document.getElementById('arrow-volumetria-submenu');
  if (btnToggleVolumetria && volumetriaSubmenu && arrowVolumetria) {
    btnToggleVolumetria.addEventListener('click', () => {
      const isHidden = volumetriaSubmenu.classList.contains('hidden');
      if (isHidden) {
        volumetriaSubmenu.classList.remove('hidden');
        arrowVolumetria.classList.add('rotate-180');
      } else {
        volumetriaSubmenu.classList.add('hidden');
        arrowVolumetria.classList.remove('rotate-180');
      }
    });
  }

  // --- Tab Navigation System (Simulate Views) ---
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const views = document.querySelectorAll('.dashboard-view');

  const viewTitles = {
    'view-dashboard': 'Dashboard - Empresas',
    'view-companies': 'Empresas - Empresas',
    'view-branches': 'Sucursales - Empresas',
    'view-revisions': 'Revisiones - Empresas',
    'view-users': 'Usuarios - Empresas',
    'view-roles': 'Roles - Empresas',
    'view-regions': 'Regiones - Empresas',
    'view-detail-types': 'Tipos de Detalles - Empresas',
    'view-settings': 'Ajustes - Empresas',
    'view-products': 'Productos/Servicios - Empresas',
    'view-periods': 'Períodos - Empresas',
    'view-volume-period': 'Volumetría por Período - Empresas'
  };

  sidebarItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      const targetViewId = item.getAttribute('data-view');
      if (!targetViewId) return;

      if (!window.hasPermission(targetViewId, 'leer')) {
        showToast('No tienes permiso para acceder a esta sección.', false);
        return;
      }

      sidebarItems.forEach((el) => {
        el.classList.remove('bg-brand/10', 'text-brand', 'border-l-4', 'border-brand', 'dark:text-white', 'active-item');
        el.classList.add('text-slate-600', 'dark:text-slate-400');
      });

      item.classList.add('bg-brand/10', 'text-brand', 'border-l-4', 'border-brand', 'dark:text-white', 'active-item');
      item.classList.remove('text-slate-655', 'text-slate-650', 'text-slate-600', 'dark:text-slate-400');

      if (viewTitles[targetViewId]) {
        document.title = viewTitles[targetViewId];
      }

      views.forEach((view) => {
        if (view.id === targetViewId) {
          view.classList.remove('hidden');
          const reveals = view.querySelectorAll('.reveal');
          reveals.forEach(r => r.classList.add('active'));

          if (targetViewId === 'view-users') loadUsers();
          if (targetViewId === 'view-roles') loadRoles();
          if (targetViewId === 'view-regions') loadRegions();
          if (targetViewId === 'view-companies') loadCompanies();
          if (targetViewId === 'view-branches') loadBranches();
          if (targetViewId === 'view-detail-types') loadDetailTypes();
          if (targetViewId === 'view-revisions') loadRevisions();
          if (targetViewId === 'view-products') loadProducts();
          if (targetViewId === 'view-periods') loadPeriods();
          if (targetViewId === 'view-volume-period') loadVolumePeriod();
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

      if (type === 'role_permission') {
        const loadingEl = document.getElementById('role-permissions-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}roles_permision?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el permiso.");
          showToast('Permiso eliminado con éxito.', true);
          loadRolePermissions();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el permiso.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'role') {
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
      } else if (type === 'branch_detail') {
        const loadingEl = document.getElementById('branch-details-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}detalle_sucursales?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el detalle.");
          showToast('Detalle de sucursal eliminado con éxito.', true);
          loadBranchDetails(currentBranchIdForDetails);
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el detalle.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'user_role') {
        const loadingEl = document.getElementById('user-roles-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}user_roles?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo desasignar el rol.");
          showToast('Rol desasignado con éxito.', true);
          loadUserRoles(currentUserIdForRoles);
        } catch (e) {
          console.error(e);
          showToast('Error al desasignar el rol.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'user_company') {
        const loadingEl = document.getElementById('user-companies-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}usuarios_empresas?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar la asignación de empresa.");
          showToast('Asignación eliminada con éxito.', true);
          loadUserCompanies(currentUserIdForCompanies);
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar la asignación.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'detail_type') {
        const loadingEl = document.getElementById('detail-types-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}tipo_detalle?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el tipo de detalle.");
          showToast('Tipo de detalle eliminado con éxito.', true);
          loadDetailTypes();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el tipo de detalle.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'revision') {
        const loadingEl = document.getElementById('revisions-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}revision?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar la revisión.");
          showToast('Revisión eliminada con éxito.', true);
          loadRevisions();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar la revisión.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'volume-period') {
        const loadingEl = document.getElementById('volume-period-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}volumne_periodo?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error('No se pudo eliminar el registro de volumetría.');
          showToast('Registro eliminado con éxito.', true);
          loadVolumePeriod();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el registro.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'period') {
        const loadingEl = document.getElementById('periods-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}periodos?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error('No se pudo eliminar el período.');
          showToast('Período eliminado con éxito.', true);
          loadPeriods();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el período.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'product') {
        const loadingEl = document.getElementById('products-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}producto?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar el producto/servicio.");
          showToast('Producto/Servicio eliminado con éxito.', true);
          loadProducts();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar el producto/servicio.', false);
          loadingEl?.classList.add('hidden');
        }
      } else if (type === 'branch') {
        const loadingEl = document.getElementById('branches-loading');
        loadingEl?.classList.remove('hidden');
        try {
          const res = await fetch(`${supabaseUrl}sucursales?id=eq.${id}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (!res.ok) throw new Error("No se pudo eliminar la sucursal.");
          showToast('Sucursal eliminada con éxito.', true);
          loadBranches();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar la sucursal.', false);
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
