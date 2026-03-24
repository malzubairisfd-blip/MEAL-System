// This worker has been deprecated and its logic moved to /src/lib/confirmationchildcmam-export.ts
// The page component now calls the library function directly.
self.onmessage = () => {
  self.postMessage({ type: 'error', error: 'This worker is deprecated.' });
};
