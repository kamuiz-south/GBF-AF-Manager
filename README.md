# GBF AF Manager & Collector

グラブルアーティファクト（AF）の管理・評価を効率化するためのツールセットです。
ブラウザ拡張機能でゲーム内のAFデータを取得し、Webアプリまたはデスクトップアプリで詳細な評価・仕分け（確保/廃棄）を行うことができます。

## 🚀 公開URL
- **Web版 AF Manager**: [https://kamuiz-south.github.io/GBF-AF-Manager/](https://kamuiz-south.github.io/GBF-AF-Manager/)
- **最新の配布物（インストーラー/拡張機能）**: [Releases](https://github.com/kamuiz-south/GBF-AF-Manager/releases) からダウンロードできます。

## 📦 ツール構成

### 1. AF Manager (Web/Desktop App)
AFデータのリスト表示、カスタム条件による確保/廃棄の自動判定、評価値の計算を行うメインツールです。
- **Web版**: インストール不要でブラウザから利用可能。
- **デスクトップアプリ(Tauri)**: ローカル環境で高速に動作し、データの自動受信をより安定して行えます。

### 2. AF Collector (Chrome Extension)
グラブルのプレイ画面からAFデータを自動で読み取り、Managerへ送信するための拡張機能です。

## 🛠 インストール方法

### 拡張機能 (AF Collector) の導入
1. [Releases](https://github.com/kamuiz-south/GBF-AF-Manager/releases) から `af-collector-vX.X.X.zip` をダウンロードし、解凍します。
2. Chromeブラウザで `chrome://extensions/` を開きます。
3. 右上の「デベロッパーモード」をONにします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、解凍したフォルダを選択します。

### デスクトップ版の導入
1. [Releases](https://github.com/kamuiz-south/GBF-AF-Manager/releases) から `.msi` ファイル（Windows用）をダウンロードして実行します。

## 📝 開発者向け
このプロジェクトは Vite (React) + Tauri (Rust) で構成されています。
ローカルでの開発手順については各フォルダ内の `README.md` （作成中）を参照してください。

## ⚖️ 免責事項
本ツールは個人の活動を支援するためのものであり、ゲームの利用規約を遵守してご使用ください。本ツールの利用によって生じたいかなる損害についても責任を負いかねます。
