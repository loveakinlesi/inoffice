import { useState } from 'react';
import { UploadCloudIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.tsx';
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

export function ImportPrompt({ onDecided }: { onDecided: () => void }) {
  const { localData, accountHasSettings, importLocalIntoAccount } = useAttendance();
  const [pending, setPending] = useState(false);
  const days = Object.keys(localData.entries).length;
  const what = days > 0 ? `${days} recorded day${days === 1 ? '' : 's'}` : 'your settings';

  const importData = async () => {
    setPending(true);
    if (await importLocalIntoAccount()) {
      toast.add({ title: days > 0 ? `Imported ${what}` : 'Settings imported' });
      onDecided();
    } else {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <Card className="shadow-card">
        <CardHeader>
          <UploadCloudIcon className="mb-2 size-8 text-muted-foreground" aria-hidden="true" />
          <CardTitle><h1 className="text-xl font-semibold tracking-tight">Import data from this device?</h1></CardTitle>
          <CardDescription className="text-sm leading-6">
            This browser has {what} from before you signed in. Import {days > 0 ? 'them' : 'it'} into your account to keep everything in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          {accountHasSettings
            ? 'Your account already has data. Anything already in your account is kept; only days missing from it are added.'
            : 'Your target and bank holiday calendar will be copied too.'}
          {' '}The copy on this device isn’t deleted.
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="lg" disabled={pending} onClick={onDecided}>Not now</Button>
          <Button size="lg" disabled={pending} onClick={importData}>
            {pending && <Spinner data-icon="inline-start" />}
            Import {what}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
