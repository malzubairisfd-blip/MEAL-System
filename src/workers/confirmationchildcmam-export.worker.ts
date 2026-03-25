// This worker has been deprecated and its logic moved to /src/lib/confirmationchildcmam-export.ts
// The page component now calls the library function directly, which in turn calls a server-side API route.
self.onmessage = () => {
  self.postMessage({ type: 'error', error: 'This worker is deprecated.' });
};
