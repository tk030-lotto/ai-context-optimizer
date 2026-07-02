@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

cd /d %~dp0

echo ==================================================
echo   AI開発コンテキスト最適化ツール 起動バッチ
echo ==================================================

:: Node.jsの存在確認
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js がインストールされていないか、環境変数 PATH に登録されていません。
    echo インストールしてから再度実行してください。
    pause
    exit /b 1
)

:: node_modulesの存在確認とインストール
if not exist node_modules (
    echo node_modules が見つかりません。ライブラリをインストールします...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install に失敗しました。
        pause
        exit /b 1
    )
)

:: ビルド成果物の存在確認とビルド
if not exist dist (
    echo ビルド成果物 (dist/) が見つかりません。ビルドを実行します...
    call npm run build
    if !errorlevel! neq 0 (
        echo [ERROR] ビルドに失敗しました。
        pause
        exit /b 1
    )
)

:: 静的スキャンチェックの実施
echo 外部通信スキャン (check-no-network.js) を実行中...
call npm run scan
if !errorlevel! neq 0 (
    echo [ERROR] 外部通信の検知ポリシー違反が見つかりました。起動を中止します。
    pause
    exit /b 1
)

:: ブラウザの起動 (数秒待ってから立ち上がるようにするか、サーバー起動と同時に開く)
echo ブラウザで http://localhost:4173 を開きます...
start http://localhost:4173

:: サーバーの起動
echo サーバーを起動します...
node server.js

pause
