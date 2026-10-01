import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { FieldGroup } from '@/components/ui/field.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog.tsx';
import { SignInButton, initials, signOutAndNotify } from '@/components/account-menu.tsx';
import { useAuthConfig, useSession } from '@/lib/auth-client.ts';
import { localSummary } from '@/components/import-prompt.tsx';
import { RegionControl, TargetControls, applyTargetDraft, toTargetDraft } from '@/components/target-controls.tsx';
import { formatMonth } from '@/lib/attendance.ts';
import { holidayCoverage } from '@/lib/holidays.ts';
import { validateBackup } from '@/lib/validation.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

/** Lets a signed-in user sync this browser's guest data later (e.g. after choosing "Not now"). */
function SyncLocalData() {
  const { localData, entries, accountHasSettings, importLocalIntoAccount, accountStatus } = useAttendance();
  const [pending, setPending] = useState(false);
  // Only offer what the account is missing: merge never overwrites days the account already has.
  const missing = Object.fromEntries(Object.entries(localData.entries).filter(([date]) => !Object.hasOwn(entries, date)));
  const settingsMissing = localData.settings.onboardingComplete && accountHasSettings === false;
  if (accountStatus !== 'ready' || (Object.keys(missing).length === 0 && !settingsMissing)) return null;
  const { days, what } = localSummary(missing);
  const sync = async () => {
    setPending(true);
    if (await importLocalIntoAccount()) toast.add({ title: days > 0 ? `Synced ${what} to your account` : 'Settings synced to your account' });
    setPending(false);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <p className="text-sm leading-6 text-muted-foreground">This device has {what} from before you signed in.</p>
      <Button variant="outline" disabled={pending} onClick={sync}>
        {pending && <Spinner data-icon="inline-start" />}
        Sync to account
      </Button>
    </div>
  );
}

function AccountSection() {
  const config = useAuthConfig();
  const { data: session, isPending } = useSession();
  if (isPending || !config || (!session && !config.providers.google)) return null;
  return (
    <>
      <section className="flex flex-col gap-3">
        <h3 className="font-medium">Account</h3>
        {session ? (
          <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="lg">
                {session.user.image && <AvatarImage src={session.user.image} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session.user.name}</p>
                <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void signOutAndNotify()}>Sign out</Button>
          </div>
          <SyncLocalData />
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">Sign in to back up your attendance and use it on any device. You can keep using InOffice without an account.</p>
            <SignInButton label="Sign in with Google" className="self-start" />
          </>
        )}
      </section>
      <Separator />
    </>
  );
}

function PreferencesForm() {
  const { settings, saveSettings } = useAttendance();
  const [target, setTarget] = useState(() => toTargetDraft(settings));
  const [region, setRegion] = useState(settings.region);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saveSettings({ ...applyTargetDraft(settings, target), region })) toast.add({ title: 'Settings saved' });
  };

  return (
    <form id="settingsForm" onSubmit={submit}>
      <FieldGroup>
        <TargetControls value={target} onChange={setTarget} />
        <RegionControl value={region} onChange={setRegion} />
        <Button type="submit" size="lg" className="w-full">Save settings</Button>
      </FieldGroup>
    </form>
  );
}

function HolidaySection() {
  const state = useAttendance();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try { await state.refreshHolidays(true); } finally { setRefreshing(false); }
  };
  return (
    <section className="flex flex-col items-start gap-3">
      <h3 className="font-medium">Bank holidays</h3>
      <p id="holidaySettingsStatus" className="text-sm leading-6 text-muted-foreground">{state.holidayMessage + holidayCoverage(state)}</p>
      <Button variant="outline" disabled={refreshing} onClick={refresh}>
        {refreshing && <Spinner data-icon="inline-start" />}
        {refreshing ? 'Refreshing…' : 'Refresh bank holidays'}
      </Button>
    </section>
  );
}

