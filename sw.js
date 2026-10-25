const CACHE = "dudu-remedios-v14";
const FILES = [
  ".",
  "index.html",
  "styles.css",
  "main.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "img/bubu_triste.png",
  "img/bubu_neutra.png",
  "img/bubu_feliz.png",
  "img/bubu_comemorando.png",
  "img/shiba_sentado.png",
  "img/shiba_lingua.png",
  "img/shiba_rindo.png",
  "img/shiba_deitado.png",
  "img/shiba_sentado_triste.png",
  "img/shiba_deitado_triste.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith("http")) return;
  e.respondWith(
    caches
      .match(e.request)
      .then(
        (cached) =>
          cached ||
          fetch(e.request).catch(() =>
            e.request.mode === "navigate"
              ? caches.match("index.html")
              : undefined,
          ),
      ),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((cs) => {
        if (cs.length > 0) return cs[0].focus();
        return self.clients.openWindow(".");
      }),
  );
});
