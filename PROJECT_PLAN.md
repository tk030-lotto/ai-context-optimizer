# AI開発コンテキスト最適化ツール - 開発工程管理表

本ファイルは、AI開発コンテキスト最適化ツールの開発におけるマスター指示書（工程管理表）です。
各フェーズ完了時の引き継ぎおよび新規チャット移行のルールを含め、本ファイルに沿って進捗を管理・同期します。

---

## 1. プロジェクト概要 ＆ ゴール
* **開発の目的**：AI駆動開発における「コンテキスト肥大化」と「モデル間引継ぎの負荷」を解決し、トークン消費の最適化およびAI監査（Sonnet等）の効率を最大化する。
* **成果物**：プロジェクトフォルダを選択するだけで、安全にローカル解析し、各モード（引継ぎ、移行、監査、文書化、フェーズ完了）に適したマークダウンを生成しコピペできるローカルWeb GUIツール。
* **防衛方針**：完全ローカル動作（外部通信なし）を保証するため、静的スキャン `check-no-network.js` による自動検証を行う。

---

## 2. 動作環境・実行形態
* **起動方式**: `最適化.bat` を起動することで、Node.js標準モジュールのみによる静的Webサーバー（`server.js`）が立ち上がり、`http://localhost:4173` でブラウザを自動起動します。
* **解析の仕組み**: ブラウザの **File System Access API (showDirectoryPicker)** を用い、ソースコードをサーバー等に一切送信せずにクライアントサイドのJavaScript(TypeScript)だけで解析を行います。

---

## 3. ディレクトリ構造ルール
将来の拡張（プラグイン化やモジュール移植）が容易なよう、**1ユニット1機能（1ファイル1責務）** の設計を徹底します。

```plaintext
AI開発コンテキスト最適化ツール/
├── 最適化.bat              # 起動バッチ
├── server.js              # Node.js標準モジュール製静的サーバー
├── check-no-network.js    # 外部通信混入防止の静的スキャン
├── PROJECT_PLAN.md        # 本工程管理表
├── package.json
├── tsconfig.json
├── vite.config.ts
├── dist/                  # ビルド成果物 (配布対象)
├── ai_pipeline/           # ★追加：パイプライン連携用成果物フォルダ
│   ├── result.json        # 実行結果（自動出力）
│   ├── test_report.md     # テスト結果（自動出力）
│   ├── log.md             # 開発ログ・判断記録（自動出力）
│   └── development_chat_history.md # 開発チャット履歴（自動出力）
└── src/
    ├── app/               # UIエントリー
    ├── components/        # UIユニット (Picker, Viewer, Indicator 等)
    └── lib/
        ├── parser/        # 解析エンジンユニット (ロジック比重 80%)
        │   ├── file-tree.ts       # 木構造解析（除外リスト適用）
        │   ├── file-reader.ts     # フィルタリング・読み込み
        │   ├── dependency.ts      # 依存関係抽出
        │   ├── module-analyzer.ts  # モジュール解析（クラス・関数・API抽出）
        │   └── token-estimator.ts # 簡易トークン数・想定読込時間推定
        ├── formatters/    # 出力フォーマッタ
        │   ├── handover.ts
        │   ├── transfer.ts
        │   ├── audit.ts
        │   ├── deep-audit.ts
        │   ├── doc.ts
        │   └── phase-summary.ts
        └── config/
            └── constants.ts   # 強化された除外ディレクトリリスト
```

---

## 4. 工程管理表（進捗ステータス）

* **全体進捗率**: ▓▓▓▓▓▓░░░░ 50% (6/12 フェーズ完了)
* **防衛方針**: 実装前に必ず承認を取り、ルール違反を行わないこと。

