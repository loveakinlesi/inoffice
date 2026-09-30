import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/app-shell.tsx';
import { Toaster } from '@/components/ui/toast.tsx';
import { CalendarPage } from '@/pages/calendar-page.tsx';
import { AttendanceProvider } from '@/state/attendance.tsx';

export default function App() {
  return (
    <AttendanceProvider>
      <Toaster timeout={4000}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<CalendarPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Toaster>
    </AttendanceProvider>
  );
}
