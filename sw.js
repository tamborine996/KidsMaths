const CACHE_NAME = 'kidsmaths-v4';
const BUILD_TIME = '2026-04-01 22:45';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/managers/StateManager.js',
    './js/managers/TimerManager.js',
    './js/managers/CoinManager.js',
    './js/managers/ProgressManager.js',
    './js/managers/ProblemGenerator.js',
    './js/components/VisualObjects.js',
    './js/components/Celebration.js',
    './js/components/Timer.js',
    './data/modules.json',
    './data/rewards.json',
    './data/stories.json',
    './data/library.json',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
         .then(() => {
             self.clients.matchAll().then(clients => {
                 clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
             });
         })
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'GET_BUILD_TIME') {
        event.source.postMessage({ type: 'BUILD_TIME', buildTime: BUILD_TIME });
    }
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
