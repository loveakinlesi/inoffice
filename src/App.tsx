import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app-shell.tsx';
import { InstallPrompt } from '@/components/install-prompt.tsx';
import { Onboarding, SetupProvider, useSetup } from '@/components/onboarding.tsx';
import { Toaster } from '@/components/ui/toast.tsx';
import { CalendarPage } from '@/pages/calendar-page.tsx';
import { OverviewPage } from '@/pages/overview-page.tsx';
import { SettingsPage } from '@/pages/settings-page.tsx';
import { initAnalytics } from '@/lib/analytics.ts';
import { AttendanceProvider, useAttendance } from '@/state/attendance.tsx';

function Screens() {
  const { settings } = useAttendance();
  const setup = useSetup();
  if (!settings.onboardingComplete || setup.open) return <Onboarding key={String(settings.onboardingComplete)} />;
  return (
    <Routes>
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
      <SetupProvider>
        <Toaster timeout={4000}>
          <Screens />
          <InstallPrompt />
        </Toaster>
      </SetupProvider>
    </AttendanceProvider>
  );
}
