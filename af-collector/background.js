/**
 * background.js — Service Worker
 * 収集状態の管理、ページデータの蓄積、完了判定、ファイルダウンロードを担当。
 */

const APP_IDENTIFIER = 'gbf-af-manager';
const APP_API_VERSION = 1;
const DEFAULT_APP_PORT = 1422;
const APP_PORT_RANGE_END = 1432;
const APP_CONNECTION_CACHE_KEY = 'af_app_connection';
const APP_CONNECTION_CACHE_MS = 5 * 60 * 1000;
const APP_DISCOVERY_TIMEOUT_MS = 350;

// ---------- 状態 ----------
let state = {
    collecting: false,
    total: null,           // lastフィールドから取得した総ページ数
    received: new Map(),   // page -> responseData
    filterWarning: false,  // フィルターあり警告中フラグ
    filterChecked: false,  // 初回フィルターチェック済みフラグ（以降は再チェックしない）
    lastFilter: null,      // 警告時のフィルター情報を保持（デバッグ用）
};

// ---------- ユーティリティ ----------
function getProgress() {
    return {
        collecting: state.collecting,
        total: state.total,
        receivedCount: state.received.size,
        receivedPages: [...state.received.keys()].sort((a, b) => a - b),
        complete: state.total !== null && state.received.size >= state.total,
        filterWarning: state.filterWarning,
        lastFilter: state.lastFilter,
    };
}

function broadcastProgress() {
    const progress = getProgress();
    chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', progress }).catch(() => { });
    const label = state.total
        ? `${Math.min(100, Math.floor((state.received.size / state.total) * 100))}%`
        : state.received.size > 0 ? `${state.received.size}` : '';
    chrome.action.setBadgeText({ text: label });
    chrome.action.setBadgeBackgroundColor({
        color: getProgress().complete ? '#10b981' : '#3b82f6'
    });
}

async function resetState() {
    state = {
        collecting: false,
        total: null,
        received: new Map(),
        filterWarning: false,
        filterChecked: false,
        lastFilter: null,
    };
    chrome.action.setBadgeText({ text: '' });
    await saveState();
}

// ---------- 永続化 ----------
async function saveState() {
    const data = {
        collecting: state.collecting,
        total: state.total,
        received: Object.fromEntries(state.received),
        filterWarning: state.filterWarning,
        filterChecked: state.filterChecked,
        lastFilter: state.lastFilter,
    };
    await chrome.storage.local.set({ af_state: data });
}

async function loadState() {
    const res = await chrome.storage.local.get('af_state');
    if (res.af_state) {
        const s = res.af_state;
        state.collecting = s.collecting;
        state.total = s.total;
        state.received = new Map(
            Object.entries(s.received || {})
                .map(([k, v]) => [parseInt(k, 10), v])
        );
        state.filterWarning = s.filterWarning;
        state.filterChecked = s.filterChecked;
        state.lastFilter = s.lastFilter;
        broadcastProgress();
    }
}

// 起動時に読み込み
loadState();

// ---------- 全タブへの収集ON/OFF通知 ----------
async function notifyAllGBFTabs(collecting) {
    const tabs = await chrome.tabs.query({ url: 'https://game.granbluefantasy.jp/*' });
    for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'SET_COLLECTING', collecting }).catch(() => { });
    }
}

// ---------- フィルター検出 ----------
function isFilterClear(filter) {
    if (!filter || typeof filter !== 'object') return true;
    // キーが存在しない（undefined）場合はデフォルト値とみなしてOK
    const STR_ZEROS = { 6: '000000', 8: '0000000000' };
    const NUM_ZEROS = [25, 26, 39, 40, 47, 48, 49, 50, 62, 63];
    const EMPTY_ARR = [59, 60, 61];

    for (const [key, expected] of Object.entries(STR_ZEROS)) {
        const v = filter[key];
        if (v !== undefined && v !== expected) {
            console.warn(`[FilterCheck] Key ${key} mismatch: expected "${expected}", got "${v}"`);
            return false;
        }
    }
    for (const key of NUM_ZEROS) {
        const v = filter[key];
        // 数値の 0 または 文字列の "0" ならOKとみなす（GBFのAPIレスポンスの揺れに対応）
        if (v !== undefined && v !== 0 && v !== '0') {
            console.warn(`[FilterCheck] Key ${key} mismatch: expected 0 or "0", got ${v}`);
            return false;
        }
    }
    for (const key of EMPTY_ARR) {
        const v = filter[key];
        // undefined または空配列ならOK
        if (v !== undefined && (!Array.isArray(v) || v.length !== 0)) {
            console.warn(`[FilterCheck] Key ${key} mismatch: expected [], got ${JSON.stringify(v)}`);
            return false;
        }
    }
    return true;
}

