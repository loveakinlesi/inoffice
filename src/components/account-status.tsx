import { CloudOffIcon, WifiOffIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { signOutAndNotify } from '@/components/account-menu.tsx';
import { useAttendance } from '@/state/attendance.tsx';

/** Full-screen state while signed-in data loads, or when it couldn't be loaded. */
export function AccountLoading() {
  const { accountStatus, online, reloadAccount } = useAttendance();
  if (accountStatus !== 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-3 text-muted-foreground" aria-busy="true">
        <Spinner />
        <span>Loading your attendance…</span>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <Alert>
        <CloudOffIcon />
        <AlertTitle>Couldn’t load your account</AlertTitle>
        <AlertDescription>
          {online ? 'Something went wrong while loading your attendance. Try again in a moment.' : 'You’re offline. Reconnect to load your attendance.'}
        </AlertDescription>
      </Alert>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => void reloadAccount()}>Try again</Button>
        <Button variant="outline" onClick={() => void signOutAndNotify()}>Sign out</Button>
      </div>
    </main>
  );
}

/** Shown in the app shell when signed in and offline: account data is read-only until reconnecting. */
export function OfflineBanner() {
  const { mode, online } = useAttendance();
  if (mode !== 'account' || online) return null;
  return (
    <Alert role="status" className="mx-auto w-full max-w-7xl">
      <WifiOffIcon />
      <AlertTitle>You’re offline</AlertTitle>
      <AlertDescription>You can view your attendance, but changes can’t be saved until you reconnect.</AlertDescription>
    </Alert>
  );
}
