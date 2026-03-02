/**
 * popup.js
 * ポップアップUIのロジック。background.js と通信して
 * 収集状態を表示・操作する。
 */

// Apply translations to data-i18n elements
document.querySelectorAll('[data-i18n]').forEach(el => {
    const minput = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (minput) el.innerHTML = minput;
});

const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const pagesLabel = document.getElementById('pagesLabel');
const pagesMissing = document.getElementById('pagesMissing');
const completeBanner = document.getElementById('completeBanner');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnDl = document.getElementById('btnDl');
const btnSend = document.getElementById('btnSend');
const btnReset = document.getElementById('btnReset');
const btnGbf = document.getElementById('btnGbf');
const chkAutoDl = document.getElementById('chkAutoDl');
const sendStatus = document.getElementById('sendStatus');

// ---------- UI更新 ----------
function render(p) {
    const { collecting, total, receivedCount, receivedPages, complete } = p;

    // ドット
    dot.className = 'dot' + (complete ? ' done' : collecting ? ' active' : '');

    if (complete) {
        statusText.textContent = chrome.i18n.getMessage('statusComplete');
        pagesLabel.textContent = `${receivedCount} / ${total}`;
        progressWrap.style.display = 'block';
        progressBar.style.width = '100%';
        completeBanner.style.display = 'block';
        pagesMissing.textContent = '';
        btnStart.style.display = 'none';
        btnStop.style.display = 'none';
        btnDl.style.display = '';
    } else if (collecting) {
        statusText.textContent = chrome.i18n.getMessage('statusCollecting');
        pagesLabel.textContent = total
            ? `${receivedCount} / ${total}`
            : receivedCount > 0 ? `${receivedCount} ...` : chrome.i18n.getMessage('statusWaiting');
        progressWrap.style.display = total ? 'block' : 'none';
        if (total) progressBar.style.width = `${Math.min(100, receivedCount / total * 100)}%`;
        completeBanner.style.display = 'none';
        btnStart.style.display = 'none';
        btnStop.style.display = '';
        btnDl.style.display = 'none';

        // 欠けているページ
        if (total && receivedCount > 0) {
            const all = Array.from({ length: total }, (_, i) => i + 1);
            const missing = all.filter(p => !receivedPages.includes(p));
            pagesMissing.textContent = missing.length
                ? chrome.i18n.getMessage('pagesMissing', [`${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' …' : ''}`])
                : '';
        } else {
            pagesMissing.textContent = '';
        }
    } else {
        // idle
        if (receivedCount > 0 && !complete) {
            statusText.textContent = chrome.i18n.getMessage('statusStopped');
            pagesLabel.textContent = total ? `${receivedCount} / ${total}` : `${receivedCount}`;
            progressWrap.style.display = total ? 'block' : 'none';
            if (total) progressBar.style.width = `${Math.min(100, receivedCount / total * 100)}%`;
            btnDl.style.display = '';
        } else {
            statusText.textContent = chrome.i18n.getMessage('statusWaiting');
            pagesLabel.textContent = '';
            progressWrap.style.display = 'none';
            btnDl.style.display = 'none';
        }
        completeBanner.style.display = 'none';
        btnStart.style.display = '';
        btnStop.style.display = 'none';
        pagesMissing.textContent = '';
    }
    // 小送信ボタン：完了または途中データありのとき
    btnSend.style.display = (complete || receivedCount > 0) ? '' : 'none';
}

// ---------- 初期状態の取得 ----------
chrome.runtime.sendMessage({ type: 'GET_PROGRESS' }, (p) => {
    if (p) {
        render(p);
        if (p.filterWarning) showFilterWarning();
    }
});

// ---------- リアルタイム更新 ----------
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PROGRESS_UPDATE') render(msg.progress);
    if (msg.type === 'FILTER_WARNING') showFilterWarning();
});

// ---------- フィルター警告バナー ----------
function showFilterWarning() {
    if (document.getElementById('filterWarnBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'filterWarnBanner';
    banner.style.cssText = [
        'background:rgba(245,158,11,0.12)',
        'border:1px solid rgba(245,158,11,0.4)',
        'border-radius:8px',
        'padding:0.6rem 1rem',
        'margin-bottom:0.8rem',
        'font-size:0.82rem',
        'line-height:1.6',
        'color:#fbbf24',
        'display:flex',
        'align-items:flex-start',
        'gap:0.4rem',
    ].join(';');

    banner.innerHTML = `
        <span style="flex-shrink:0">⚠️</span>
        <span>
            ${chrome.i18n.getMessage('filterWarnTitle')}<br>
            <span style="color:#94a3b8;font-size:0.78rem">${chrome.i18n.getMessage('filterWarnDesc')}</span>
        </span>
        <button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;font-size:1rem;padding:0;flex-shrink:0">✕</button>
    `;

    document.getElementById('statusBox').before(banner);
}

// ---------- ボタン操作 ----------
btnStart.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'START_COLLECTING' });
    render({ collecting: true, total: null, receivedCount: 0, receivedPages: [], complete: false });
});

btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_COLLECTING' });
});

btnDl.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_NOW' });
});

btnSend.addEventListener('click', () => {
    sendStatus.textContent = chrome.i18n.getMessage('sendRetry', ['']);
    sendStatus.style.color = '#94a3b8';
    chrome.runtime.sendMessage({ type: 'SEND_TO_APP' }, (res) => {
        if (res?.ok) {
            sendStatus.textContent = chrome.i18n.getMessage('sendSuccess');
            sendStatus.style.color = '#10b981';
        } else {
            // Note: res?.reason logic is not cleanly i18n, but since it's an error string,
            // we will fallback to sendFailed message for everything. 
            // In original Japanese it would append the reason but the reason string comes
            // from the background worker. We'll simplify here.
            sendStatus.textContent = res?.reason ? `❌ ${res.reason}` : chrome.i18n.getMessage('sendFailed');
            sendStatus.style.color = '#f87171';
        }
    });
});

btnReset.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('confirmReset'))) {
        chrome.runtime.sendMessage({ type: 'RESET' });
        render({ collecting: false, total: null, receivedCount: 0, receivedPages: [], complete: false });
    }
});

// GBFアーティファクト一覧へ移動
btnGbf.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#list/4' });
});

// 自動DLトグル
chrome.runtime.sendMessage({ type: 'GET_AUTO_DL' }, (res) => {
    if (res) chkAutoDl.checked = res.autoDl;
});
chkAutoDl.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'SET_AUTO_DL', value: chkAutoDl.checked });
});
