const CACHE = "min-hjalp-v9";
const ASSETS = ["./","index.html","style.css","app.js","manifest.json"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached)
    )
  );
});


self.addEventListener("push", event => {
  let data = { title:"Min hjälp", body:"Du har en påminnelse." };
  try{
    if(event.data) data = {...data, ...event.data.json()};
  }catch(e){
    if(event.data) data.body = event.data.text();
  }

  const work = [];
  if("setAppBadge" in self.navigator && Number.isFinite(Number(data.badgeCount))){
    work.push(self.navigator.setAppBadge(Number(data.badgeCount)));
  }
  work.push(
    self.registration.showNotification(data.title || "Min hjälp", {
      body: data.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: data.url || "./"
    })
  );
  event.waitUntil(Promise.all(work));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data || "./";
  event.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then(list => {
      for(const client of list){
        if("focus" in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
