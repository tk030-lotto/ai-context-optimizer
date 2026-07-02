import { useState } from 'react';
import { traverseDirectory, generateTreeText, formatBytes, FileNode } from '../lib/parser/file-tree';

export default function App() {
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [treeText, setTreeText] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<{ fileCount: number; dirCount: number; totalBytes: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const calculateSummary = (nodes: FileNode[]) => {
    let fileCount = 0;
    let dirCount = 0;
    let totalBytes = 0;

    const count = (list: FileNode[]) => {
      for (const node of list) {
        if (node.kind === 'directory') {
          dirCount++;
          if (node.children) {
            count(node.children);
          }
        } else {
          fileCount++;
          totalBytes += node.size || 0;
        }
      }
    };

    count(nodes);
    return { fileCount, dirCount, totalBytes };
  };

  const handleSelectDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        setSelectedDir(handle.name);
        setIsScanning(true);
        setCopySuccess(false);

        // 走査の実行
        const tree = await traverseDirectory(handle);

        // 木構造テキストの生成
        const text = generateTreeText(tree);
        setTreeText(text);

        // サマリー計算
        const summary = calculateSummary(tree);
        setScanSummary(summary);

        setIsScanning(false);
      } else {
        alert('お使いのブラウザは showDirectoryPicker() API に対応していません。localhost(Secure Context)で実行しているかご確認ください。');
      }
    } catch (err: any) {
      setIsScanning(false);
      if (err.name !== 'AbortError') {
        console.error(err);
        alert('ディレクトリの選択または走査中にエラーが発生しました。');
      }
    }
  };

  const handleCopyTree = async () => {
    if (!treeText) return;
    try {
      await navigator.clipboard.writeText(treeText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('コピーに失敗しました。');
    }
  };

  const handleReset = () => {
    setSelectedDir(null);
    setTreeText(null);
    setScanSummary(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-brand-950/30 to-transparent pointer-events-none filter blur-3xl opacity-50" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-white font-bold text-lg">⚡</span>
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent">
                AI開発コンテキスト最適化ツール
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">完全ローカル・セキュア解析エンジン</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-brand-500 animate-ping" />
              Phase 2 Engine Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center items-center relative z-10">
        
        {/* Loading State */}
        {isScanning && (
          <div className="flex flex-col items-center justify-center space-y-6 py-20">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
            </div>
            <div className="text-center space-y-2 animate-pulse">
              <h3 className="text-lg font-bold text-white">プロジェクト走査中...</h3>
              <p className="text-xs text-slate-400">ディレクトリのファイルツリーを安全に構築しています。</p>
            </div>
          </div>
        )}

        {/* Dashboard / Scan Results State */}
        {!isScanning && selectedDir && scanSummary && (
          <div className="w-full max-w-4xl space-y-8 animate-fadeIn">
            {/* Header / Selected Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-400">対象ディレクトリ</span>
                <h2 className="text-2xl font-black text-white">{selectedDir}</h2>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleSelectDirectory}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition duration-200 cursor-pointer"
                >
                  再読込・変更
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition duration-200 cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">総フォルダ数</span>
                <p className="text-3xl font-extrabold text-white mt-2">{scanSummary.dirCount}</p>
                <span className="text-[10px] text-slate-400 block mt-1">※除外設定適用後</span>
              </div>
              
              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">総ファイル数</span>
                <p className="text-3xl font-extrabold text-white mt-2">{scanSummary.fileCount}</p>
                <span className="text-[10px] text-slate-400 block mt-1">※除外設定適用後</span>
              </div>

              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">合計サイズ</span>
                <p className="text-3xl font-extrabold text-white mt-2">{formatBytes(scanSummary.totalBytes)}</p>
                <span className="text-[10px] text-slate-400 block mt-1">※メモリ読み込み対象</span>
              </div>
            </div>

            {/* Tree View Panel */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-white">🌳 プロジェクト構造ツリー</span>
                  <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">無視フィルタ適用済</span>
                </div>
                <button
                  onClick={handleCopyTree}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                    copySuccess
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                  } cursor-pointer`}
                >
                  {copySuccess ? '✓ コピー完了！' : '木構造をコピー'}
                </button>
              </div>

              {treeText ? (
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-emerald-450 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{treeText}</code>
                  </pre>
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500 py-8">
                  表示可能なフォルダ構造がありません。
                </div>
              )}
            </div>
          </div>
        )}

        {/* Initial Hero / Picker State */}
        {!isScanning && !selectedDir && (
          <div className="max-w-2xl w-full text-center space-y-8 animate-fadeIn">
            {/* Hero Section */}
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                コンテキストを最適化し、
                <span className="bg-gradient-to-r from-brand-400 to-emerald-300 bg-clip-text text-transparent">
                  AI開発を次の次元へ
                </span>
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                プロジェクトフォルダを読み込み、不要なデータを排して圧縮された高品質な開発コンテキストに変換します。外部通信を行わないため、ソースコード漏洩の心配はありません。
              </p>
            </div>

            {/* Interactive Core Module */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              {/* Ambient card glow */}
              <div className="absolute -inset-px bg-gradient-to-r from-brand-500/10 to-emerald-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-500 -z-10" />

              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-brand-500/30 transition duration-300">
                  <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">解析対象のプロジェクトを選択</h3>
                  <p className="text-sm text-slate-400">
                    `showDirectoryPicker` を使用して、任意のフォルダを安全にローカル読み込みします。
                  </p>
                </div>

                <div>
                  <button
                    onClick={handleSelectDirectory}
                    className="relative inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all duration-300 shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 active:scale-95 cursor-pointer"
                  >
                    フォルダを選択する
                  </button>
                </div>
              </div>
            </div>

            {/* Key Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 text-left space-y-2">
                <div className="text-xl text-brand-400">🔒</div>
                <h4 className="font-bold text-white text-sm">100% 完全ローカル</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ブラウザのAPIを用いてPC内部で完結。外部のサーバーへソースコードを送信することは一切ありません。
                </p>
              </div>
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 text-left space-y-2">
                <div className="text-xl text-brand-400">📊</div>
                <h4 className="font-bold text-white text-sm">高度なコンテキスト制御</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  無駄なトークンを省いた `Audit Pack` や、移行用 `Handover Pack` などの目的別マークダウンを出力。
                </p>
              </div>
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 text-left space-y-2">
                <div className="text-xl text-brand-400">⚡</div>
                <h4 className="font-bold text-white text-sm">Deep Audit 連携</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  `module-analyzer` により、ファイル同士の複雑な依存関係やAPI仕様をすばやく整理・抽出します。
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 AI Development Context Optimizer. All Rights Reserved. Fully Local Secure Process.</p>
      </footer>
    </div>
  );
}

