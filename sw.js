const CACHE_NAME = "absensi-ec-v2";
const APP_SHELL = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jangan pernah cache request ke Google Sheets / Apps Script — absen harus selalu data terbaru.
  if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com")) {
    return;
  }

  const isAppShellHtml = event.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/");

  if (isAppShellHtml) {
    // index.html: NETWORK-FIRST. Ini file yang paling sering diupdate (fitur baru, bug fix),
    // jadi begitu ada internet, selalu ambil versi terbaru dulu — jangan sampai orang buka app
    // dan masih lihat versi lama padahal filenya udah diganti di hosting. Cache cuma jadi
    // cadangan kalau lagi offline.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset statis (icon, manifest, dll): cache-first biar buka instan — ini jarang berubah.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
