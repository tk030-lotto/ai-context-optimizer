import { useState } from 'react';

export default function App() {
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  const handleSelectDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        // showDirectoryPicker() standard API call
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        setSelectedDir(handle.name);
      } else {
        alert('お使いのブラウザは showDirectoryPicker() API に対応していません。localhost(Secure Context)で実行しているかご確認ください。');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert('ディレクトリの選択中にエラーが発生しました。');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-brand-950/30 to-transparent pointer-events-none filter blur-3xl opacity-50" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20 animate-pulse">
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
              Phase 1 Base Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center items-center relative z-10">
        <div className="max-w-2xl w-full text-center space-y-8">
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

              {selectedDir && (
                <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 inline-block text-xs font-mono text-slate-300">
                  選択中: <span className="text-brand-400 font-semibold">{selectedDir}</span>
                </div>
              )}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 AI Development Context Optimizer. All Rights Reserved. Fully Local Secure Process.</p>
      </footer>
    </div>
  );
}
