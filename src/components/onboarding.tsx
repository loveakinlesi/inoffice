import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { FieldDescription, FieldGroup } from '@/components/ui/field.tsx';
import { RegionControl, TargetControls, applyTargetDraft, targetDescription, toTargetDraft } from '@/components/target-controls.tsx';
import { REGION_NAMES } from '@/lib/constants.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

/** Setup steps at /onboarding: first run after the landing page, or rerun from Settings. */
export function Onboarding() {
  const { settings, saveSettings, firstName, mode } = useAttendance();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(settings);
  const [target, setTarget] = useState(() => toTargetDraft(settings));
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const finish = () => {
    navigate('/');
    requestAnimationFrame(() => document.getElementById('settingsLink')?.focus());
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) setDraft(d => applyTargetDraft(d, target));
    if (step < 3) { setStep(s => s + 1); return; }
    if (!saveSettings({ ...draft, onboardingComplete: true })) return;
    track('onboarding_completed');
    finish();
  };

  const done = step === 3;
  return (
    <main id="onboarding" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <img src="/logo.png" alt="InOffice logo" className="mb-6 size-12" />
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
        {done ? 'You’re all set' : firstName ? `Welcome to InOffice, ${firstName}` : 'Welcome to InOffice'}
      </h1>
      <p className="mt-3 text-base leading-6 text-muted-foreground">
        {done ? 'A little clarity for your hybrid working week.' : 'Keep track of your office days and know exactly what you need to hit your hybrid-work target.'}
      </p>
      <Card className="mt-8 shadow-card">
        <CardContent className="sm:p-4">
          {!done && <p className="mb-4 text-sm text-muted-foreground">Step {step} of 2</p>}
          <form id="setupForm" onSubmit={submit}>
            <FieldGroup>
              {step === 1 && (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">How much time are you expected to spend in the office?</h2>
                  <TargetControls value={target} onChange={setTarget} />
                </>
              )}
              {step === 2 && (
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
                {step > 1 ? <Button type="button" variant="outline" size="lg" onClick={() => setStep(s => s - 1)}>Back</Button> : <span />}
                <Button type="submit" size="lg">{done ? 'Open InOffice' : step === 2 ? 'Finish setup' : 'Continue'}</Button>
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
