import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { FieldGroup } from '@/components/ui/field.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog.tsx';
import { SignInButton, initials, signOutAndNotify } from '@/components/account-menu.tsx';
import { useAuthConfig, useSession } from '@/lib/auth-client.ts';
import { localSummary } from '@/components/import-prompt.tsx';
import { RegionControl, TargetControls, applyTargetDraft, targetDescription, toTargetDraft } from '@/components/target-controls.tsx';
import { REGION_NAMES } from '@/lib/constants.ts';
import { PencilIcon } from 'lucide-react';
import { formatMonth } from '@/lib/attendance.ts';
import { holidayCoverage } from '@/lib/holidays.ts';
import { validateBackup } from '@/lib/validation.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

function SettingsGroup({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="px-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      <div className={cn('divide-y overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.07]', className)}>{children}</div>
    </section>
  );
}

/** A labelled setting with its control on the right; `stack` puts a wide control below on small screens. */
function SettingsRow({ title, description, action, id, stack = false }: { title: ReactNode; description?: ReactNode; action: ReactNode; id?: string; stack?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-4 py-3.5', stack && 'flex-col items-stretch gap-3 sm:flex-row sm:items-center')}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p id={id} className="text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      <div className={cn('shrink-0', stack && '*:w-full sm:*:w-auto')}>{action}</div>
    </div>
  );
}

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
    <SettingsRow
      title="This device"
      description={`This device has ${what} from before you signed in.`}
      action={(
        <Button variant="outline" disabled={pending} onClick={sync}>
          {pending && <Spinner data-icon="inline-start" />}
          Sync to account
        </Button>
      )}
    />
  );
}

function AccountSection() {
  const config = useAuthConfig();
  const { data: session, isPending } = useSession();
  if (isPending || !config || (!session && !config.providers.google)) return null;
  if (!session) {
    return (
      <SettingsGroup title="Account">
        <SettingsRow
          title="Sync across devices"
          description="Back up your attendance and use it anywhere. You can keep using InOffice without an account."
          action={<SignInButton label="Sign in with Google" size="default" />}
          stack
        />
      </SettingsGroup>
    );
  }
  return (
    <SettingsGroup title="Account">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
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
    </SettingsGroup>
  );
}

/** Collapsed to a summary until the user chooses to edit; saving or cancelling collapses it again. */
function PreferencesForm() {
  const { settings, saveSettings } = useAttendance();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(() => toTargetDraft(settings));
  const [region, setRegion] = useState(settings.region);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Saving changes `settings`, which remounts this component (see SettingsPage) and collapses it.
    if (saveSettings({ ...applyTargetDraft(settings, target), region })) toast.add({ title: 'Settings saved' });
  };

  const cancel = () => {
    setTarget(toTargetDraft(settings));
    setRegion(settings.region);
    setEditing(false);
  };

  return (
    <SettingsGroup title="Attendance" description="Your office target and the bank holidays that don’t count as working days.">
      {editing ? (
        <form id="settingsForm" onSubmit={submit} className="p-4">
          <FieldGroup>
            <TargetControls value={target} onChange={setTarget} />
            <RegionControl value={region} onChange={setRegion} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" size="lg" onClick={cancel}>Cancel</Button>
              <Button type="submit" size="lg">Save settings</Button>
            </div>
          </FieldGroup>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-4 px-4 py-3.5">
          <dl className="grid min-w-0 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Target</dt>
              <dd id="targetSummary" className="font-medium">{targetDescription(settings)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bank holidays</dt>
              <dd id="regionSummary" className="font-medium">{REGION_NAMES[settings.region]}</dd>
            </div>
          </dl>
          <Button variant="outline" aria-label="Edit attendance settings" aria-expanded={false} aria-controls="settingsForm" onClick={() => setEditing(true)}>
            <PencilIcon data-icon="inline-start" />
            Edit
          </Button>
        </div>
      )}
    </SettingsGroup>
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
    <SettingsGroup title="Bank holidays">
      <SettingsRow
        title="UK bank holidays"
        id="holidaySettingsStatus"
        description={state.holidayMessage + holidayCoverage(state)}
        action={(
          <Button variant="outline" disabled={refreshing} onClick={refresh} aria-label="Refresh bank holidays">
            {refreshing && <Spinner data-icon="inline-start" />}
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        )}
      />
    </SettingsGroup>
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
    <>
      <SettingsGroup
        title="Data"
        description={account
          ? 'Your attendance is saved to your account and available wherever you sign in.'
          : 'Attendance is saved only in this browser. Export a backup to keep a copy or move to another device.'}
      >
        <SettingsRow title="Export backup" description="Download your settings and attendance as JSON." action={<Button variant="outline" onClick={exportBackup}>Export JSON</Button>} />
        <SettingsRow
          title="Restore backup"
          description={account ? 'Replaces your account data with a backup.' : 'Replaces the data in this browser with a backup.'}
          action={<Button variant="outline" onClick={() => fileInput.current?.click()}>Import JSON</Button>}
        />
        <input ref={fileInput} id="importInput" type="file" accept=".json,application/json" hidden onChange={importBackup} />
        {importError && <p id="importError" role="alert" className="px-4 py-3 text-sm text-destructive">{importError}</p>}
        <SettingsRow
          title="Clear this month"
          description={`Removes manual entries for ${month}.`}
          action={(
            <Button
              variant="outline"
              onClick={() => confirm({
                title: 'Clear this month?',
                description: `Reset all manual attendance entries for ${month}? Automatic bank holidays will remain.`,
                confirmLabel: 'Clear month',
                destructive: true,
                onConfirm: () => {
                  if (!state.resetMonth(state.viewDate)) return;
                  toast.add({ title: `${month} cleared` });
                  navigate('/');
                },
              })}
            >
              Clear
            </Button>
          )}
        />
        <SettingsRow title="Run setup again" description="Change your target step by step. History is kept." action={<Button variant="outline" onClick={() => navigate('/onboarding')}>Run setup</Button>} />
      </SettingsGroup>
      <SettingsGroup title="Danger zone">
        <SettingsRow
          title="Delete all data"
          description={account ? 'Deletes your settings and attendance from your account.' : 'Deletes everything InOffice stores in this browser.'}
          action={(
            <Button
              variant="destructive"
              onClick={() => confirm({
                title: 'Delete all data?',
                description: account
                  ? 'Delete all InOffice settings and attendance history from your account? This cannot be undone. Your sign-in stays active.'
                  : 'Delete all InOffice settings, attendance history and cached bank holidays from this browser? This cannot be undone.',
                confirmLabel: 'Delete everything',
                destructive: true,
                onConfirm: () => { if (state.resetAll()) toast.add({ title: 'All InOffice data deleted' }); },
              })}
            >
              Delete
            </Button>
          )}
        />
      </SettingsGroup>
    </>
  );
}

export function SettingsPage() {
  const { settings } = useAttendance();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  return (
    <div id="settingsPage" aria-labelledby="settingsPageTitle" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="px-1">
        <h1 id="settingsPageTitle" className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account, office target, bank holidays and data.</p>
      </div>
      <div id="settingsContentPage" className="flex flex-col gap-8">
        <AccountSection />
        {/* Remount when settings change elsewhere (import, setup, another tab) so the draft resets. */}
        <PreferencesForm key={JSON.stringify(settings)} />
        <HolidaySection />
        <DataSection confirm={setRequest} />
      </div>
      <ConfirmDialog request={request} onClose={() => setRequest(null)} />
    </div>
  );
}
