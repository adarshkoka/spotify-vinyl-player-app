/**
 * Haptic feedback helper for the record-player gestures.
 *
 * Wraps the Web Vibration API (the only broadly available haptic API on Android
 * browsers) behind a single guarded entry point so the support check and the
 * user's Haptics setting are honored in one place. iOS Safari has no Vibration
 * API, so this is a silent no-op there. Vibration patterns live in config.ts.
 */
export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Unsupported or blocked by the browser — ignore.
  }
}
