// MyEvent — service worker : permet l'installation et l'ouverture de l'application sans connexion.
// Les données (Supabase) ne passent jamais par ici : elles restent gérées par l'application.
const VERSION = "myevent-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
const CDN = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // données et connexion : toujours en direct

  // Pages : d'abord le réseau (pour avoir la dernière version), sinon la copie enregistrée
  if (req.mode === "navigate") {
    // On n'enregistre que la vraie application (pas les petites pages d'événement e/… ni la page 404) ;
    // sans réseau, toute page (y compris un lien de billet e/<id>/#t-…) ouvre l'application enregistrée.
    const scope = new URL(self.registration.scope).pathname;
    const isApp = url.pathname === scope || url.pathname === scope + "index.html";
    e.respondWith(fetch(req).then((res) => { if (isApp && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); } return res; }).catch(() => caches.match("./index.html")));
    return;
  }

  // Fichiers de l'application et bibliothèques : copie enregistrée tout de suite, mise à jour en arrière-plan
  if (url.origin === location.origin || CDN.includes(url.hostname)) {
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