// ---------- ダウンロード ----------
function buildExportJson() {
    const seen = new Set();
    const allArtifacts = [];

    const sorted = [...state.received.entries()].sort(([a], [b]) => a - b);
    for (const [page, pageData] of sorted) {
        const list = pageData.list || pageData;
        if (!Array.isArray(list)) continue;
        list.forEach((item, pos) => {
            const instanceId = item.id;
            if (seen.has(instanceId)) return;
            seen.add(instanceId);
            allArtifacts.push({ ...item, _page: page, _pos: pos });
        });
    }

    return {
        af_collector: true,
        version: '1.0',
        collected_at: new Date().toISOString(),
        total_pages: state.total,
        artifact_count: allArtifacts.length,
        artifacts: allArtifacts,
    };
}

async function downloadData() {
    const json = JSON.stringify(buildExportJson(), null, 2);
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const date = new Date().toISOString().split('T')[0];
    await chrome.downloads.download({ url, filename: `af_data_${date}.json`, saveAs: false });
}

// ---------- AF Manager 接続先の検出 ----------
async function getConnectionSettings() {
    const stored = await chrome.storage.local.get({
        afConnectionMode: 'auto',
        afFixedPort: DEFAULT_APP_PORT,
    });
    const fixedPort = Number(stored.afFixedPort);
    return {
        mode: stored.afConnectionMode === 'fixed' ? 'fixed' : 'auto',
        fixedPort: Number.isInteger(fixedPort) && fixedPort >= 1024 && fixedPort <= 65535
            ? fixedPort
            : DEFAULT_APP_PORT,
    };
}

async function readCachedAppConnection() {
    const stored = await chrome.storage.local.get(APP_CONNECTION_CACHE_KEY);
    const cached = stored[APP_CONNECTION_CACHE_KEY];
    if (!cached || !Number.isInteger(cached.port) || Date.now() - (cached.checkedAt || 0) > APP_CONNECTION_CACHE_MS) {
        return null;
    }
    return cached;
}

async function writeCachedAppConnection(info) {
    await chrome.storage.local.set({
        [APP_CONNECTION_CACHE_KEY]: { ...info, checkedAt: Date.now() },
    });
}

async function clearCachedAppConnection() {
    await chrome.storage.local.remove(APP_CONNECTION_CACHE_KEY);
}

async function pingAppPort(port) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APP_DISCOVERY_TIMEOUT_MS);
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const info = await res.json();
        if (info?.app !== APP_IDENTIFIER || typeof info.apiVersion !== 'number' || info.apiVersion < APP_API_VERSION) {
            return null;
        }
        return { ...info, port: Number(info.port) || port };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function discoverAppConnection() {
    const cached = await readCachedAppConnection();
    if (cached) {
        const verified = await pingAppPort(cached.port);
        if (verified) {
            await writeCachedAppConnection(verified);
            return verified;
        }
        await clearCachedAppConnection();
    }

    const { mode, fixedPort } = await getConnectionSettings();
    const ports = [];
    if (mode === 'fixed') {
        ports.push(fixedPort);
    } else {
        for (let port = DEFAULT_APP_PORT; port <= APP_PORT_RANGE_END; port++) {
            ports.push(port);
        }
    }

    for (const port of ports) {
        const info = await pingAppPort(port);
        if (info) {
            await writeCachedAppConnection(info);
            return info;
        }
    }
    return null;
}

