// Compatibility entry point: no implicit external directory.
console.warn('preprocess is an alias for data:update. GIS import requires --source <directory>.');
await import('./update.mjs');
