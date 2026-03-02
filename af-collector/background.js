/**
 * background.js — Service Worker
 * 収集状態の管理、ページデータの蓄積、完了判定、ファイルダウンロードを担当。
 */

// ---------- 状態 ----------
let state = {
    collecting: false,
    total: null,           // lastフィールドから取得した総ページ数
    received: new Map(),   // page -> responseData
    filterWarning: false,  // フィルターあり警告中フラグ
    filterChecked: false,  // 初回フィルターチェック済みフラグ（以降は再チェックしない）
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
    };
}

function broadcastProgress() {
    const progress = getProgress();
    chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', progress }).catch(() => { });
    const label = state.total
        ? `${state.received.size}/${state.total}`
        : state.received.size > 0 ? `${state.received.size}` : '';
    chrome.action.setBadgeText({ text: label });
    chrome.action.setBadgeBackgroundColor({
        color: getProgress().complete ? '#10b981' : '#3b82f6'
    });
}

function resetState() {
    state = {
        collecting: false,
        total: null,
        received: new Map(),
        filterWarning: false,
        filterChecked: false,
    };
    chrome.action.setBadgeText({ text: '' });
}

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
        if (v !== undefined && v !== expected) return false;
    }
    for (const key of NUM_ZEROS) {
        const v = filter[key];
        if (v !== undefined && v !== 0) return false;
    }
    for (const key of EMPTY_ARR) {
        const v = filter[key];
        // undefined または空配列ならOK
        if (v !== undefined && (!Array.isArray(v) || v.length !== 0)) return false;
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
                    chrome.runtime.sendMessage({ type: 'FILTER_WARNING' }).catch(() => { });
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
                try {
                    const res = await fetch('http://127.0.0.1:1422/api/artifacts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (res.ok) {
                        sendResponse({ ok: true, mode: 'tauri' });
                        return;
                    }
                } catch (_) {
                    // Tauri アプリ未起動 → Phase 2 へフォールバック
                }

                // --- Phase 2: 同一ブラウザの AF Manager タブへ送信 ---
                const patterns = ['http://localhost:*/*', 'http://127.0.0.1:*/*', 'https://*.github.io/*'];
                let targetTab = null;
                for (const pattern of patterns) {
                    const tabs = await chrome.tabs.query({ url: pattern });
                    if (tabs.length > 0) { targetTab = tabs[0]; break; }
                }
                if (!targetTab) {
                    sendResponse({ ok: false, reason: 'AF Manager（アプリ/ブラウザ）が見つかりません。\nTauriアプリを起動するか、同ブラウザでAF Managerを開いてください。' });
                    return;
                }
                chrome.tabs.sendMessage(targetTab.id, { type: 'AF_PUSH', payload })
                    .then(() => sendResponse({ ok: true, mode: 'browser' }))
                    .catch(err => sendResponse({ ok: false, reason: err.message }));
            })();
            return true;
        }

        case 'START_COLLECTING': {
            state.collecting = true;
            state.total = null;
            state.received = new Map();
            state.filterWarning = false;
            state.filterChecked = false;
            chrome.action.setBadgeText({ text: '…' });
            chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
            notifyAllGBFTabs(true);
            sendResponse({ ok: true });
            break;
        }

        case 'STOP_COLLECTING': {
            state.collecting = false;
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
            state.collecting = true;
            chrome.action.setBadgeText({ text: '…' });
            chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
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