function DataSection({ confirm }: { confirm: (r: ConfirmRequest) => void }) {
  const state = useAttendance();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const month = formatMonth(state.viewDate);
  const account = state.mode === 'account';

  const exportBackup = () => {
    const payload = { app: 'InOffice', version: 1, exportedAt: new Date().toISOString(), settings: state.settings, entries: state.entries, holidayCache: state.holidayCache };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `inoffice-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track('backup_exported');
    toast.add({ title: 'Backup exported' });
  };

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setImportError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('This file is too large. Choose an InOffice JSON backup smaller than 5 MB.');
      let parsed: unknown;
      try { parsed = JSON.parse(await file.text()); } catch { throw new Error('This file is not readable JSON. Choose a backup exported from InOffice.'); }
      const data = validateBackup(parsed);
      confirm({
        title: 'Replace your data?',
        description: 'Replace all current settings and attendance with this backup? Export your current data first if you want to keep it.',
        confirmLabel: 'Replace data',
        destructive: true,
        onConfirm: () => {
          if (!state.importBackup(data)) return;
          track('backup_imported');
          toast.add({ title: 'Backup imported' });
          navigate('/');
        },
      });
    } catch (error) {
      setImportError((error as Error).message);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium">Data</h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {account
          ? 'Your attendance is saved to your account and available wherever you sign in. Export a backup to keep your own copy. Importing replaces your account data.'
          : 'Attendance is saved only in this browser. Export a backup to keep a copy or move to another device. Importing replaces your current data.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportBackup}>Export JSON</Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>Import JSON</Button>
        <input ref={fileInput} id="importInput" type="file" accept=".json,application/json" hidden onChange={importBackup} />
      </div>
      {importError && <p id="importError" role="alert" className="text-sm text-destructive">{importError}</p>}
      <Separator className="my-1" />
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="outline"
          onClick={() => confirm({
            title: 'Reset current month?',
            description: `Reset all manual attendance entries for ${month}? Automatic bank holidays will remain.`,
            confirmLabel: 'Reset month',
            destructive: true,
            onConfirm: () => {
              if (!state.resetMonth(state.viewDate)) return;
              toast.add({ title: 'Current month reset' });
              navigate('/');
            },
          })}
        >
          Reset current month
        </Button>
        <p className="text-xs text-muted-foreground">Clears manual entries for {month}.</p>
        <Button variant="outline" className="mt-2" onClick={() => navigate('/onboarding')}>Run setup again</Button>
        <p className="text-xs text-muted-foreground">Your attendance history will be preserved.</p>
        <Button
          variant="destructive"
          className="mt-2"
          onClick={() => confirm({
            title: 'Reset all data?',
            description: account
              ? 'Delete all InOffice settings and attendance history from your account? This cannot be undone. Your sign-in stays active.'
              : 'Delete all InOffice settings, attendance history and cached bank holidays from this browser? This cannot be undone.',
            confirmLabel: 'Delete everything',
            destructive: true,
            onConfirm: () => { if (state.resetAll()) toast.add({ title: 'All InOffice data reset' }); },
          })}
        >
          Reset all InOffice data
        </Button>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { settings } = useAttendance();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  return (
    <Card id="settingsPage" aria-labelledby="settingsPageTitle" className="mx-auto w-full max-w-2xl shadow-card">
      <CardHeader className="border-b">
        <CardTitle id="settingsPageTitle" className="text-xl font-semibold tracking-tight">Settings</CardTitle>
        <CardDescription>Manage your target, bank holiday calendar, and local data.</CardDescription>
      </CardHeader>
      <CardContent id="settingsContentPage" className="flex flex-col gap-6">
        <AccountSection />
        {/* Remount when settings change elsewhere (import, setup, another tab) so the draft resets. */}
        <PreferencesForm key={JSON.stringify(settings)} />
        <Separator />
        <HolidaySection />
        <Separator />
        <DataSection confirm={setRequest} />
      </CardContent>
      <ConfirmDialog request={request} onClose={() => setRequest(null)} />
    </Card>
  );
}
