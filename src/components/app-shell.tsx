import { Link, NavLink, Outlet } from 'react-router';
import { BarChart3Icon, CalendarIcon, SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { buttonVariants } from '@/components/ui/button.tsx';
import { track } from '@/lib/analytics.ts';
import { AccountMenu } from '@/components/account-menu.tsx';
import { OfflineBanner } from '@/components/account-status.tsx';
import { InstallPrompt } from '@/components/install-prompt.tsx';
import { useAttendance } from '@/state/attendance.tsx';

const TABS = [
  { to: '/', label: 'Calendar', icon: CalendarIcon },
  { to: '/overview', label: 'Overview', icon: BarChart3Icon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3 rounded-xl">
          <img src="/logo.png" alt="" className="size-10 shrink-0 rounded-xl object-cover shadow-sm" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">InOffice</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">Plan and track your hybrid office days.</p>
          </div>
        </Link>
        <div className="header-actions flex items-center gap-2">
        
          <NavLink
            id="overviewBtn"
            to="/overview"
            onClick={() => track('year_overview_opened')}
            className={({ isActive }) => cn(buttonVariants({ variant: 'outline' }), 'hidden sm:inline-flex', isActive && 'bg-muted')}
          >
            Year overview
          </NavLink>
          <NavLink
            id="settingsLink"
            to="/settings"
            aria-label="Open settings"
            onClick={() => track('settings_opened')}
            className={({ isActive }) => cn(buttonVariants({ variant: 'outline', size: 'icon' }), isActive && 'bg-muted')}
          >
            <SettingsIcon />
          </NavLink>
            <AccountMenu />
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  return (
    <nav className="ios-tabbar" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end className="ios-tabbar-link">
          <Icon className="size-5" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { storageError } = useAttendance();
  return (
    <div id="app" className="app-shell min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only">Skip to dashboard</a>
      <Header />
      <main id="main" className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        <OfflineBanner />
        <InstallPrompt />
        <Outlet />
      </main>
      <TabBar />
      {storageError && (
        <p id="storageError" role="alert" className="fixed inset-x-4 bottom-4 z-80 rounded-xl bg-destructive/10 p-4 text-destructive ring-1 ring-destructive/20 backdrop-blur-xl">{storageError}</p>
      )}
    </div>
  );
}
