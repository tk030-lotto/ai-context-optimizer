import { useState, useMemo } from 'react';
import { traverseDirectory, generateTreeText, formatBytes, FileNode } from '../lib/parser/file-tree';
import { analyzeProject } from '../lib/parser/project-analyzer';
import { generateAuditPack } from '../lib/formatters/audit';
import { generateDeepAuditPack } from '../lib/formatters/deep-audit';
import { generateHandoverPack } from '../lib/formatters/handover';
import { generateTransferPack } from '../lib/formatters/transfer';
import { generateDocPack } from '../lib/formatters/doc';
import { generatePhaseSummaryPack } from '../lib/formatters/phase-summary';
import { calculateReadTime } from '../lib/parser/token-estimator';
import { ProjectAnalysisData } from '../lib/parser/types';


export default function App() {
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [treeText, setTreeText] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<{ fileCount: number; dirCount: number; totalBytes: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // 新設ステート
  const [projectData, setProjectData] = useState<ProjectAnalysisData | null>(null);
  const [activeTab, setActiveTab] = useState<'tree' | 'audit' | 'deep-audit' | 'handover' | 'transfer' | 'doc' | 'phase-summary'>('tree');
  const [targetMaxTokens, setTargetMaxTokens] = useState<number>(4000);
  const [auditCopySuccess, setAuditCopySuccess] = useState(false);
  const [selectedDeepAuditFile, setSelectedDeepAuditFile] = useState<string>('');
  const [deepAuditCopySuccess, setDeepAuditCopySuccess] = useState(false);
  const [handoverCopySuccess, setHandoverCopySuccess] = useState(false);
  const [transferCopySuccess, setTransferCopySuccess] = useState(false);
  const [docCopySuccess, setDocCopySuccess] = useState(false);
  const [phaseSummaryCopySuccess, setPhaseSummaryCopySuccess] = useState(false);

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
        setAuditCopySuccess(false);
        setDeepAuditCopySuccess(false);
        setHandoverCopySuccess(false);
        setTransferCopySuccess(false);
        setDocCopySuccess(false);
        setPhaseSummaryCopySuccess(false);

        // 走査の実行
        const tree = await traverseDirectory(handle);

        // 木構造テキストの生成
        const text = generateTreeText(tree);
        setTreeText(text);

        // サマリー計算
        const summary = calculateSummary(tree);
        setScanSummary(summary);

        // プロジェクト全体を解析（依存関係・モジュール仕様・トークン推定の集約）
        const analyzed = await analyzeProject(handle.name, tree, text);
        setProjectData(analyzed);

        if (analyzed.files.length > 0) {
          // テキストファイルの中から拡張子を見て最初の適当なソースコードファイルを設定
          const sourceFile = analyzed.files.find(f => {
            const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
            return ['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext);
          }) || analyzed.files[0];
          setSelectedDeepAuditFile(sourceFile.path);
        }

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
    setProjectData(null);
    setActiveTab('tree');
    setSelectedDeepAuditFile('');
  };

  const handleCopyAudit = async (markdownText: string) => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setAuditCopySuccess(true);
      setTimeout(() => setAuditCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Audit Pack: ', err);
      alert('コピーに失敗しました。');
    }
  };

  const handleCopyDeepAudit = async (markdownText: string) => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setDeepAuditCopySuccess(true);
      setTimeout(() => setDeepAuditCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Deep Audit Pack: ', err);
      alert('コピーに失敗しました。');
    }
  };

  const handleCopyHandover = async (markdownText: string) => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setHandoverCopySuccess(true);
      setTimeout(() => setHandoverCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Handover Pack: ', err);
      alert('コピーに失敗しました。');
    }
  };

  const handleCopyTransfer = async (markdownText: string) => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setTransferCopySuccess(true);
      setTimeout(() => setTransferCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Transfer Pack: ', err);
      alert('コピーに失敗しました。');
    }
  };

  const handleCopyDoc = async (markdownText: string) => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setDocCopySuccess(true);
      setTimeout(() => setDocCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Doc Pack: ', err);
      alert('コピーに失敗しました。');
    }
  };

  const handleCopyPhaseSummary = async (markdownText: string) => {
    if (!markdownText) return;
    try {
      await navigator.clipboard.writeText(markdownText);
      setPhaseSummaryCopySuccess(true);
      setTimeout(() => setPhaseSummaryCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Phase Summary Pack: ', err);
      alert('コピーに失敗しました。');
    }
  };

  // Audit Pack の動的計算
  const auditPackResult = useMemo(() => {
    if (!projectData) return null;
    return generateAuditPack(projectData, { maxTokens: targetMaxTokens });
  }, [projectData, targetMaxTokens]);

  const auditReadTime = useMemo(() => {
    if (!auditPackResult) return null;
    return calculateReadTime(auditPackResult.estimatedTokens, auditPackResult.markdown.length);
  }, [auditPackResult]);

  // Deep Audit Pack の動的計算
  const deepAuditPackResult = useMemo(() => {
    if (!projectData || !selectedDeepAuditFile) return null;
    return generateDeepAuditPack(projectData, selectedDeepAuditFile, { maxTokens: targetMaxTokens });
  }, [projectData, selectedDeepAuditFile, targetMaxTokens]);

  const deepAuditReadTime = useMemo(() => {
    if (!deepAuditPackResult) return null;
    return calculateReadTime(deepAuditPackResult.estimatedTokens, deepAuditPackResult.markdown.length);
  }, [deepAuditPackResult]);

  // Handover Pack の動的計算
  const handoverPackResult = useMemo(() => {
    if (!projectData) return null;
    return generateHandoverPack(projectData, { maxTokens: targetMaxTokens });
  }, [projectData, targetMaxTokens]);

  const handoverReadTime = useMemo(() => {
    if (!handoverPackResult) return null;
    return calculateReadTime(handoverPackResult.estimatedTokens, handoverPackResult.markdown.length);
  }, [handoverPackResult]);

  // Transfer Pack の動的計算
  const transferPackResult = useMemo(() => {
    if (!projectData) return null;
    return generateTransferPack(projectData, { maxTokens: targetMaxTokens });
  }, [projectData, targetMaxTokens]);

  const transferReadTime = useMemo(() => {
    if (!transferPackResult) return null;
    return calculateReadTime(transferPackResult.estimatedTokens, transferPackResult.markdown.length);
  }, [transferPackResult]);

  // Doc Pack の動的計算
  const docPackResult = useMemo(() => {
    if (!projectData) return null;
    return generateDocPack(projectData, { maxTokens: targetMaxTokens });
  }, [projectData, targetMaxTokens]);

  const docReadTime = useMemo(() => {
    if (!docPackResult) return null;
    return calculateReadTime(docPackResult.estimatedTokens, docPackResult.markdown.length);
  }, [docPackResult]);

  // Phase Summary Pack の動的計算
  const phaseSummaryPackResult = useMemo(() => {
    if (!projectData) return null;
    return generatePhaseSummaryPack(projectData, { maxTokens: targetMaxTokens });
  }, [projectData, targetMaxTokens]);

  const phaseSummaryReadTime = useMemo(() => {
    if (!phaseSummaryPackResult) return null;
    return calculateReadTime(phaseSummaryPackResult.estimatedTokens, phaseSummaryPackResult.markdown.length);
  }, [phaseSummaryPackResult]);

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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500 animate-ping" />
              Phase 4 Engine Ready
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

            {/* Tab navigation Switcher */}
            <div className="flex border-b border-slate-800/80 bg-slate-900/20 rounded-t-2xl overflow-hidden">
              <button
                onClick={() => setActiveTab('tree')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'tree'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                🌳 プロジェクトツリー
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'audit'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                🔍 監査用パック (Audit Pack)
              </button>
              <button
                onClick={() => setActiveTab('deep-audit')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'deep-audit'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                🔍 詳細監査用パック (Deep Audit Pack)
              </button>
              <button
                onClick={() => setActiveTab('handover')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'handover'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                🤝 引継ぎ用パック (Handover Pack)
              </button>
              <button
                onClick={() => setActiveTab('transfer')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'transfer'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                🔄 AI移行用パック (Transfer Pack)
              </button>
              <button
                onClick={() => setActiveTab('doc')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'doc'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                📄 ドキュメントパック (Doc Pack)
              </button>
              <button
                onClick={() => setActiveTab('phase-summary')}
                className={`flex-1 md:flex-initial px-6 py-3 text-sm font-bold transition-all duration-300 border-b-2 ${
                  activeTab === 'phase-summary'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                } cursor-pointer`}
              >
                📋 フェーズ完了 (Phase Summary)
              </button>
            </div>

            {/* Tree View Panel */}
            {activeTab === 'tree' && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-fadeIn">
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
            )}

            {/* Audit Pack View Panel */}
            {activeTab === 'audit' && auditPackResult && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-6 animate-fadeIn">
                
                {/* Token limits controls & Stats info */}
                <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">目標最大トークン制限調整</h4>
                      <p className="text-xs text-slate-400">監査パックの最大サイズを定義し、情報を自動的に縮退します。</p>
                    </div>
                    
                    {/* Token Slider Controls */}
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="500"
                        value={targetMaxTokens}
                        onChange={(e) => setTargetMaxTokens(Number(e.target.value))}
                        className="w-full md:w-48 accent-brand-500"
                      />
                      <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded border border-brand-500/20 whitespace-nowrap">
                        {targetMaxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-850 my-2" />

                  {/* Estimation Results Panel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">推定トークン数</span>
                      <span className="text-lg font-black text-white font-mono">{auditPackResult.estimatedTokens.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">適用された縮退レベル</span>
                      <span className="text-lg font-black text-brand-400 font-mono">
                        Level {auditPackResult.fallbackLevel}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          {auditPackResult.fallbackLevel === 0 ? '(フル出力)' :
                           auditPackResult.fallbackLevel === 1 ? '(コメント省略)' :
                           auditPackResult.fallbackLevel === 2 ? '(詳細仕様省略)' :
                           auditPackResult.fallbackLevel === 3 ? '(一部ファイル除外)' :
                           auditPackResult.fallbackLevel === 4 ? '(定義マップ省略)' : '(ツリー階層制限)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">AI処理想定時間</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{auditReadTime?.aiTimeFormatted}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">人間読了想定時間</span>
                      <span className="text-lg font-black text-teal-400 font-mono">{auditReadTime?.humanTimeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Markdown View Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">🔍 監査パック (Markdown) プレビュー</span>
                    <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">コピー＆ペースト用</span>
                  </div>
                  <button
                    onClick={() => handleCopyAudit(auditPackResult.markdown)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                      auditCopySuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                    } cursor-pointer`}
                  >
                    {auditCopySuccess ? '✓ コピー完了！' : 'Audit Pack をコピー'}
                  </button>
                </div>

                {/* Markdown preview rendering */}
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-slate-300 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{auditPackResult.markdown}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Deep Audit Pack View Panel */}
            {activeTab === 'deep-audit' && deepAuditPackResult && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-6 animate-fadeIn">
                
                {/* Target file selector dropdown */}
                <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">詳細監査対象ファイル選択</h4>
                      <p className="text-xs text-slate-400">特定モジュールを選択して詳細情報を生成します。</p>
                    </div>
                    
                    <div className="w-full md:w-auto">
                      <select
                        value={selectedDeepAuditFile}
                        onChange={(e) => setSelectedDeepAuditFile(e.target.value)}
                        className="w-full md:w-80 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
                      >
                        {projectData?.files.map(file => (
                          <option key={file.path} value={file.path}>
                            {file.path} ({formatBytes(file.size)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-slate-850 my-2" />

                  {/* Token limits controls & Stats info */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">目標最大トークン制限調整</h4>
                      <p className="text-xs text-slate-400">詳細監査パックの最大サイズを定義し、情報を自動的に縮退します。</p>
                    </div>
                    
                    {/* Token Slider Controls */}
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="500"
                        value={targetMaxTokens}
                        onChange={(e) => setTargetMaxTokens(Number(e.target.value))}
                        className="w-full md:w-48 accent-brand-500"
                      />
                      <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded border border-brand-500/20 whitespace-nowrap">
                        {targetMaxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-850 my-2" />

                  {/* Estimation Results Panel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">推定トークン数</span>
                      <span className="text-lg font-black text-white font-mono">{deepAuditPackResult.estimatedTokens.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">適用された縮退レベル</span>
                      <span className="text-lg font-black text-brand-400 font-mono">
                        Level {deepAuditPackResult.fallbackLevel}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          {deepAuditPackResult.fallbackLevel === 0 ? '(フル出力)' :
                           deepAuditPackResult.fallbackLevel === 1 ? '(コメント省略)' :
                           deepAuditPackResult.fallbackLevel === 2 ? '(スケルトン出力)' :
                           deepAuditPackResult.fallbackLevel === 3 ? '(関連/依存省略)' :
                           deepAuditPackResult.fallbackLevel === 4 ? '(詳細シグネチャ省略)' : '(コード完全省略)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">AI処理想定時間</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{deepAuditReadTime?.aiTimeFormatted}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">人間読了想定時間</span>
                      <span className="text-lg font-black text-teal-400 font-mono">{deepAuditReadTime?.humanTimeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Markdown View Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">🔍 詳細監査パック (Markdown) プレビュー</span>
                    <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">コピー＆ペースト用</span>
                  </div>
                  <button
                    onClick={() => handleCopyDeepAudit(deepAuditPackResult.markdown)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                      deepAuditCopySuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                    } cursor-pointer`}
                  >
                    {deepAuditCopySuccess ? '✓ コピー完了！' : 'Deep Audit Pack をコピー'}
                  </button>
                </div>

                {/* Markdown preview rendering */}
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-slate-300 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{deepAuditPackResult.markdown}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Handover Pack View Panel */}
            {activeTab === 'handover' && handoverPackResult && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-6 animate-fadeIn">
                
                {/* Token limits controls & Stats info */}
                <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">目標最大トークン制限調整</h4>
                      <p className="text-xs text-slate-400">引継ぎパックの最大サイズを定義し、情報を自動的に縮退します。</p>
                    </div>
                    
                    {/* Token Slider Controls */}
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="500"
                        value={targetMaxTokens}
                        onChange={(e) => setTargetMaxTokens(Number(e.target.value))}
                        className="w-full md:w-48 accent-brand-500"
                      />
                      <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded border border-brand-500/20 whitespace-nowrap">
                        {targetMaxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-850 my-2" />

                  {/* Estimation Results Panel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">推定トークン数</span>
                      <span className="text-lg font-black text-white font-mono">{handoverPackResult.estimatedTokens.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">適用された縮退レベル</span>
                      <span className="text-lg font-black text-brand-400 font-mono">
                        Level {handoverPackResult.fallbackLevel}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          {handoverPackResult.fallbackLevel === 0 ? '(フル出力)' :
                           handoverPackResult.fallbackLevel === 1 ? '(完了タスク制限)' :
                           handoverPackResult.fallbackLevel === 2 ? '(完了タスク省略)' :
                           handoverPackResult.fallbackLevel === 3 ? '(予定/制約制限)' :
                           handoverPackResult.fallbackLevel === 4 ? '(課題省略)' : '(最小構成)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">AI処理想定時間</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{handoverReadTime?.aiTimeFormatted}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">人間読了想定時間</span>
                      <span className="text-lg font-black text-teal-400 font-mono">{handoverReadTime?.humanTimeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Markdown View Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">🤝 引継ぎ用パック (Markdown) プレビュー</span>
                    <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">コピー＆ペースト用</span>
                  </div>
                  <button
                    onClick={() => handleCopyHandover(handoverPackResult.markdown)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                      handoverCopySuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                    } cursor-pointer`}
                  >
                    {handoverCopySuccess ? '✓ コピー完了！' : 'Handover Pack をコピー'}
                  </button>
                </div>

                {/* Markdown preview rendering */}
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-slate-300 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{handoverPackResult.markdown}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Transfer Pack View Panel */}
            {activeTab === 'transfer' && transferPackResult && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-6 animate-fadeIn">
                
                {/* Token limits controls & Stats info */}
                <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">目標最大トークン制限調整</h4>
                      <p className="text-xs text-slate-400">移行パックの最大サイズを定義し、情報を自動的に縮退します。</p>
                    </div>
                    
                    {/* Token Slider Controls */}
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="500"
                        value={targetMaxTokens}
                        onChange={(e) => setTargetMaxTokens(Number(e.target.value))}
                        className="w-full md:w-48 accent-brand-500"
                      />
                      <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded border border-brand-500/20 whitespace-nowrap">
                        {targetMaxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-850 my-2" />

                  {/* Estimation Results Panel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">推定トークン数</span>
                      <span className="text-lg font-black text-white font-mono">{transferPackResult.estimatedTokens.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">適用された縮退レベル</span>
                      <span className="text-lg font-black text-brand-400 font-mono">
                        Level {transferPackResult.fallbackLevel}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          {transferPackResult.fallbackLevel === 0 ? '(フル出力)' :
                           transferPackResult.fallbackLevel === 1 ? '(完了タスク制限)' :
                           transferPackResult.fallbackLevel === 2 ? '(完了省略/決定制限)' :
                           transferPackResult.fallbackLevel === 3 ? '(機能簡略/アクション制限)' :
                           transferPackResult.fallbackLevel === 4 ? '(決定省略)' : '(最小構成)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">AI処理想定時間</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{transferReadTime?.aiTimeFormatted}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">人間読了想定時間</span>
                      <span className="text-lg font-black text-teal-400 font-mono">{transferReadTime?.humanTimeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Markdown View Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">🔄 AI移行用パック (Markdown) プレビュー</span>
                    <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">コピー＆ペースト用</span>
                  </div>
                  <button
                    onClick={() => handleCopyTransfer(transferPackResult.markdown)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                      transferCopySuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                    } cursor-pointer`}
                  >
                    {transferCopySuccess ? '✓ コピー完了！' : 'Transfer Pack をコピー'}
                  </button>
                </div>

                {/* Markdown preview rendering */}
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-slate-300 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{transferPackResult.markdown}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Doc Pack View Panel */}
            {activeTab === 'doc' && docPackResult && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-6 animate-fadeIn">
                
                {/* Token limits controls & Stats info */}
                <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">目標最大トークン制限調整</h4>
                      <p className="text-xs text-slate-400">ドキュメントパックの最大サイズを定義し、情報を自動的に縮退します。</p>
                    </div>
                    
                    {/* Token Slider Controls */}
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="500"
                        value={targetMaxTokens}
                        onChange={(e) => setTargetMaxTokens(Number(e.target.value))}
                        className="w-full md:w-48 accent-brand-500"
                      />
                      <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded border border-brand-500/20 whitespace-nowrap">
                        {targetMaxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-850 my-2" />

                  {/* Estimation Results Panel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">推定トークン数</span>
                      <span className="text-lg font-black text-white font-mono">{docPackResult.estimatedTokens.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">適用された縮退レベル</span>
                      <span className="text-lg font-black text-brand-400 font-mono">
                        Level {docPackResult.fallbackLevel}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          {docPackResult.fallbackLevel === 0 ? '(フル出力)' :
                           docPackResult.fallbackLevel === 1 ? '(技術ハイライト制限)' :
                           docPackResult.fallbackLevel === 2 ? '(主要機能省略)' :
                           docPackResult.fallbackLevel === 3 ? '(概要/背景制限)' :
                           docPackResult.fallbackLevel === 4 ? '(将来計画制限)' : '(最小構成)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">AI処理想定時間</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{docReadTime?.aiTimeFormatted}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">人間読了想定時間</span>
                      <span className="text-lg font-black text-teal-400 font-mono">{docReadTime?.humanTimeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Markdown View Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">📄 ドキュメントパック (Markdown) プレビュー</span>
                    <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">コピー＆ペースト用</span>
                  </div>
                  <button
                    onClick={() => handleCopyDoc(docPackResult.markdown)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                      docCopySuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                    } cursor-pointer`}
                  >
                    {docCopySuccess ? '✓ コピー完了！' : 'Doc Pack をコピー'}
                  </button>
                </div>

                {/* Markdown preview rendering */}
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-slate-300 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{docPackResult.markdown}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Phase Summary Pack View Panel */}
            {activeTab === 'phase-summary' && phaseSummaryPackResult && (
              <div className="bg-slate-900/40 border border-t-0 border-slate-800 rounded-b-3xl p-6 backdrop-blur-md shadow-2xl space-y-6 animate-fadeIn">
                
                {/* Token limits controls & Stats info */}
                <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">目標最大トークン制限調整</h4>
                      <p className="text-xs text-slate-400">フェーズ完了サマリーパックの最大サイズを定義し、情報を自動的に縮退します。</p>
                    </div>
                    
                    {/* Token Slider Controls */}
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="500"
                        value={targetMaxTokens}
                        onChange={(e) => setTargetMaxTokens(Number(e.target.value))}
                        className="w-full md:w-48 accent-brand-500"
                      />
                      <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded border border-brand-500/20 whitespace-nowrap">
                        {targetMaxTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-850 my-2" />

                  {/* Estimation Results Panel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">推定トークン数</span>
                      <span className="text-lg font-black text-white font-mono">{phaseSummaryPackResult.estimatedTokens.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">適用された縮退レベル</span>
                      <span className="text-lg font-black text-brand-400 font-mono">
                        Level {phaseSummaryPackResult.fallbackLevel}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          {phaseSummaryPackResult.fallbackLevel === 0 ? '(フル出力)' :
                           phaseSummaryPackResult.fallbackLevel === 1 ? '(完了タスク制限)' :
                           phaseSummaryPackResult.fallbackLevel === 2 ? '(詳細仕様省略)' :
                           phaseSummaryPackResult.fallbackLevel === 3 ? '(予定タスク制限)' :
                           phaseSummaryPackResult.fallbackLevel === 4 ? '(主要ファイル制限)' : '(最小構成)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">AI処理想定時間</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{phaseSummaryReadTime?.aiTimeFormatted}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">人間読了想定時間</span>
                      <span className="text-lg font-black text-teal-400 font-mono">{phaseSummaryReadTime?.humanTimeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Markdown View Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">📋 フェーズ完了サマリー (Markdown) プレビュー</span>
                    <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded border border-slate-700">コピー＆ペースト用</span>
                  </div>
                  <button
                    onClick={() => handleCopyPhaseSummary(phaseSummaryPackResult.markdown)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-300 shadow-md ${
                      phaseSummaryCopySuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-brand-600 hover:bg-brand-500 hover:shadow-brand-500/10'
                    } cursor-pointer`}
                  >
                    {phaseSummaryCopySuccess ? '✓ コピー完了！' : 'Phase Summary Pack をコピー'}
                  </button>
                </div>

                {/* Markdown preview rendering */}
                <div className="relative">
                  <pre className="text-left text-xs font-mono bg-slate-950 p-5 rounded-2xl border border-slate-900 text-slate-300 overflow-auto max-h-[480px] leading-relaxed selection:bg-brand-800 selection:text-white">
                    <code>{phaseSummaryPackResult.markdown}</code>
                  </pre>
                </div>
              </div>
            )}
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

