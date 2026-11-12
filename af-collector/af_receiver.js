/**
 * af_receiver.js — Content Script (localhost / AF Manager pages)
 *
 * 役割: background.js から chrome.runtime.sendMessage で受け取ったデータを
 *       window.postMessage でページ（DataTab.tsx）に転送するブリッジ。
 *       AF Manager が localhost のどのポートで動いていても動作する。
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'AF_PUSH') {
        window.postMessage({ type: 'AF_COLLECTOR_PUSH', payload: msg.payload }, '*');
        sendResponse({ ok: true });
        return false;
    }
    if (msg.type === 'AF_PING') {
        // background が AF Manager のタブかどうかを識別するための応答
        sendResponse({
            app: 'gbf-af-manager',
            apiVersion: 1,
            version: chrome.runtime.getManifest().version,
        });
        return false;
    }
    return false;
});
