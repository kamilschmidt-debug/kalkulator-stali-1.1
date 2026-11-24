"use strict";

const zakres = self.registration.scope;
const prefiks = `profile-stalowe:${zakres}:`;
const pamiec = `${prefiks}v1`;
const index = new URL("index.html", zakres).href;
const manifest = new URL("manifest.webmanifest", zakres).href;

self.addEventListener("install", zdarzenie => {
  zdarzenie.waitUntil((async () => {
    const cache = await caches.open(pamiec);
    await cache.addAll([index, manifest].map(
      adres => new Request(adres, { cache: "reload" })
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", zdarzenie => {
  zdarzenie.waitUntil((async () => {
    const nazwy = await caches.keys();
    await Promise.all(nazwy
      .filter(nazwa => nazwa.startsWith(prefiks) && nazwa !== pamiec)
      .map(nazwa => caches.delete(nazwa)));
    await self.clients.claim();
  })());
});

async function siecLubPamiec(zapytanie, klucz) {
  try {
    const odpowiedz = await fetch(zapytanie);
    if (odpowiedz.ok) {
      try {
        const cache = await caches.open(pamiec);
        await cache.put(klucz, odpowiedz.clone());
      } catch (blad) {
        console.warn("Nie udało się zaktualizować kopii offline:", blad);
      }
      return odpowiedz;
    }
    if (odpowiedz.status < 500) return odpowiedz;
  } catch {
    // Bez połączenia użyj ostatniej poprawnie zapisanej wersji.
  }

  const cache = await caches.open(pamiec);
  return (await cache.match(klucz)) || new Response(
    "Brak zapisanej kopii. Otwórz kalkulator z dostępem do internetu.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    }
  );
}

self.addEventListener("fetch", zdarzenie => {
  const zapytanie = zdarzenie.request;
  if (zapytanie.method !== "GET") return;

  const adres = new URL(zapytanie.url);
  adres.search = "";
  adres.hash = "";

  if (zapytanie.mode === "navigate" &&
      (adres.href === zakres || adres.href === index)) {
    zdarzenie.respondWith(siecLubPamiec(zapytanie, index));
  } else if (adres.href === manifest) {
    zdarzenie.respondWith(siecLubPamiec(zapytanie, manifest));
  }
});