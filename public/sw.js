// Service Worker for background notifications

// On install, activate immediately
self.addEventListener('install', () => self.skipWaiting());

// On activation, take control of all clients
self.addEventListener('activate', () => self.clients.claim());

// Listen for messages from the main thread
self.addEventListener('message', e => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'PROGRESS_NOTIFICATION') {
    self.registration.showNotification('Clustering in progress...', {
      body: `Status: ${data.status} (${data.percent}%)`,
      tag: 'clustering-progress', // An ID for the notification
      renotify: true,             // Re-notify even if a notification with the same tag exists
      silent: true                // No sound or vibration
    });
  }

  if (data.type === 'DONE_NOTIFICATION') {
    self.registration.showNotification('Clustering Completed', {
      body: 'The data processing has finished successfully. You can now review the results.',
      tag: 'clustering-done',
      renotify: true,
      silent: false
    });
  }
});
