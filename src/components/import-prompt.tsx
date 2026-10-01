import { useState } from 'react';
import { UploadCloudIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { useSession } from '@/lib/auth-client.ts';
import { useAttendance } from '@/state/attendance.tsx';

/** Per-device record of accounts that already answered the import question. */
const DECIDED_KEY = 'inoffice.import-decided.v1';

function readDecided(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(DECIDED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}

function markDecided(userId: string) {
  try { localStorage.setItem(DECIDED_KEY, JSON.stringify([...new Set([...readDecided(), userId])])); } catch { /* Asking again next time is acceptable. */ }
}

/** True when signed in with account data loaded, this browser has guest data, and the user hasn't decided yet. */
export function useShouldOfferImport() {
  const { mode, accountStatus, localData } = useAttendance();
  const { data: session } = useSession();
  const [decided, setDecided] = useState(readDecided);
  const userId = session?.user.id;
  const hasLocal = localData.settings.onboardingComplete || Object.keys(localData.entries).length > 0;
  const offer = mode === 'account' && accountStatus === 'ready' && !!userId && hasLocal && !decided.includes(userId);
  const decide = () => { if (userId) { markDecided(userId); setDecided(readDecided()); } };
  return { offer, decide };
}

/** "N recorded days" or "your settings": what this browser would sync into the account. */
export function localSummary(entries: Record<string, unknown>) {
  const days = Object.keys(entries).length;
  return { days, what: days > 0 ? `${days} recorded day${days === 1 ? '' : 's'}` : 'your settings' };
}

export function ImportPrompt({ onDecided }: { onDecided: () => void }) {
  const { localData, accountHasSettings, importLocalIntoAccount, firstName } = useAttendance();
  const [pending, setPending] = useState(false);
  const { days, what } = localSummary(localData.entries);

  const sync = async () => {
    setPending(true);
    if (await importLocalIntoAccount()) {
      toast.add({ title: days > 0 ? `Synced ${what} to your account` : 'Settings synced to your account' });
      onDecided();
    } else {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <UploadCloudIcon className="mb-8 size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-3xl font-semibold tracking-tight">Sync this device to your account?</h1>
      <p className="mt-4 text-lg leading-7 text-muted-foreground">
        {firstName ? `Welcome, ${firstName}. ` : ''}You’ve been using InOffice on this device without an account. It has {what} saved here.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {accountHasSettings
          ? 'Your account already has data. Anything in your account is kept; only days it’s missing are added.'
          : 'Your target and bank holiday calendar will be copied too.'}
        {' '}The copy on this device isn’t deleted.
      </p>
      <div className="mt-10 flex flex-col gap-3">
        <Button size="lg" className="h-11 w-full text-base" disabled={pending} onClick={sync}>
          {pending && <Spinner data-icon="inline-start" />}
          Sync {what}
        </Button>
        <Button variant="ghost" size="lg" className="h-11 w-full text-base" disabled={pending} onClick={onDecided}>Not now</Button>
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">You can sync later from Settings.</p>
    </main>
  );
}
