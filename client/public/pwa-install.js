let deferredPrompt;

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768 && 'ontouchstart' in window);
}

function shouldShowPrompt() {
  return !localStorage.getItem('pwa-install-dismissed') &&
         !window.matchMedia('(display-mode: standalone)').matches &&
         isMobileDevice();
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (shouldShowPrompt()) {
    setTimeout(() => {
      const prompt = document.getElementById('pwa-install-prompt');
      if (prompt) {
        prompt.classList.remove('hidden');
      }
    }, 5000);
  }
});

document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    } catch (error) {
      console.error('Install prompt failed:', error);
    }
    document.getElementById('pwa-install-prompt')?.classList.add('hidden');
  }
});

document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
  document.getElementById('pwa-install-prompt')?.classList.add('hidden');
  localStorage.setItem('pwa-install-dismissed', 'true');
});

window.addEventListener('beforeinstallprompt', () => {
  setTimeout(() => {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt && !prompt.classList.contains('hidden')) {
      prompt.classList.add('hidden');
    }
  }, 15000);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt && !prompt.classList.contains('hidden')) {
      prompt.classList.add('hidden');
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}

