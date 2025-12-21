
let wakeLock: any = null;

export async function enableWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await (navigator as any).wakeLock.request('screen');
    }
  } catch {}
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await enableWakeLock();
  }
});
