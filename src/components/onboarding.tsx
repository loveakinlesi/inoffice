import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent } from '@/components/ui/card.tsx';
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
    <main id="onboarding" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <img src="/logo.png" alt="InOffice logo" className="mb-6 size-12" />
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
        {done ? `You’re all set${greetingName ? `, ${greetingName}` : ''}` : greetingName ? `Welcome to InOffice, ${greetingName}` : 'Welcome to InOffice'}
      </h1>
      <p className="mt-3 text-base leading-6 text-muted-foreground">
        {done ? 'A little clarity for your hybrid working week.' : 'Keep track of your office days and know exactly what you need to hit your hybrid-work target.'}
      </p>
      <Card className="mt-8 shadow-card">
        <CardContent className="sm:p-4">
          {!done && <p className="mb-4 text-sm text-muted-foreground">Step {index + 1} of {questionCount}</p>}
          <form id="setupForm" onSubmit={submit} noValidate={step === 'name'}>
            <FieldGroup>
              {step === 'name' && (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">What should we call you?</h2>
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
                  <h2 className="text-xl font-semibold tracking-tight">How much time are you expected to spend in the office?</h2>
                  <TargetControls value={target} onChange={setTarget} />
                </>
              )}
              {step === 'region' && (
                <>
                  <RegionControl value={draft.region} onChange={region => setDraft(d => ({ ...d, region }))} />
                  <FieldDescription>Bank holidays are excluded from your working days. You can change your calendar in Settings at any time.</FieldDescription>
                </>
              )}
              {done && (
                <div className="flex flex-col gap-2">
                  <p className="text-xl font-semibold">Your target is {targetDescription(draft)}.</p>
                  <p className="text-sm text-muted-foreground">Bank holidays: {REGION_NAMES[draft.region]}.</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                {canGoBack ? <Button type="button" variant="outline" size="lg" onClick={back}>Back</Button> : <span />}
                <Button type="submit" size="lg">{done ? 'Open InOffice' : step === 'region' ? 'Finish setup' : 'Continue'}</Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">{mode === 'account' ? 'Your attendance is saved to your account.' : 'Your attendance stays in this browser. No account needed.'}</p>
      {settings.onboardingComplete && (
        <Button variant="outline" className="mx-auto mt-3" onClick={finish}>Cancel setup</Button>
      )}
    </main>
  );
}
