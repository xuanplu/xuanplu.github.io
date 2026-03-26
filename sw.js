// ==========================================
// 拾绪 (基础版) PWA Service Worker
// ==========================================

// 每次发布新版本静态资源时，请修改这里的版本号 (如 v1.0.1)
const CACHE_NAME = 'shixu-basic-cache-v3.0.1'; 

// 基础版极其轻量，只有 4 个核心资源
const ASSETS_TO_CACHE = [
    './', 
    './manifest.json',
    './shixu.png',
    'https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js'
];

self.addEventListener('install', (event) => {
    // 强制跳过等待状态，立刻安装新版本
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] 正在写入底层缓存...');
            for (let url of ASSETS_TO_CACHE) {
                try {
                    await cache.add(url);
                } catch (e) {
                    console.warn(`[SW] 预缓存失败 (不影响核心): ${url}`);
                }
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    // 立即接管所有页面
    event.waitUntil(self.clients.claim());
    // 清理旧版本的缓存垃圾
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('shixu-basic-cache-')) {
                        console.log('[SW] 销毁旧版本缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    // 策略 A：对于 HTML 页面，采用 Network-First (网络优先)
    if (event.request.mode === 'navigate' || requestUrl.pathname === '/') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // 策略 B：对于静态资源 (JS, 图片)，采用 Cache-First (缓存优先)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                console.error('[SW] 资源抓取失败，离线状态:', event.request.url);
            });
        })
    );
});