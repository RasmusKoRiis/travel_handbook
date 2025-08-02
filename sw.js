self.addEventListener('install', e=>self.skipWaiting());
self.addEventListener('activate', e=>self.clients.claim());

const cacheName = 'guide-v1';
const core = [
  '/', '/index.html', '/style.css', '/script.js',
  '/codes.json', '/data/hongkong.json', '/data/tokyo.json', '/data/oslo.json'
];

self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.open(cacheName).then(c=>c.match(e.request).then(r=>{
      return r || fetch(e.request).then(res=>{
        if (e.request.url.match(/\.json$/)) c.put(e.request, res.clone());
        return res;
      });
    }))
  );
});
