// This worker is deprecated.
// The logic has been moved to src/app/api/child-cmam-confirmation-export/route.ts
self.onmessage = () => {
  self.postMessage({ type: 'error', error: 'This worker is deprecated.' });
};
