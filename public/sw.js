
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('message', event => {
  if (event.data?.type === 'PROGRESS_NOTIFICATION') {
    const { percent, status } = event.data;

    self.registration.showNotification('Clustering in progress', {
      body: `${status} — ${percent}%`,
      tag: 'clustering-progress',
      renotify: true,
      silent: true
    });
  }

  if (event.data?.type === 'DONE_NOTIFICATION') {
    self.registration.showNotification('Clustering completed', {
      body: 'Processing finished successfully',
      silent: false
    });
  }
});
