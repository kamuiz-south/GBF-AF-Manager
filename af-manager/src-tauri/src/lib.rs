use axum::{
    extract::{DefaultBodyLimit, State},
    http::{header, Method, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{
    net::{Ipv4Addr, SocketAddr, TcpListener as StdTcpListener},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State as TauriState,
    WebviewWindow, WindowEvent,
};
use tower_http::cors::{AllowOrigin, CorsLayer};

// ---------------------------------------------------------------------------
// ポータブルモード判定 (ビルド時フラグ feature = "portable")
// ---------------------------------------------------------------------------
#[inline]
fn is_portable_mode() -> bool {
    cfg!(feature = "portable")
}

/// ポータブルモード時は exe 隣接 data/ を、通常時は Tauri の app_data_dir を返す。
fn resolve_data_dir(handle: &AppHandle) -> Option<PathBuf> {
    if is_portable_mode() {
        let exe_path = std::env::current_exe().ok()?;
        let exe_dir = exe_path.parent()?;
        let data_dir = exe_dir.join("data");
        let _ = std::fs::create_dir_all(&data_dir);
        Some(data_dir)
    } else {
        handle.path().app_data_dir().ok()
    }
}

// ---------------------------------------------------------------------------
// ポータブル版 ウィンドウ位置・サイズ保存/復元 (画面外判定フォールバック付き)
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PortableWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn is_window_state_enabled(handle: &AppHandle) -> bool {
    let Some(path) = resolve_data_dir(handle).map(|d| d.join("window-state-config.json")) else {
        return true;
    };
    let Ok(content) = std::fs::read_to_string(path) else {
        return true;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
        return true;
    };
    json["enabled"].as_bool().unwrap_or(true)
}

fn restore_portable_window_state(window: &WebviewWindow) -> Option<PortableWindowState> {
    if !is_window_state_enabled(window.app_handle()) {
        return None;
    }
    let data_dir = resolve_data_dir(window.app_handle())?;
    let path = data_dir.join("window-state.json");
    let content = std::fs::read_to_string(path).ok()?;
    let state: PortableWindowState = serde_json::from_str(&content).ok()?;

    // 画面外判定: 保存された矩形が現在有効ないずれかのモニター領域と交差しているかを検査
    let mut intersects_any = false;
    if let Ok(monitors) = window.available_monitors() {
        let w_right = state.x + state.width as i32;
        let w_bottom = state.y + state.height as i32;
        for m in monitors {
            let m_pos = m.position();
            let m_size = m.size();
            let m_right = m_pos.x + m_size.width as i32;
            let m_bottom = m_pos.y + m_size.height as i32;

            if !(w_right <= m_pos.x || state.x >= m_right || w_bottom <= m_pos.y || state.y >= m_bottom) {
                intersects_any = true;
                break;
            }
        }
    }

    if intersects_any {
        let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
        let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    }

    if state.maximized {
        let _ = window.maximize();
    }

    Some(state)
}

fn setup_portable_window_state_listener(
    window: &WebviewWindow,
    initial: Option<PortableWindowState>,
) {
    let initial_state = initial.unwrap_or_else(|| {
        let pos = window.outer_position().unwrap_or_default();
        let size = window.inner_size().unwrap_or(PhysicalSize::new(1280, 800));
        PortableWindowState {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            maximized: window.is_maximized().unwrap_or(false),
        }
    });

    let state_holder = Arc::new(Mutex::new(initial_state));
    let state_clone = Arc::clone(&state_holder);
    let app_handle = window.app_handle().clone();

    window.on_window_event(move |event| {
        match event {
            WindowEvent::Resized(size) => {
                if let Ok(mut s) = state_clone.lock() {
                    if !s.maximized && size.width > 0 && size.height > 0 {
                        s.width = size.width;
                        s.height = size.height;
                    }
                }
            }
            WindowEvent::Moved(pos) => {
                if let Ok(mut s) = state_clone.lock() {
                    if !s.maximized {
                        s.x = pos.x;
                        s.y = pos.y;
                    }
                }
            }
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                if !is_window_state_enabled(&app_handle) {
                    return;
                }
                if let Ok(mut s) = state_clone.lock() {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        s.maximized = w.is_maximized().unwrap_or(false);
                    }
                    if let Some(dir) = resolve_data_dir(&app_handle) {
                        let path = dir.join("window-state.json");
                        if let Ok(content) = serde_json::to_string_pretty(&*s) {
                            let _ = std::fs::write(path, content);
                        }
                    }
                }
            }
            _ => {}
        }
    });
}

const DEFAULT_HTTP_PORT: u16 = 1422;
const AUTO_PORT_RANGE_END: u16 = 1432;
const HTTP_CONFIG_FILE: &str = "network-config.json";
const APP_IDENTIFIER: &str = "gbf-af-manager";
const API_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NetworkConfig {
    mode: String,
    preferred_port: u16,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            mode: "auto".to_string(),
            preferred_port: DEFAULT_HTTP_PORT,
        }
    }
}