| フェーズ | ステータス | タスク内容 | 対象ファイル | 担当 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | `[x]` 完了 | 基盤構築（Vite/TypeScript, bat, server.js, スキャンツール） | `package.json`, `server.js`, `最適化.bat` 等 | AI |
| **Phase 2** | `[x]` 完了 | プロジェクト解析エンジン（Tree解析、フィルタ、除外リスト） | `src/lib/parser/file-tree.ts` 等 | AI |
| **Phase 3** | `[x]` 完了 | 知識圧縮エンジン（依存、モジュール解析、トークン推定） | `src/lib/parser/module-analyzer.ts` 等 | AI |
| **Phase 4** | `[x]` 完了 | Audit Mode（Audit Pack）生成機能（優先順位制御） | `src/lib/formatters/audit.ts` 等 | AI |
| **Phase 5** | `[x]` 完了 | Deep Audit Mode（Deep Audit Pack）生成機能 | `src/lib/formatters/deep-audit.ts` 等 | AI |
| **Phase 6** | `[x]` 完了 | Chat Handover Mode生成機能 | `src/lib/formatters/handover.ts` 等 | AI |
| **Phase 7** | `[ ]` 未着手 | AI Transfer Mode生成機能（モデル間引継ぎ） | `src/lib/formatters/transfer.ts` 等 | AI |
| **Phase 8** | `[ ]` 未着手 | Documentation Mode生成機能（記事作成用） | `src/lib/formatters/doc.ts` 等 | AI |
| **Phase 9** | `[ ]` 未着手 | Phase Summary Mode生成機能とコピーUIの実装 | `src/lib/formatters/phase-summary.ts` 等 | AI |
| **Phase 10**| `[ ]` 未着手 | テスト・全体動作検証（各PC動作テスト） | テストコード等 | AI |
| **Phase 11**| `[ ]` 未着手 | 最終監査（Sonnetによる品質・バグ・リスク監査） | Audit Pack等 | AI |
| **Phase 12**| `[ ]` 未着手 | リリースビルドと最小構成パッケージ化 | `dist/` | AI |

---

## 5. 成功条件（DoD）
- [ ] 外部通信を完全遮断していること（`check-no-network.js` で検証）
- [ ] `最適化.bat` のダブルクリックにより `localhost:4173` でブラウザが開き、ローカルで正しく動くこと
- [ ] `showDirectoryPicker()` を用いて外部フォルダ（`stock_analysis_kit` 等）を直接読み込み、CORS制限なく解析できること
- [ ] すべての出力モード（引継ぎ、移行、監査、ドキュメント）でマークダウンが出力され、1クリックでコピー可能であること
- [x] Audit Packが優先順位制御され、3,000〜5,000トークン目安に収まっていること
- [ ] 生成画面に推定トークン数および想定読込時間が表示されていること
- [ ] 解析実行時、`ai_pipeline/` 内に `result.json`, `test_report.md`, `log.md`, `development_chat_history.md` が自動出力・更新されること

---

## 6. フェーズ完了 ＆ AI移行時の引継ぎルール
各フェーズ完了時、またはチャットスレッド切り替え・モデル移行時（ChatGPT ⇄ Antigravity ⇄ Sonnet）には、必ず以下のサマリーテンプレートを生成し、新規チャットに移行してください。

### 引継ぎ用サマリーテンプレート
```markdown
# 【引継ぎ】AI開発コンテキスト最適化ツール - Phase X 完了

## 1. 完了事項 (Completed)
- フェーズXで実装した機能や修正内容

## 2. 現在のコード状態 (Current Status)
- 主要ファイルの配置と動作状態
- 工程管理表の進捗率

## 3. 次フェーズのタスク (Next Actions)
- 次回のチャットスレッドで最初に行うべき実装項目
- 注意点・確認事項
```
---

## 7. 現在地と次回のタスク
* **【現在地】**：Phase 6 完了（Chat Handover Pack生成機能の実装完了）
* **【次回タスク】**：
  - **Phase 7: AI Transfer Mode生成機能の構築**
    - `src/lib/formatters/transfer.ts` での異なるAI間での移行を目的とした、プロジェクト概要や機能一覧をまとめる Transfer パック生成ロジックの実装。
