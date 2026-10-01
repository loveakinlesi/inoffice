import { useState } from 'react';
import { LogOutIcon } from 'lucide-react';
import { GoogleIcon } from '@/components/google-icon.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { signInWithGoogle, signOut, useAuthConfig, useSession } from '@/lib/auth-client.ts';

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';

export function SignInButton({ className, label = 'Sign in', size = 'lg' }: { className?: string; label?: string; size?: 'lg' | 'default' }) {
  const [pending, setPending] = useState(false);
  const start = async () => {
    setPending(true);
    try { await signInWithGoogle(); } catch (error) { toast.add({ title: (error as Error).message }); setPending(false); }
    // On success the browser navigates to Google, so leave the button pending.
  };
  return (
    <Button variant="outline" size={size} className={className} disabled={pending} onClick={start}>
      {pending ? <Spinner data-icon="inline-start" /> : <GoogleIcon data-icon="inline-start" />}
      {label}
    </Button>
  );
}

export async function signOutAndNotify() {
  const { error } = await signOut();
  toast.add({ title: error ? 'Could not sign out. Check your connection and try again.' : 'Signed out' });
}

/** Header control: sign-in button for guests (when a provider is configured), avatar menu when signed in. */
export function AccountMenu() {
  const config = useAuthConfig();
  const { data: session, isPending } = useSession();
  if (isPending || !config) return null;
  if (!session) return config.providers.google ? <SignInButton size="default" /> : null;

  const { name, email, image } = session.user;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full" />}>
        <Avatar>
          {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">{name}</span>
            <span className="block truncate text-xs font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void signOutAndNotify()}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
