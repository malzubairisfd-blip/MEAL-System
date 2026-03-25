
// This worker is deprecated.
// The logic has been moved to /src/lib/confirmationchildcmam-export.ts
// The page component now generates the PDF in the browser using html2pdf.js.
self.onmessage = () => {
  self.postMessage({ type: 'error', error: 'This worker is deprecated.' });
};

    