import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { useAttendance } from '@/state/attendance.tsx';

const DISMISS_KEY = 'inoffice.install.dismissed.v1';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isMobile = () => matchMedia('(max-width: 767px)').matches && matchMedia('(pointer: coarse)').matches;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const readDismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

export function InstallPrompt() {
  const { settings, entries, mode } = useAttendance();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [eligible, setEligible] = useState(() => isMobile() && !isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setDeferred(null); setEligible(false); toast.add({ title: 'InOffice added to your home screen' }); };
    const onResize = () => setEligible(isMobile() && !isStandalone());
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    addEventListener('resize', onResize, { passive: true });
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
      removeEventListener('resize', onResize);
    };
  }, []);

  if (!eligible || dismissed) return null;

  const hasData = settings.onboardingComplete || Object.keys(entries).length > 0;
  const install = async () => {
    if (!deferred) {
      toast.add({ title: isIOS() ? 'On iPhone, use Share > Add to Home Screen.' : 'Open the browser menu and choose Install app or Add to Home screen.' });
      return;
    }
    await deferred.prompt();
    try { await deferred.userChoice; } finally { setDeferred(null); }
  };
  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* Dismissal still applies for this render. */ }
    setDismissed(true);
  };

  return (
    <section id="installPrompt" className="fixed inset-x-0 bottom-0 z-70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
      <div className="dark mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border bg-background px-4 py-4 text-foreground shadow-2xl sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="max-w-2xl">
          <p className="text-base font-semibold tracking-tight">Install InOffice on your phone</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {mode === 'account'
              ? 'Install now so InOffice opens like an app on your phone. Your attendance is saved to your account.'
              : hasData
              ? 'Your attendance stays in this browser. Install now so it behaves like an app on your phone. If you plan to move to a different phone later, export a backup in Settings first, then import it on the new device.'
              : 'Install now so InOffice opens like an app on your phone. Start here before you record attendance, then it will stay on your home screen.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={install}>{deferred || !isIOS() ? 'Install app' : 'How to add'}</Button>
          <Button size="lg" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
    </section>
  );
}
