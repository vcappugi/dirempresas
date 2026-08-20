document.addEventListener('DOMContentLoaded', () => {
  // --- Dark Mode Handler ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
  const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

  // Set initial theme based on localStorage or system preferences
  if (
    localStorage.getItem('color-theme') === 'dark' ||
    (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
    if (themeToggleLightIcon) themeToggleLightIcon.classList.remove('hidden');
    if (themeToggleDarkIcon) themeToggleDarkIcon.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    if (themeToggleLightIcon) themeToggleLightIcon.classList.add('hidden');
    if (themeToggleDarkIcon) themeToggleDarkIcon.classList.remove('hidden');
  }

  // Toggle theme button listener
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      // Toggle icons inside button
      themeToggleDarkIcon?.classList.toggle('hidden');
      themeToggleLightIcon?.classList.toggle('hidden');

      // If set via local storage previously
      if (localStorage.getItem('color-theme')) {
        if (localStorage.getItem('color-theme') === 'light') {
          document.documentElement.classList.add('dark');
          localStorage.setItem('color-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('color-theme', 'light');
        }
      } else {
        // If not set via local storage
        if (document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('color-theme', 'light');
        } else {
          document.documentElement.classList.add('dark');
          localStorage.setItem('color-theme', 'dark');
        }
      }
    });
  }

  // --- Mobile Menu Toggle ---
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
      const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
      mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
      mobileMenu.classList.toggle('hidden');
      mobileMenu.classList.toggle('flex');
    });
  }

  // --- Scroll Header Styling & Navigation Active State ---
  const header = document.querySelector('header');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    // Header shadow/blur on scroll
    if (window.scrollY > 20) {
      header?.classList.add('shadow-md', 'backdrop-blur-md', 'bg-white/90', 'dark:bg-slate-900/90');
      header?.classList.remove('bg-transparent');
    } else {
      header?.classList.remove('shadow-md', 'backdrop-blur-md', 'bg-white/90', 'dark:bg-slate-900/90');
      header?.classList.add('bg-transparent');
    }

    // Scroll Spy active navigation link
    let current = '';
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= sectionTop - 120) {
        current = section.getAttribute('id') || '';
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('text-brand', 'font-semibold');
      link.classList.add('text-slate-600', 'dark:text-slate-300');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('text-brand', 'font-semibold');
        link.classList.remove('text-slate-600', 'dark:text-slate-300');
      }
    });
  });

  // --- Intersection Observer for Animations ---
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          // Once animated, no need to track it further
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // --- Counter Animation ---
  const statsElements = document.querySelectorAll('.stat-number');
  const countUp = (element) => {
    const target = parseInt(element.getAttribute('data-target') || '0', 10);
    const suffix = element.getAttribute('data-suffix') || '';
    const duration = 2000; // 2 seconds
    const startTime = performance.now();

    const updateCount = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      // Easing out cubic: progress = 1 - (1 - progress)^3
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.floor(easedProgress * target);

      element.textContent = currentVal.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        element.textContent = target.toLocaleString() + suffix;
      }
    };

    requestAnimationFrame(updateCount);
  };

  const statObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          countUp(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  statsElements.forEach((stat) => statObserver.observe(stat));

  // --- Premium Contact Form & Notification (Toast) ---
  const contactForm = document.getElementById('contact-form');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  const showToast = (message, isSuccess = true) => {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    
    // Reset classes
    toast.className = 'fixed bottom-5 right-5 flex items-center w-full max-w-xs p-4 space-x-4 text-slate-500 bg-white divide-x rtl:divide-x-reverse divide-slate-200 rounded-lg shadow dark:text-slate-400 dark:divide-slate-700 space-x dark:bg-slate-800 transition-all duration-500 translate-y-24 opacity-0 z-50';
    
    // Add success/error indicator classes if needed
    const indicator = toast.querySelector('.toast-indicator');
    if (indicator) {
      if (isSuccess) {
        indicator.className = 'toast-indicator inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-800 dark:text-green-200';
        indicator.innerHTML = '<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/></svg>';
      } else {
        indicator.className = 'toast-indicator inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-red-500 bg-red-100 rounded-lg dark:bg-red-800 dark:text-red-200';
        indicator.innerHTML = '<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm1.293 9.707a1 1 0 0 1-1.414 1.414L10 10.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L8.586 10 7.293 8.707a1 1 0 0 1 1.414-1.414L10 9.586l1.293-1.293a1 1 0 0 1 1.414 1.414L11.414 10l1.293 1.293Z"/></svg>';
      }
    }

    // Slide up and fade in
    toast.classList.remove('translate-y-24', 'opacity-0');
    
    // Auto-hide toast after 4 seconds
    setTimeout(() => {
      toast.classList.add('translate-y-24', 'opacity-0');
    }, 4000);
  };

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const submitButton = contactForm.querySelector('button[type="submit"]');
      const originalText = submitButton ? submitButton.innerHTML : 'Enviar';

      // Set Loading State
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = `
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg> Enviando...
        `;
      }

      // Simulate API post call (1.5 seconds)
      setTimeout(() => {
        // Reset loading state
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalText;
        }

        const emailInput = document.getElementById('email');
        const nameInput = document.getElementById('name');
        
        if (emailInput && emailInput.value && nameInput && nameInput.value) {
          showToast(`¡Gracias ${nameInput.value}! Mensaje enviado con éxito.`, true);
          contactForm.reset();
        } else {
          showToast('Por favor completa todos los campos requeridos.', false);
        }
      }, 1500);
    });
  }
});
