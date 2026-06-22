// preload.js is used to safely expose APIs to the renderer process if needed in the future.
// By default, Rhythm runs standard web code and does not require custom Node.js APIs.
window.addEventListener('DOMContentLoaded', () => {
  console.log('Rhythm Desktop preload initialized.');
});
