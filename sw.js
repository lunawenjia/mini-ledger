const CACHE='mini-ledger-shell-v1';const SHELL=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',evt=>{evt.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',evt=>{evt.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',evt=>{if(evt.request.method!=='GET'||new URL(evt.request.url).origin!==location.origin)return;evt.respondWith(fetch(evt.request).then(res=>{let copy=res.clone();caches.open(CACHE).then(cache=>cache.put(evt.request,copy));return res}).catch(()=>caches.match(evt.request)))});
