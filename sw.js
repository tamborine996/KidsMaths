const CACHE_NAME = 'kidsmaths-v57';
const BUILD_TIME = '2026-04-15 17:49';
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
    './data/urdu.json',
    './data/math-worlds.json',
    './manifest.json',
    './version.json',
    './assets/stories/alice-page-1-white-rabbit.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Bypass browser HTTP cache to get fresh files
                const requests = ASSETS.map(url =>
                    fetch(url, { cache: 'reload' }).then(res => cache.put(url, res))
                );
                return Promise.all(requests);
            })
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
    if (event.data?.type === 'GET_BUILD_INFO') {
        event.source.postMessage({
            type: 'BUILD_INFO',
            buildTime: BUILD_TIME,
            cacheName: CACHE_NAME
        });
    }
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request, { cache: 'no-cache' })
            .then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
