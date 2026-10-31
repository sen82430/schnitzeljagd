// Minimaler Service Worker: macht die Seite installierbar, speichert nichts zwischen
// (alle Anfragen gehen normal ans Netz, so kommen Updates immer sofort an).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
