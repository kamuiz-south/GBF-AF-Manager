use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tower_http::cors::CorsLayer;

// アプリハンドルを axum のステートとして共有
struct AppState {
    handle: AppHandle,
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

/// ポート 1422 で HTTP サーバー（axum）を起動する
/// Tauri の setup フックから呼び出す
pub fn start_http_server(handle: AppHandle) {
    let state = Arc::new(AppState { handle });

    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route("/api/artifacts", post(receive_artifacts))
            .layer(CorsLayer::permissive())
            .with_state(state);

        let listener = match tokio::net::TcpListener::bind("127.0.0.1:1422").await {
            Ok(l) => l,
            Err(e) => {
                log::error!("HTTP server failed to bind 127.0.0.1:1422: {e}");
                return;
            }
        };

        log::info!("AF Collector HTTP server listening on http://127.0.0.1:1422");
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("HTTP server error: {e}");
        }
    });
}

#[tauri::command]
fn set_window_state_enabled(handle: AppHandle, enabled: bool) {
    if let Ok(app_dir) = handle.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&app_dir);
        let path = app_dir.join("window-state-config.json");
        let config = serde_json::json!({ "enabled": enabled });
        if let Ok(content) = serde_json::to_string(&config) {
            let _ = std::fs::write(path, content);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_window_state_enabled])
        .setup(|app| {
            // ウィンドウ状態保存設定の読み込み
            let enabled = (|| {
                let path = app.path().app_data_dir().ok()?.join("window-state-config.json");
                let content = std::fs::read_to_string(path).ok()?;
                let json: serde_json::Value = serde_json::from_str(&content).ok()?;
                json["enabled"].as_bool()
            })().unwrap_or(true);

            if enabled {
                // 有効な場合のみプラグインを登録。その後ウィンドウを生成することで、プラグインが確実にフックを捕捉できる。
                app.handle().plugin(tauri_plugin_window_state::Builder::default().build())?;
            }

            // `tauri.conf.json` の "windows" 設定をここで手動実行する
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("GBF AF Manager")
                .inner_size(1280.0, 800.0)
                .resizable(true)
                .fullscreen(false)
                .build()?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // HTTP サーバーをバックグラウンドで起動
            start_http_server(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
