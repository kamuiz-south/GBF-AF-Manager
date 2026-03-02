/**
 * af_receiver.js — Content Script (localhost / AF Manager pages)
 *
 * 役割: background.js から chrome.runtime.sendMessage で受け取ったデータを
 *       window.postMessage でページ（DataTab.tsx）に転送するブリッジ。
 *       AF Manager が localhost のどのポートで動いていても動作する。
 */

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AF_PUSH') {
        window.postMessage({ type: 'AF_COLLECTOR_PUSH', payload: msg.payload }, '*');
    }
    if (msg.type === 'AF_PING') {
        // background からの接続確認に応答
        return true;
    }
});