impl NetworkConfig {
    fn normalized(mut self) -> Self {
        if self.mode != "auto" && self.mode != "fixed" {
            self.mode = "auto".to_string();
        }
        if self.preferred_port < 1024 {
            self.preferred_port = DEFAULT_HTTP_PORT;
        }
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpServerInfo {
    running: bool,
    port: u16,
    mode: String,
    preferred_port: u16,
    instance_id: String,
    error: Option<String>,
}

struct HttpServerState(Mutex<HttpServerInfo>);

// アプリハンドルを axum のステートとして共有
struct AppState {
    handle: AppHandle,
    port: u16,
    instance_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PingResponse {
    app: &'static str,
    api_version: u8,
    version: &'static str,
    port: u16,
    instance_id: String,
}

async fn ping(State(state): State<Arc<AppState>>) -> Json<PingResponse> {
    Json(PingResponse {
        app: APP_IDENTIFIER,
        api_version: API_VERSION,
        version: env!("CARGO_PKG_VERSION"),
        port: state.port,
        instance_id: state.instance_id.clone(),
    })
}

/// POST /api/artifacts
/// 拡張機能（af-collector）から送信されたAFデータを受け取り、
/// フロントエンドへ tauri イベントとして転送する
async fn receive_artifacts(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, &'static str) {
    // フロントエンドへイベント送信
    match state.handle.emit("af-data-received", &payload) {
        Ok(_) => (StatusCode::OK, "ok"),
        Err(e) => {
            log::error!("Failed to emit af-data-received: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "emit failed")
        }
    }
}

fn network_config_path(handle: &AppHandle) -> Option<PathBuf> {
    resolve_data_dir(handle).map(|dir| dir.join(HTTP_CONFIG_FILE))
}

fn load_network_config(handle: &AppHandle) -> NetworkConfig {
    let Some(path) = network_config_path(handle) else {
        return NetworkConfig::default();
    };
    let Ok(content) = std::fs::read_to_string(path) else {
        return NetworkConfig::default();
    };
    // 手動編集やWindowsの一部エディタで付与されるUTF-8 BOMを許容する
    let content = content.trim_start_matches('\u{feff}');
    serde_json::from_str::<NetworkConfig>(content)
        .unwrap_or_default()
        .normalized()
}

/// 自動モードでは優先ポートを最初に試し、次に1422〜1432を試す。
/// すべて使用中ならポート0（OS自動割当）へフォールバックする。
fn candidate_ports(config: &NetworkConfig) -> Vec<u16> {
    if config.mode == "fixed" {
        return vec![config.preferred_port];
    }

    let mut ports = vec![config.preferred_port];
    for port in DEFAULT_HTTP_PORT..=AUTO_PORT_RANGE_END {
        if port != config.preferred_port {
            ports.push(port);
        }
    }
    ports.push(0);
    ports
}

fn bind_http_listener(config: &NetworkConfig) -> Result<(StdTcpListener, u16), String> {
    let mut errors = Vec::new();

    for port in candidate_ports(config) {
        let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        match StdTcpListener::bind(addr) {
            Ok(listener) => {
                if let Err(e) = listener.set_nonblocking(true) {
                    errors.push(format!("{addr}: failed to set nonblocking: {e}"));
                    continue;
                }
                match listener.local_addr() {
                    Ok(local) => return Ok((listener, local.port())),
                    Err(e) => errors.push(format!("{addr}: failed to read local address: {e}")),
                }
            }
            Err(e) => {
                errors.push(format!("{addr}: {e}"));
            }
        }
    }

    Err(errors
        .last()
        .cloned()
        .unwrap_or_else(|| "no candidate ports available".to_string()))
}

fn make_instance_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{}-{nanos}", std::process::id())
}

/// AF Collector（ブラウザ拡張機能）からのアクセスだけをCORSで許可する。
/// 通常のWebページからは /api/ping の読み取りや /api/artifacts への
/// JSON POST をできないようにする。ローカルプロセスは対象外。
fn is_extension_origin(origin: &str) -> bool {
    origin.starts_with("chrome-extension://") || origin.starts_with("moz-extension://")
}

/// HTTP サーバーを起動し、実際に使用したポートを返す。
/// バインドに失敗した場合もアプリ自体は起動させ、UIから状態を確認できるようにする。
fn start_http_server(handle: AppHandle) -> HttpServerInfo {
    let config = load_network_config(&handle);
    let instance_id = make_instance_id();

    let (std_listener, actual_port) = match bind_http_listener(&config) {
        Ok(value) => value,
        Err(error) => {
            log::error!("HTTP server failed to bind: {error}");
            return HttpServerInfo {
                running: false,
                port: 0,
                mode: config.mode,
                preferred_port: config.preferred_port,
                instance_id,
                error: Some(error),
            };
        }
    };

    let state = Arc::new(AppState {
        handle,
        port: actual_port,
        instance_id: instance_id.clone(),
    });
    let info = HttpServerInfo {
        running: true,
        port: actual_port,
        mode: config.mode.clone(),
        preferred_port: config.preferred_port,
        instance_id,
        error: None,
    };

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(std_listener) {
            Ok(listener) => listener,
            Err(e) => {
                log::error!("HTTP server failed to initialize listener: {e}");
                return;
            }
        };

        let app = Router::new()
            .route("/api/ping", get(ping))
            .route("/api/artifacts", post(receive_artifacts))
            // JSONペイロード上限をデフォルト(2MB)から50MBに変更
            .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
            .layer(
                CorsLayer::new()
                    .allow_origin(AllowOrigin::predicate(|origin, _| {
                        origin.to_str().map(is_extension_origin).unwrap_or(false)
                    }))
                    .allow_methods([Method::GET, Method::POST])
                    .allow_headers([header::CONTENT_TYPE]),
            )
            .with_state(state);

        log::info!("AF Collector HTTP server listening on http://127.0.0.1:{actual_port}");
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("HTTP server error: {e}");
        }
    });

