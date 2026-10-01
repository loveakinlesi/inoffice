import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { SignInButton } from '@/components/account-menu.tsx';
import { useAuthConfig } from '@/lib/auth-client.ts';
import { MAX_FIRST_NAME_LENGTH, normalizeFirstName } from '@/lib/validation.ts';
import { useAttendance } from '@/state/attendance.tsx';

/** First screen for someone new: sign in with Google, or continue as a guest with just a first name. */
export function LandingPage() {
  const { saveProfile } = useAttendance();
  const config = useAuthConfig();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const continueAsGuest = (e: FormEvent) => {
    e.preventDefault();
    const firstName = normalizeFirstName(name);
    if (!firstName) { setError('Enter your first name to continue.'); return; }
    if (saveProfile({ firstName })) navigate('/onboarding');
  };

  return (
    <main id="landing" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <img src="/logo.png" alt="InOffice logo" className="mb-6 size-12" />
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to InOffice</h1>
      <p className="mt-3 text-base leading-6 text-muted-foreground">
        Keep track of your office days and know exactly what you need to hit your hybrid-work target.
      </p>
      <Card className="mt-8 shadow-card">
        <CardContent className="sm:p-4">
          <FieldGroup>
            {config?.providers.google && (
              <>
                <Field>
                  <SignInButton label="Continue with Google" className="w-full" />
                  <FieldDescription className="text-center">Sync your attendance across devices.</FieldDescription>
                </Field>
                <FieldSeparator>or</FieldSeparator>
              </>
            )}
            <form id="guestForm" onSubmit={continueAsGuest} noValidate>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="firstName">First name</FieldLabel>
                  <Input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    maxLength={MAX_FIRST_NAME_LENGTH}
                    value={name}
                    aria-invalid={error ? true : undefined}
                    onChange={e => { setName(e.target.value); setError(null); }}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Button type="submit" size="lg" variant={config?.providers.google ? 'outline' : 'default'}>Continue as guest</Button>
              </FieldGroup>
            </form>
          </FieldGroup>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        As a guest, your attendance stays in this browser. You can sign in later.
      </p>
    </main>
  );
}
