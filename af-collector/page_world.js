/**
 * page_world.js
 * ページワールド（GBFのメインJSコンテキスト）で動作し、
 * rest/artifact/list/N のXHRレスポンスを傍受して
 * content_script.js へ postMessage で転送する。
 */

(function () {
    // 二重インストール防止
    if (window.__AF_COLLECTOR_INSTALLED__) return;
    window.__AF_COLLECTOR_INSTALLED__ = true;

    let collecting = false;

    // start/stop 指示を content_script から受け取る
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        if (e.data?.type === 'AF_COLLECTOR_SET_STATE') {
            collecting = e.data.collecting;
        }
    });

    // XHR フック
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        const match = String(url).match(/\/rest\/artifact\/list\/(\d+)/);
        if (match) {
            const page = parseInt(match[1], 10);
            this.addEventListener('load', function () {
                if (!collecting) return;
                try {
                    const data = JSON.parse(this.responseText);
                    window.postMessage(
                        { type: 'AF_COLLECTOR_DATA', page, data },
                        '*'
                    );
                } catch (_) { /* JSON parse error — ignore */ }
            });
        }
        return _open.call(this, method, url, ...rest);
    };

    // fetch フック（GBFが fetch を使う場合の保険）
    const _fetch = window.fetch;
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const match = String(url).match(/\/rest\/artifact\/list\/(\d+)/);
        const response = await _fetch.call(this, input, init);
        if (match && collecting) {
            const page = parseInt(match[1], 10);
            response.clone().json().then(data => {
                window.postMessage({ type: 'AF_COLLECTOR_DATA', page, data }, '*');
            }).catch(() => { });
        }
        return response;
    };
})();
