
// src/lib/wakeLock.ts

let wakeLock: WakeLockSentinel | null = null;

/**
 * Attempts to acquire a screen wake lock to prevent the device from sleeping.
 * This is critical for long-running clustering tasks.
 */
const requestWakeLock = async () => {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock was released');
      });
      console.log('Screen Wake Lock is active');
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  }
};

/**
 * Sets up listeners to automatically request and release the wake lock
 * when the page visibility changes.
 * @returns A cleanup function to remove the event listeners.
 */
export function setupWakeLockListener(): () => void {
  const handleVisibilityChange = async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      await requestWakeLock();
    }
  };

  // Request the lock immediately
  requestWakeLock();

  // Add listener to re-acquire the lock when returning to the tab
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return a cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (wakeLock !== null) {
      wakeLock.release();
      wakeLock = null;
    }
  };
}
