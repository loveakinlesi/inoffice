const allowed = new Set(['onboarding_completed','target_mode_selected','month_changed','attendance_status_changed','settings_opened','year_overview_opened','backup_exported','backup_imported']);
let analytics;
export async function initAnalytics() {
  if (!import.meta.env.PROD) return;
  try {
    analytics=await import('@vercel/analytics');
    analytics.inject({beforeSend:event=>({...event,url:window.location.origin+'/'})});
  } catch { /* Analytics is optional; attendance always works independently. */ }
}
export function track(name) {
  if (!allowed.has(name)) return;
  try { analytics?.track(name); } catch { /* Never interrupt a local action for telemetry. */ }
}