    info
}

#[tauri::command]
fn get_http_server_info(state: TauriState<'_, HttpServerState>) -> HttpServerInfo {
    match state.0.lock() {
        Ok(info) => info.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

#[tauri::command]
fn set_http_port_config(
    handle: AppHandle,
    mode: String,
    preferred_port: u16,
) -> Result<(), String> {
    let mode = if mode == "fixed" { "fixed" } else { "auto" };
    if !(1024..=65535).contains(&preferred_port) {
        return Err("Port must be between 1024 and 65535".to_string());
    }

    let path = network_config_path(&handle)
        .ok_or_else(|| "Failed to resolve the application data directory".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let config = NetworkConfig {
        mode: mode.to_string(),
        preferred_port,
    };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize network config: {e}"))?;
    std::fs::write(path, content)
        .map_err(|e| format!("Failed to write network config: {e}"))?;
    Ok(())
}

#[tauri::command]
fn set_window_state_enabled(handle: AppHandle, enabled: bool) {
    if let Some(app_dir) = resolve_data_dir(&handle) {
        let _ = std::fs::create_dir_all(&app_dir);
        let path = app_dir.join("window-state-config.json");
        let config = serde_json::json!({ "enabled": enabled });
        if let Ok(content) = serde_json::to_string(&config) {
            let _ = std::fs::write(path, content);
        }
    }
}

/// フロントエンドからポータブルモードかどうかを判定するためのコマンド
#[tauri::command]
fn is_portable() -> bool {
    is_portable_mode()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 二重起動時は既存ウィンドウを前面に出す（データ/HTTPサーバーの二重化を防ぐ）
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            set_window_state_enabled,
            get_http_server_info,
            set_http_port_config,
            is_portable
        ])
        .setup(|app| {
            // ウィンドウ状態保存設定の読み込み
            // ポータブルモード時は tauri-plugin-window-state がユーザーディレクトリ
            // (%APPDATA%) に書き込むのを防ぐため、公式プラグインはインストール版でのみ有効化する。
            if !is_portable_mode() {
                let enabled = (|| {
                    let path = app.path().app_data_dir().ok()?.join("window-state-config.json");
                    let content = std::fs::read_to_string(path).ok()?;
                    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
                    json["enabled"].as_bool()
                })().unwrap_or(true);

                if enabled {
                    app.handle().plugin(tauri_plugin_window_state::Builder::default().build())?;
                }
            }

            // HTTP サーバーを先に起動し、実際の待受状態をUIへ公開
            let http_info = start_http_server(app.handle().clone());
            app.manage(HttpServerState(Mutex::new(http_info)));

            // JSONから設定をデシリアライズしてウィンドウを手動生成する
            // (tauri.conf.json の windows 自動生成によるパニックを避けるため)
            let config_json = serde_json::json!({
                "label": "main",
                "title": "GBF AF Manager",
                "width": 1280,
                "height": 800,
                "resizable": true,
                "fullscreen": false,
                "dragDropEnabled": false
            });
            let config: tauri::utils::config::WindowConfig = serde_json::from_value(config_json).unwrap();
            // ポータブルモード時は WebView2 のデータディレクトリ（IndexedDB, localStorage 等）
            // を exe 隣接の data/webview/ へリダイレクトする。
            // 通常モード・ブラウザ版では従来通り OS デフォルトパスを使用。
            let builder = tauri::WebviewWindowBuilder::from_config(app, &config)?;
            let builder = if is_portable_mode() {
                if let Some(dir) = resolve_data_dir(&app.handle().clone()) {
                    builder.data_directory(dir.join("webview"))
                } else {
                    builder
                }
            } else {
                builder
            };
            let window = builder.build()?;

            // ポータブルモード時のウィンドウ位置・サイズの復元と保存リスナー登録
            if is_portable_mode() {
                let restored = restore_portable_window_state(&window);
                setup_portable_window_state_listener(&window, restored);
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
