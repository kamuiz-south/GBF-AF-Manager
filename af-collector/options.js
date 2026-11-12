const DEFAULT_PORT = 1422;

const modeEl = document.getElementById('mode');
const fixedPortEl = document.getElementById('fixedPort');
const fixedPortRow = document.getElementById('fixedPortRow');
const statusEl = document.getElementById('status');
const saveEl = document.getElementById('save');

function updateFixedPortVisibility() {
    fixedPortRow.style.display = modeEl.value === 'fixed' ? '' : 'none';
}

async function loadOptions() {
    const stored = await chrome.storage.local.get({
        afConnectionMode: 'auto',
        afFixedPort: DEFAULT_PORT,
    });
    modeEl.value = stored.afConnectionMode === 'fixed' ? 'fixed' : 'auto';
    fixedPortEl.value = String(stored.afFixedPort ?? DEFAULT_PORT);
    updateFixedPortVisibility();
}

async function saveOptions() {
    const mode = modeEl.value === 'fixed' ? 'fixed' : 'auto';
    const port = Number(fixedPortEl.value);

    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        statusEl.style.color = '#f87171';
        statusEl.textContent = 'ポートは1024〜65535で指定してください / Port must be 1024-65535';
        return;
    }

    await chrome.storage.local.set({
        afConnectionMode: mode,
        afFixedPort: port,
    });
    // 接続先キャッシュを消して、次回送信時に再検出させる
    await chrome.storage.local.remove('af_app_connection');

    statusEl.style.color = '#34d399';
    statusEl.textContent = '保存しました / Saved';
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
}

modeEl.addEventListener('change', updateFixedPortVisibility);
saveEl.addEventListener('click', () => {
    saveOptions().catch((error) => {
        statusEl.style.color = '#f87171';
        statusEl.textContent = `保存に失敗しました / Failed: ${error.message}`;
    });
});

loadOptions().catch((error) => {
    statusEl.style.color = '#f87171';
    statusEl.textContent = `設定の読み込みに失敗しました / Failed to load: ${error.message}`;
});
