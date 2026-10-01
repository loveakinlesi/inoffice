import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { RegionControl, TargetControls, applyTargetDraft, targetDescription, toTargetDraft } from '@/components/target-controls.tsx';
import { REGION_NAMES } from '@/lib/constants.ts';
import { MAX_FIRST_NAME_LENGTH, normalizeFirstName } from '@/lib/validation.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

type Step = 'name' | 'target' | 'region' | 'done';

/**
 * Setup steps at /onboarding: first run after the landing page, or rerun from Settings.
 * Guests are asked their first name first; signed-in users (named by Google) skip that step.
 */
export function Onboarding() {
  const { settings, saveSettings, saveProfile, firstName, mode } = useAttendance();
  const navigate = useNavigate();
  const [steps] = useState<Step[]>(() => (mode === 'local' && !firstName ? ['name', 'target', 'region', 'done'] : ['target', 'region', 'done']));
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState(settings);
  const [target, setTarget] = useState(() => toTargetDraft(settings));
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = steps[index]!;
  const questionCount = steps.length - 1;

  useEffect(() => { headingRef.current?.focus(); }, [index]);

  const finish = () => {
    navigate('/');
    requestAnimationFrame(() => document.getElementById('settingsLink')?.focus());
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'name' && !normalizeFirstName(name)) { setNameError('Enter your first name to continue.'); return; }
    if (step === 'target') setDraft(d => applyTargetDraft(d, target));
    if (step !== 'done') { setIndex(i => i + 1); return; }
    const guestName = normalizeFirstName(name);
    if (steps.includes('name') && guestName && !saveProfile({ firstName: guestName })) return;
    if (!saveSettings({ ...draft, onboardingComplete: true })) return;
    track('onboarding_completed');
    finish();
  };

  // First-run guests can go back to the landing page from the first step.
  const back = () => (index > 0 ? setIndex(i => i - 1) : navigate('/'));
  const canGoBack = index > 0 || (!settings.onboardingComplete && mode === 'local');
  const greetingName = firstName ?? (index > 0 ? normalizeFirstName(name) : null);
  const done = step === 'done';
  return (
    <main id="onboarding" className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10 sm:justify-center">
      <img src="/logo.png" alt="InOffice logo" className="mb-8 size-12" />
      {!done && (
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: questionCount }, (_, i) => (
              <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= index ? 'bg-primary' : 'bg-foreground/10')} />
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">Step {index + 1} of {questionCount}</p>
        </div>
      )}
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
        {done ? `You’re all set${greetingName ? `, ${greetingName}` : ''}` : greetingName ? `Welcome to InOffice, ${greetingName}` : 'Welcome to InOffice'}
      </h1>
      <p className={cn('mt-3 text-base leading-7 text-muted-foreground', index > 0 && !done && 'sr-only')}>
        {done ? 'A little clarity for your hybrid working week.' : 'Keep track of your office days and know exactly what you need to hit your hybrid-work target.'}
      </p>
      <div className="mt-8">
          <form id="setupForm" onSubmit={submit} noValidate={step === 'name'}>
            <FieldGroup>
              {step === 'name' && (
                <>
                  <h2 className="text-lg font-semibold tracking-tight">What should we call you?</h2>
                  <Field data-invalid={nameError ? true : undefined}>
                    <FieldLabel htmlFor="firstName">First name</FieldLabel>
                    <Input
                      id="firstName"
                      name="firstName"
                      autoComplete="given-name"
                      autoFocus
                      maxLength={MAX_FIRST_NAME_LENGTH}
                      value={name}
                      aria-invalid={nameError ? true : undefined}
                      onChange={e => { setName(e.target.value); setNameError(null); }}
                    />
                    {nameError ? <FieldError>{nameError}</FieldError> : <FieldDescription>Only kept in this browser.</FieldDescription>}
                  </Field>
                </>
              )}
              {step === 'target' && (
                <>
                  <h2 className="text-lg font-semibold tracking-tight">How much time are you expected to spend in the office?</h2>
                  <TargetControls value={target} onChange={setTarget} />
                </>
              )}
              {step === 'region' && (
                <>
                  <RegionControl prominent value={draft.region} onChange={region => setDraft(d => ({ ...d, region }))} />
                  <FieldDescription>Bank holidays are excluded from your working days. You can change your calendar in Settings at any time.</FieldDescription>
                </>
              )}
              {done && (
                <dl className="divide-y rounded-2xl bg-card text-sm shadow-xs ring-1 ring-foreground/[0.07]">
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Target</dt><dd className="text-right font-medium">{targetDescription(draft)}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">Bank holidays</dt><dd className="text-right font-medium">{REGION_NAMES[draft.region]}</dd></div>
                </dl>
              )}
              <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                {canGoBack ? <Button type="button" variant="ghost" size="lg" onClick={back}>Back</Button> : <span className="hidden sm:block" />}
                <Button type="submit" size="lg" className="sm:min-w-32">{done ? 'Open InOffice' : step === 'region' ? 'Finish setup' : 'Continue'}</Button>
              </div>
            </FieldGroup>
          </form>
      </div>
      <p className="mt-8 text-xs leading-5 text-muted-foreground">{mode === 'account' ? 'Your attendance is saved to your account.' : 'Your attendance stays in this browser. No account needed.'}</p>
      {settings.onboardingComplete && (
        <Button variant="link" className="mt-2 self-start px-0" onClick={finish}>Cancel setup</Button>
      )}
    </main>
  );
}
