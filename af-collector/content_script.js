/**
 * content_script.js
 * 分離ワールド（Isolated World）で動作。
 * 1. page_world.js をページコンテキストに注入する
 * 2. ページワールドから来たデータを background.js へ転送する
 * 3. background.js からの start/stop 指示をページワールドへ中継する
 */

// page_world.js をメインワールドに注入
const script = document.createElement('script');
script.src = chrome.runtime.getURL('page_world.js');
document.documentElement.appendChild(script);
script.remove();

// ページワールド → background へデータ転送
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'AF_COLLECTOR_DATA') {
        chrome.runtime.sendMessage({
            type: 'PAGE_DATA',
            page: event.data.page,
            data: event.data.data,
        });
    }
});

// background → ページワールドへ start/stop 状態を中継
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SET_COLLECTING') {
        window.postMessage({ type: 'AF_COLLECTOR_SET_STATE', collecting: msg.collecting }, '*');
    }
});
