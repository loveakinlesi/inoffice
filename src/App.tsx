import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app-shell.tsx';
import { InstallPrompt } from '@/components/install-prompt.tsx';
import { Onboarding } from '@/components/onboarding.tsx';
import { Toaster } from '@/components/ui/toast.tsx';
import { AccountLoading } from '@/components/account-status.tsx';
import { ImportPrompt, useShouldOfferImport } from '@/components/import-prompt.tsx';
import { CalendarPage } from '@/pages/calendar-page.tsx';
import { LandingPage } from '@/pages/landing-page.tsx';
import { OverviewPage } from '@/pages/overview-page.tsx';
import { SettingsPage } from '@/pages/settings-page.tsx';
import { initAnalytics } from '@/lib/analytics.ts';
import { AttendanceProvider, useAttendance } from '@/state/attendance.tsx';

function Screens() {
  const { settings, accountStatus, mode } = useAttendance();
  const importOffer = useShouldOfferImport();
  // Wait for account data before deciding whether setup is needed, so it never flashes.
  if (accountStatus === 'loading' || accountStatus === 'error') return <AccountLoading />;
  // Offer this browser's guest data to a newly signed-in account before anything else.
  if (importOffer.offer) return <ImportPrompt onDecided={importOffer.decide} />;

  if (!settings.onboardingComplete) {
    // New here: the landing page offers Google or guest, then setup runs at /onboarding.
    // Signed-in users already chose, so they go straight to setup.
    return (
      <Routes>
        <Route index element={mode === 'account' ? <Navigate to="/onboarding" replace /> : <LandingPage />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<AppShell />}>
        <Route index element={<CalendarPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  useEffect(() => { void initAnalytics(); }, []);
  return (
    <AttendanceProvider>
      <Toaster timeout={4000}>
        <Screens />
        <InstallPrompt />
      </Toaster>
    </AttendanceProvider>
  );
}