async function postArtifactsToPort(port, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/artifacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function sendToBrowserTab(payload) {
    const patterns = ['http://localhost:*/*', 'http://127.0.0.1:*/*', 'https://*.github.io/*'];
    const seen = new Set();
    const candidates = [];

    for (const pattern of patterns) {
        const tabs = await chrome.tabs.query({ url: pattern });
        for (const tab of tabs) {
            if (!tab.id || seen.has(tab.id)) continue;
            seen.add(tab.id);
            candidates.push(tab);
        }
    }

    for (const tab of candidates) {
        try {
            // 旧版のように最初のlocalhostタブへ送るのではなく、
            // AF Manager自身の識別応答を確認してから送信する。
            const info = await chrome.tabs.sendMessage(tab.id, { type: 'AF_PING' });
            if (info?.app !== APP_IDENTIFIER) continue;
            await chrome.tabs.sendMessage(tab.id, { type: 'AF_PUSH', payload });
            return true;
        } catch {
            // コンテンツスクリプト未注入・対象外ページなど
        }
    }

    // 拡張機能更新直後などでAF_PINGに未対応の旧コンテンツスクリプトが
    // 残っている場合、候補が1つだけなら従来どおり送信する。
    if (candidates.length === 1) {
        try {
            await chrome.tabs.sendMessage(candidates[0].id, { type: 'AF_PUSH', payload });
            return true;
        } catch {
            // 送信先なし
        }
    }
    return false;
}

// ---------- メッセージハンドラ ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {

        case 'PAGE_DATA': {
            if (!state.collecting) break;
            const { page, data } = msg;

            // last フィールドを最初に受け取った時点で記録
            if (state.total === null && data.last) {
                state.total = data.last;
            }

            // ---- フィルターチェック（初回クリーンレスポンスを確認するまで） ----
            if (!state.filterChecked) {
                const filter = data.options?.filter;
                if (!isFilterClear(filter)) {
                    // 压停せず、警告フラグのみを立てる
                    state.filterWarning = true;
                    state.lastFilter = filter;
                    chrome.runtime.sendMessage({ type: 'FILTER_WARNING', filterData: filter }).catch(() => { });
                    chrome.action.setBadgeText({ text: '!' });
                    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
                    // filterChecked は false のまま継続（次のクリーンレスポンスでリセットされる）
                } else {
                    // フィルターなしを確認 → 以後チェック不要
                    state.filterChecked = true;
                    if (state.filterWarning) {
                        // それまでの警告は誤検出だった可能性が高いので解除
                        state.filterWarning = false;
                        chrome.runtime.sendMessage({ type: 'FILTER_CLEARED' }).catch(() => { });
                    }
                }
            }

            // 重複は上書き
            state.received.set(page, data);
            saveState(); // 非同期で保存
            broadcastProgress();

            // 全ページ揃ったら完了処理
            if (getProgress().complete) {
                state.collecting = false;
                notifyAllGBFTabs(false);
                // autoDl 設定を確認してからDL
                chrome.storage.local.get({ autoDl: true }, ({ autoDl }) => {
                    if (autoDl) downloadData();
                    broadcastProgress();
                });
            }
            break;
        }

        case 'SEND_TO_APP': {
            (async () => {
                const payload = buildExportJson();

                // --- Phase 3: Tauri デスクトップアプリへ POST ---
                // 新アプリは /api/ping で実際の待受ポートを公開する。
                let connection = await discoverAppConnection();
                if (connection && await postArtifactsToPort(connection.port, payload)) {
                    sendResponse({ ok: true, mode: 'tauri', port: connection.port });
                    return;
                }

                // ポート変更後の初回送信などでキャッシュが古い場合は再探索
                if (connection) {
                    await clearCachedAppConnection();
                    connection = await discoverAppConnection();
                    if (connection && await postArtifactsToPort(connection.port, payload)) {
                        sendResponse({ ok: true, mode: 'tauri', port: connection.port });
                        return;
                    }
                }

                // --- 旧アプリ互換: /api/ping を持たない1422固定版 ---
                if (await postArtifactsToPort(DEFAULT_APP_PORT, payload)) {
                    sendResponse({ ok: true, mode: 'tauri-legacy', port: DEFAULT_APP_PORT });
                    return;
                }

                // --- Phase 2: 同一ブラウザの AF Manager タブへ送信 ---
                if (await sendToBrowserTab(payload)) {
                    sendResponse({ ok: true, mode: 'browser' });
                    return;
                }

                sendResponse({ ok: false, reason: 'AF Manager（アプリ/ブラウザ）が見つかりません。\nTauriアプリを起動するか、同ブラウザでAF Managerを開いてください。' });
            })();
            return true;
        }

        case 'START_COLLECTING': {
            state.collecting = true;
            saveState();
            notifyAllGBFTabs(true);
            broadcastProgress();
            sendResponse({ ok: true });
            break;
        }

        case 'STOP_COLLECTING': {
            state.collecting = false;
            saveState();
            notifyAllGBFTabs(false);
            broadcastProgress();
            break;
        }

        case 'DOWNLOAD_NOW': {
            downloadData().then(() => sendResponse({ ok: true }));
            return true;
        }

        case 'FILTER_CONFIRM': {
            // 「このまま続行」→ フィルターあり承認済みとして以後チェックしない
            state.filterWarning = false;
            state.filterChecked = true;   // ← 以後フィルターチェックをスキップ
            state.lastFilter = null;
            state.collecting = true;
            chrome.action.setBadgeText({ text: '…' });
            chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
            saveState();
            notifyAllGBFTabs(true);
            broadcastProgress();          // ← popup を即座に更新
            break;
        }

        case 'RESET': {
            notifyAllGBFTabs(false);
            resetState();
            broadcastProgress();
            break;
        }

        case 'GET_AUTO_DL': {
            chrome.storage.local.get({ autoDl: true }, ({ autoDl }) => sendResponse({ autoDl }));
            return true;
        }

        case 'SET_AUTO_DL': {
            chrome.storage.local.set({ autoDl: msg.value });
            break;
        }

        case 'GET_PROGRESS': {
            sendResponse(getProgress());
            break;
        }
    }
});
