
// This file is intended to be imported once in the main app layout or a high-level component.
// However, to control the worker instance, it's better to pass the worker to a function.

export function setupVisibilityHandler(getWorker: () => Worker | null) {
    const handler = () => {
        if (document.visibilityState === 'visible') {
            const worker = getWorker();
            worker?.postMessage({ type: 'resume' });
        }
    };
    
    document.addEventListener('visibilitychange', handler);

    // Return a cleanup function
    return () => {
        document.removeEventListener('visibilitychange', handler);
    };
}
