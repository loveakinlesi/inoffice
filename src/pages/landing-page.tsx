import { Link } from 'react-router';
import { cn } from '@/lib/utils.ts';
import { buttonVariants } from '@/components/ui/button.tsx';
import { SignInButton } from '@/components/account-menu.tsx';
import { useAuthConfig } from '@/lib/auth-client.ts';

/** First screen for someone new: continue with Google, or as a guest (setup then asks for a name). */
export function LandingPage() {
  const config = useAuthConfig();
  const google = config?.providers.google;

  return (
    <main id="landing" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <img src="/logo.png" alt="InOffice logo" className="mb-8 size-14" />
      <h1 className="text-4xl font-semibold tracking-tight">Welcome to InOffice</h1>
      <p className="mt-4 text-lg leading-7 text-muted-foreground">
        Plan your office days, log them as you go, and always know what you need to hit your hybrid-work target.
      </p>
      <div className="mt-10 flex flex-col gap-3">
        {google && <SignInButton label="Continue with Google" className="h-11 w-full bg-card text-base" />}
        <Link
          to="/onboarding"
          className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full text-base')}
        >
          Continue as guest
        </Link>
      </div>
      {google && (
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          Sign in to sync your attendance across devices. As a guest, it stays in this browser and you can sign in later.
        </p>
      )}
    </main>
  );
}
