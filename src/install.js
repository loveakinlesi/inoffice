import { $, toast } from './ui.js';

const DISMISS_KEY = 'inoffice.install.dismissed.v1';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isMobile = () => window.matchMedia('(max-width: 767px)').matches && window.matchMedia('(pointer: coarse)').matches;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initInstallPrompt(state) {
  const banner = $('installPrompt');
  const text = $('installPromptText');
  const installBtn = $('installBtn');
  const dismissBtn = $('installDismissBtn');
  if (!banner || !text || !installBtn || !dismissBtn) return () => {};

  let deferredPrompt = null;

  const hasData = () => state.settings.onboardingComplete || Object.keys(state.entries).length > 0;

  const update = () => {
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    const shouldShow = isMobile() && !isStandalone() && !dismissed;
    banner.hidden = !shouldShow;
    if (!shouldShow) return;

    text.textContent = hasData()
      ? 'Your attendance stays in this browser. Install now so it behaves like an app on your phone. If you plan to move to a different phone later, export a backup in Settings first, then import it on the new device.'
      : 'Install now so InOffice opens like an app on your phone. Start here before you record attendance, then it will stay on your home screen.';

    if (deferredPrompt) {
      installBtn.textContent = 'Install app';
      return;
    }

    installBtn.textContent = isIOS() ? 'How to add' : 'Install app';
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    update();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toast('InOffice added to your home screen');
    update();
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        update();
      }
      return;
    }

    toast(isIOS() ? 'On iPhone, use Share > Add to Home Screen.' : 'Open the browser menu and choose Install app or Add to Home screen.');
  });

  dismissBtn.addEventListener('click', () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    update();
  });

  window.addEventListener('resize', update, { passive: true });
  update();
  return update;
}
