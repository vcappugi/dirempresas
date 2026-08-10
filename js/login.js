import { login } from './supabase-service.js';

document.addEventListener('DOMContentLoaded', () => {
  // --- Dark Mode Handler ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
  const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

  const applyTheme = (isDark) => {
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
  applyTheme(isDarkInitial);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const nextDark = !isDark;
      localStorage.setItem('color-theme', nextDark ? 'dark' : 'light');
      applyTheme(nextDark);
    });
  }

  // --- Corporate Theme Accent Synchronization ---
  // Default to green base on login page
  const savedAccent = localStorage.getItem('dashboard-accent-theme') || 'green';
  const accentThemes = {
    green: { primary: '#355a31', light: '#528a4c', dark: '#223a20', rgb: '53, 90, 49' },
    blue: { primary: '#1e3a8a', light: '#3b82f6', dark: '#172554', rgb: '30, 58, 138' },
    emerald: { primary: '#065f46', light: '#10b981', dark: '#064e3b', rgb: '6, 95, 70' },
    indigo: { primary: '#3730a3', light: '#6366f1', dark: '#312e81', rgb: '55, 48, 163' }
  };
  const themeObj = accentThemes[savedAccent] || accentThemes.green;
  const root = document.documentElement;
  root.style.setProperty('--color-brand', themeObj.primary);
  root.style.setProperty('--color-brand-light', themeObj.light);
  root.style.setProperty('--color-brand-dark', themeObj.dark);
  root.style.setProperty('--color-brand-rgb', themeObj.rgb);

  // --- Login Form Logic ---
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorAlert = document.getElementById('error-alert');
  const errorMessage = document.getElementById('error-message');
  const btnSubmit = document.getElementById('btn-login-submit');

  const emailValidation = document.getElementById('email-validation');
  const passwordValidation = document.getElementById('password-validation');

  const showError = (message) => {
    if (!errorAlert || !errorMessage) return;
    errorMessage.textContent = message;
    errorAlert.classList.remove('hidden');
    
    // Premium shake micro-animation for feedback
    errorAlert.classList.remove('animate-shake');
    void errorAlert.offsetWidth; // Trigger reflow
    errorAlert.classList.add('animate-shake');
  };

  const hideError = () => {
    errorAlert?.classList.add('hidden');
  };

  // Live input validations
  emailInput?.addEventListener('input', () => {
    hideError();
    if (emailInput.value.trim().length > 0) {
      emailValidation?.classList.add('hidden');
    }
  });

  passwordInput?.addEventListener('input', () => {
    hideError();
    if (passwordInput.value.trim().length > 0) {
      passwordValidation?.classList.add('hidden');
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const email = emailInput?.value.trim();
      const password = passwordInput?.value;

      let hasErrors = false;

      // 1. Client-Side Field Validation
      if (!email) {
        emailValidation?.classList.remove('hidden');
        hasErrors = true;
      } else {
        emailValidation?.classList.add('hidden');
      }

      if (!password) {
        passwordValidation?.classList.remove('hidden');
        hasErrors = true;
      } else {
        passwordValidation?.classList.add('hidden');
      }

      if (hasErrors) return;

      // 2. Set loading state
      const originalText = btnSubmit.innerHTML;
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Autenticando...
      `;

      try {
        // 3. Call service login operation
        await login(email, password);
        
        // 4. Redirect upon success
        window.location.href = 'index.html';
      } catch (err) {
        console.error("Login failure:", err);
        showError(err.message || "Fallo en el inicio de sesión. Intente nuevamente.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }
    });
  }
});
