# AI開発コンテキスト最適化ツール

> **AI-Driven Development Context Optimizer** — コンテキスト肥大化・モデル間引継ぎコストを解決する、完全ローカル動作の開発支援 Web GUI ツール

[![Version](https://img.shields.io/badge/version-1.0.0-emerald?style=flat-square)](https://github.com/tk030-lotto/ai-context-optimizer)
[![License](https://img.shields.io/badge/license-Private-slate?style=flat-square)]()
[![Security](https://img.shields.io/badge/network_scan-PASS-emerald?style=flat-square)](./check-no-network.js)
[![Build](https://img.shields.io/badge/build-passing-emerald?style=flat-square)]()
[![Tests](https://img.shields.io/badge/tests-7%2F7_PASS-emerald?style=flat-square)](./verify-all.ts)

---

## 概要

AI 駆動開発では、チャット履歴の蓄積・モデル間の引継ぎ・ソースコードの共有において **コンテキストの肥大化** が深刻な問題になります。本ツールはその課題を解決するために設計されました。

- プロジェクトフォルダを選択するだけで**自動解析**
- 用途別の**最適化済みマークダウン**を生成・コピー
- **外部サーバーへの通信は一切行わない** — ソースコードはローカルから出ません

---

## 特徴

### 🔒 完全ローカル動作
ブラウザの [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)（`showDirectoryPicker`）を使用。サーバーレス・完全オフラインで動作します。ソースコードが外部に漏洩するリスクはゼロです。

### 📦 7 種類の出力モード
| モード | 用途 |
|--------|------|
| 🌳 **プロジェクトツリー** | フォルダ構造を ASCII アートで可視化 |
| 🔍 **Audit Pack** | プロジェクト全体の監査・コードレビュー用 |
| 🔬 **Deep Audit Pack** | 特定モジュールに特化した詳細監査用 |
| 🤝 **Handover Pack** | 同一 AI への会話引継ぎ用 |
| 🔄 **Transfer Pack** | 異なる AI モデルへの移行用 |
| 📄 **Doc Pack** | 仕様書・記事作成用 |
| 📋 **Phase Summary Pack** | フェーズ完了時の引継ぎサマリー用 |

### 🎚️ 自動縮退アルゴリズム（Level 0〜5）
各モードはトークン上限に応じて **自動的に出力量を縮退** します。スライダーで目標トークン数（2,000〜6,000）を指定するだけで、最適な情報量に自動調整されます。

### ⚡ 高度な解析エンジン
- **依存関係抽出** — JS/TS/Python のインポートを静的解析
- **モジュール解析** — クラス・関数・引数・戻り値を自動抽出（ジェネリクス対応）
- **トークン推定** — 日本語・英語の混在に対応した独自アルゴリズム

---

## セットアップ

### 必要環境
- **Node.js** v18 以上
- **npm** v9 以上
- モダンブラウザ（Chrome / Edge 推奨 — File System Access API 対応必須）

### インストール

```bash
git clone https://github.com/tk030-lotto/ai-context-optimizer.git
cd ai-context-optimizer
npm install
```

---

## 起動方法

### 開発サーバー
```bash
npm run dev
```
`http://localhost:5173` でツールが起動します。

### ポータブル版（リリース版）
```bash
# 1. ビルド
npm run build

# 2. 静的サーバーを起動
node server.js
# → http://localhost:4173 で起動
```

または `release_package/AI開発コンテキスト最適化ツール-Portable/` 内の **`最適化.bat`** をダブルクリックするだけで起動します（Node.js のみ必要）。

---

## 使い方

1. ブラウザでツールを開く
2. **「フォルダを選択する」** ボタンをクリック
3. 解析したいプロジェクトフォルダを選択
4. 解析が自動実行され、リアルタイムで進捗が表示される
5. タブを切り替えて目的のパックを選択
6. トークン数スライダーで出力量を調整
7. **「コピー」** ボタンで AI へ貼り付け

---

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 外部通信非混入セキュリティスキャン
npm run scan

# 全テスト実行（7テスト）
npm test
```

---

## プロジェクト構造

```
ai-context-optimizer/
├── src/
│   ├── app/
│   │   └── App.tsx              # メイン UI コンポーネント
│   └── lib/
│       ├── config/
│       │   └── constants.ts     # 除外設定・サイズ制限
│       ├── parser/
│       │   ├── file-tree.ts     # ディレクトリ再帰走査
│       │   ├── file-reader.ts   # ファイル読込・フィルタ
│       │   ├── dependency.ts    # 依存関係抽出
│       │   ├── module-analyzer.ts  # クラス・関数静的解析
│       │   ├── token-estimator.ts  # トークン数・読了時間推定
│       │   └── project-analyzer.ts # 解析オーケストレーター
│       └── formatters/
│           ├── audit.ts         # Audit Pack 生成
│           ├── deep-audit.ts    # Deep Audit Pack 生成
│           ├── handover.ts      # Handover Pack 生成
│           ├── transfer.ts      # Transfer Pack 生成
│           ├── doc.ts           # Doc Pack 生成
│           └── phase-summary.ts # Phase Summary Pack 生成
├── check-no-network.js          # 外部通信非混入スキャン
├── verify-all.ts                # 全テスト統合スクリプト
├── release_package/             # ポータブル版リリース成果物
└── ai_pipeline/                 # パイプライン連携ファイル
```

---

## セキュリティポリシー

本ツールは **「完全ローカル動作」** を最優先設計原則として採用しています。

- `check-no-network.js` による静的スキャン（`fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` 等を検出）
- ビルド時・CI 時に自動検査（`npm run scan`）
- `.html` / `.css` ファイルの外部リソース参照（`<script src="https://...">` 等）も検査対象
- ユーザーの明示的な操作なしにファイルにアクセスしない（ブラウザ標準の許可モデル）

---

## 開発履歴

| Phase | 内容 | 完了日 |
|-------|------|--------|
| Phase 1 | 基盤構築（Vite / React / TypeScript / Tailwind） | 2026-07-02 |
| Phase 2 | プロジェクト解析エンジン（走査・除外フィルタ・ツリー表示） | 2026-07-02 |
| Phase 3 | 知識圧縮エンジン（依存関係・モジュール解析・トークン推定） | 2026-07-02 |
| Phase 4 | Audit Pack 生成機能 | 2026-07-02 |
| Phase 5 | Deep Audit Pack 生成機能 | 2026-07-02 |
| Phase 6 | Handover Pack 生成機能 | 2026-07-02 |
| Phase 7 | Transfer Pack 生成機能 | 2026-07-02 |
| Phase 8 | Doc Pack 生成機能 | 2026-07-02 |
| Phase 9 | Phase Summary Pack 生成機能 | 2026-07-02 |
| Phase 10 | 統合テスト・全体動作検証 | 2026-07-02 |
| Phase 11 | 最終監査（AI コードレビュー・品質確認） | 2026-07-04 |
| Phase 12 | リリースビルド・ポータブルパッケージ化 | 2026-07-04 |
| **Post-Release** | **バグ修正 5件・改善機能 3件実装** | **2026-07-20** |

---

## Post-Release アップデート（2026-07-20）

リリース後の自己監査により発見・修正した内容：

**バグ修正**
- `check-no-network.js` — URL検知の `lastIndex` 蓄積バグを修正
- `check-no-network.js` — HTML/CSS ファイルの外部リソース参照を検査対象に追加
- `file-tree.ts` — `(dirHandle as any)` を型安全なインターフェース定義に変更
- `module-analyzer.ts` — ジェネリック型 `<K, V>` を含む引数の誤解析を修正
- `App.tsx` — 古いフェーズ番号が残っていたヘッダーバッジを修正

**機能改善**
- `alert()` を全廃止 → カスタムトースト通知コンポーネントに置き換え
- ローディング中にファイル解析の進捗バーをリアルタイム表示
- `npm test` スクリプトを追加（全7テストを一発実行）

---

## ライセンス

Private — All rights reserved.

---

*Fully Local. Fully Secure. No network communication.*
