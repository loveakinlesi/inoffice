import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { useAttendance } from '@/state/attendance.tsx';

const DISMISS_KEY = 'inoffice.install.snoozed.v1';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isMobile = () => matchMedia('(max-width: 767px)').matches && matchMedia('(pointer: coarse)').matches;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// "Not now" is remembered for a month, per device, rather than reappearing every visit.
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const readDismissed = () => { try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < SNOOZE_MS; } catch { return false; } };
/** Only worth asking once someone is actually using it: a few days logged or planned. */
const MIN_DAYS = 3;

/** A single quiet line at the top of the app on phones; it sits in the page flow so it never covers the calendar. */
export function InstallPrompt() {
  const { entries } = useAttendance();
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

  if (!eligible || dismissed || Object.keys(entries).length < MIN_DAYS) return null;

  const install = async () => {
    if (!deferred) {
      toast.add({ title: isIOS() ? 'On iPhone, use Share > Add to Home Screen.' : 'Open the browser menu and choose Install app or Add to Home screen.' });
      return;
    }
    await deferred.prompt();
    try { await deferred.userChoice; } finally { setDeferred(null); }
  };
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Dismissal still applies for this visit. */ }
    setDismissed(true);
  };

  return (
    <section id="installPrompt" aria-label="Install InOffice" className="flex items-center gap-2 rounded-2xl bg-card py-2 pr-2 pl-4 text-sm shadow-xs ring-1 ring-foreground/[0.07]">
      <p className="min-w-0 flex-1">Add InOffice to your home screen</p>
      <Button size="sm" onClick={install}>{deferred || !isIOS() ? 'Install' : 'How to add'}</Button>
      <Button size="icon-sm" variant="ghost" aria-label="Not now" onClick={dismiss}><XIcon /></Button>
    </section>
  );
}
