import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { analyzeModule } from './src/lib/parser/module-analyzer';
import { extractDependencies, resolveDependencyPath } from './src/lib/parser/dependency';
import { estimateTokens } from './src/lib/parser/token-estimator';
import {
  DEFAULT_EXCLUDED_DIRS,
  DEFAULT_EXCLUDED_EXTS,
  DEFAULT_MAX_FILE_SIZE_BYTES
} from './src/lib/config/constants';
import { ProjectAnalysisData, FileAnalysisInfo } from './src/lib/parser/types';

// --- 設定 ---
const TARGET_PROJECT_NAME = 'ai-development-context-optimizer';
const TESTS = [
  'src/lib/parser/__tests__/verify-compression.ts',
  'src/lib/formatters/__tests__/verify-audit.ts',
  'src/lib/formatters/__tests__/verify-deep-audit.ts',
  'src/lib/formatters/__tests__/verify-doc.ts',
  'src/lib/formatters/__tests__/verify-handover.ts',
  'src/lib/formatters/__tests__/verify-phase-summary.ts',
  'src/lib/formatters/__tests__/verify-transfer.ts'
];
const OUTPUT_DIR = path.resolve('ai_pipeline');

// --- ユーティリティ: ファイル木構造テキスト生成 (Node.js版) ---
function generateTreeTextNode(dirPath: string, prefix = ''): string {
  let text = '';
  const files = fs.readdirSync(dirPath).sort();
  const filtered = files.filter(f => {
    if (DEFAULT_EXCLUDED_DIRS.includes(f)) return false;
    const ext = path.extname(f).toLowerCase();
    if (DEFAULT_EXCLUDED_EXTS.has(ext)) return false;
    return true;
  });

  filtered.forEach((file, index) => {
    const isLast = index === filtered.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    text += `${prefix}${marker}${file}\n`;

    if (stat.isDirectory()) {
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      text += generateTreeTextNode(fullPath, nextPrefix);
    }
  });

  return text;
}

// --- ユーティリティ: プロジェクト内の全テキストファイル走査 ---
function getReadableFiles(dirPath: string, baseDir: string): { relativePath: string; absolutePath: string; size: number }[] {
  let results: { relativePath: string; absolutePath: string; size: number }[] = [];
  const list = fs.readdirSync(dirPath);

  list.forEach(file => {
    if (DEFAULT_EXCLUDED_DIRS.includes(file)) return;
    const absolutePath = path.join(dirPath, file);
    const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, '/');
    const stat = fs.statSync(absolutePath);

    if (stat.isDirectory()) {
      results = results.concat(getReadableFiles(absolutePath, baseDir));
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (!DEFAULT_EXCLUDED_EXTS.has(ext) && stat.size <= DEFAULT_MAX_FILE_SIZE_BYTES) {
        results.push({
          relativePath,
          absolutePath,
          size: stat.size
        });
      }
    }
  });

  return results;
}

// --- メイン実行処理 ---
async function main() {
  const startTime = Date.now();
  console.log('==================================================');
  console.log('   AI Development Context Optimizer - Verify All  ');
  console.log('==================================================\n');

  // 1. テストスイートの実行
  console.log('--- [1/3] Running Formatter and Parser Tests ---');
  const testResults: { name: string; success: boolean; output: string; error?: string }[] = [];
  let allPassed = true;

  for (const testFile of TESTS) {
    const name = path.basename(testFile);
    console.log(`Running ${name}...`);
    try {
      // execSync で子プロセスとしてテストを実行
      const output = execSync(`npx vite-node ${testFile}`, { encoding: 'utf-8', stdio: 'pipe' });
      testResults.push({ name, success: true, output });
      console.log(`  🟢 ${name} PASSED.`);
    } catch (e: any) {
      allPassed = false;
      const errorMsg = e.stderr || e.stdout || e.message;
      testResults.push({ name, success: false, output: e.stdout || '', error: errorMsg });
      console.error(`  🔴 ${name} FAILED.`);
    }
  }
  console.log();

  // 2. 本プロジェクト自身のファイル解析の実行
  console.log('--- [2/3] Analyzing Tool Project Itself ---');
  const projectRoot = path.resolve('.');
  const readableFiles = getReadableFiles(projectRoot, projectRoot);
  const allProjectPaths = readableFiles.map(f => f.relativePath);

  const fileAnalyses: FileAnalysisInfo[] = [];
  let totalBytes = 0;
  let totalTokens = 0;

  for (const file of readableFiles) {
    const content = fs.readFileSync(file.absolutePath, 'utf-8');
    const ext = path.extname(file.relativePath).toLowerCase();

    // 依存関係抽出
    const rawDeps = extractDependencies(content, ext);
    const resolvedDeps = rawDeps.map(depPath => 
      resolveDependencyPath(file.relativePath, depPath, allProjectPaths)
    );

    // ククラス・関数の解析
    const moduleAnalysis = analyzeModule(content, ext);

    // トークン推定
    const tokens = estimateTokens(content);

    fileAnalyses.push({
      path: file.relativePath,
      name: path.basename(file.relativePath),
      size: file.size,
      content,
      tokens,
      dependencies: resolvedDeps,
      analysis: moduleAnalysis
    });

    totalBytes += file.size;
    totalTokens += tokens;
  }

  const folderStructureText = TARGET_PROJECT_NAME + '/\n' + generateTreeTextNode(projectRoot);

  const projectAnalysisData: ProjectAnalysisData = {
    projectName: TARGET_PROJECT_NAME,
    files: fileAnalyses,
    folderStructureText,
    totalBytes,
    totalTokens
  };
  console.log(`Analyzed ${readableFiles.length} files. Total size: ${totalBytes} bytes. Est. tokens: ${totalTokens}.\n`);

  // 3. pipeline/ ディレクトリ配下への書き出し
  console.log('--- [3/3] Generating Pipeline Artifacts ---');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }

  // A. result.json (解析データJSON)
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'result.json'),
    JSON.stringify(projectAnalysisData, null, 2),
    'utf-8'
  );
  console.log('Generated: result.json');

  // B. test_report.md (テストレポート)
  let testReportMd = `# AI Pipeline - Test Report\n\n`;
  testReportMd += `- **Scan Timestamp**: ${new Date().toISOString()}\n`;
  testReportMd += `- **Total Tests Run**: ${TESTS.length}\n`;
  testReportMd += `- **Status**: ${allPassed ? '🟢 ALL PASSED' : '🔴 SOME TESTS FAILED'}\n\n`;
  testReportMd += `## Test Execution Summary\n\n`;
  testReportMd += `| Test File | Status | Duration |\n`;
  testReportMd += `| :--- | :--- | :--- |\n`;
  TESTS.forEach(test => {
    const baseName = path.basename(test);
    const result = testResults.find(r => r.name === baseName);
    const status = result?.success ? '🟢 PASS' : '🔴 FAIL';
    testReportMd += `| \`${test}\` | ${status} | - |\n`;
  });
  testReportMd += `\n## Console Outputs / Logs\n\n`;
  testResults.forEach(r => {
    testReportMd += `### ${r.name}\n\n`;
    if (r.success) {
      testReportMd += `\`\`\`plaintext\n${r.output.trim()}\n\`\`\`\n\n`;
    } else {
      testReportMd += `> [!CAUTION]\n> **Error output:**\n>\n> \`\`\`plaintext\n>${r.error?.split('\n').join('\n>')}\n> \`\`\`\n\n`;
    }
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'test_report.md'), testReportMd, 'utf-8');
  console.log('Generated: test_report.md');

  // C. log.md (実行ログ)
  const durationMs = Date.now() - startTime;
  let logMd = `# AI Pipeline - Execution Log\n\n`;
  logMd += `- **Timestamp**: ${new Date().toISOString()}\n`;
  logMd += `- **Action**: verify-all-tests-and-generate-pipeline\n`;
  logMd += `- **Total Execution Duration**: ${durationMs} ms\n`;
  logMd += `- **Analyzed Project Directory**: \`${projectRoot}\`\n`;
  logMd += `- **Total Files Count**: ${readableFiles.length} files\n`;
  logMd += `- **Total Project Bytes**: ${totalBytes} bytes\n`;
  logMd += `- **Estimated Total Tokens**: ${totalTokens} tokens\n\n`;
  logMd += `## Process Log Steps\n\n`;
  logMd += `1. **[INFO]** Sub-process tests sweep started.\n`;
  TESTS.forEach(test => {
    const baseName = path.basename(test);
    const r = testResults.find(res => res.name === baseName);
    logMd += `   - **[INFO]** ran test \`${baseName}\`. Success: ${r?.success}\n`;
  });
  logMd += `2. **[INFO]** Local project code static analyze started.\n`;
  logMd += `   - **[INFO]** traverse directories resolving dependencies...\n`;
  logMd += `   - **[INFO]** extracted classes, function nodes and parameters.\n`;
  logMd += `3. **[INFO]** File writing initiated to output directory: \`${OUTPUT_DIR}\`.\n`;
  logMd += `   - **[INFO]** wrote \`result.json\` (${(fs.statSync(path.join(OUTPUT_DIR, 'result.json')).size / 1024).toFixed(2)} KB)\n`;
  logMd += `   - **[INFO]** wrote \`test_report.md\`\n`;
  logMd += `   - **[INFO]** wrote \`log.md\`\n`;
  logMd += `   - **[INFO]** wrote \`development_chat_history.md\`\n`;
  logMd += `4. **[INFO]** Verification and pipeline artifact outputs completed successfully.\n`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'log.md'), logMd, 'utf-8');
  console.log('Generated: log.md');

  // D. development_chat_history.md (開発チャット履歴・引継ぎ履歴)
  let chatHistoryMd = `# AI Pipeline - Development Chat History\n\n`;
  chatHistoryMd += `## 1. 直近の開発サマリー (Phase 9 完了時点)\n\n`;
  chatHistoryMd += `### 完了事項\n`;
  chatHistoryMd += `- **Phase Summary Modeの構築 (\`src/lib/formatters/phase-summary.ts\`)**\n`;
  chatHistoryMd += `  - \`PROJECT_PLAN.md\` からの完了/未着手フェーズおよび全体進捗率の自動パース。\n`;
  chatHistoryMd += `  - 目標最大トークン制限に合わせた段階的な情報量制限（レベル0〜5）の自動縮退制御ロジックを実装。\n`;
  chatHistoryMd += `- **UI画面の拡張と統合 (\`src/app/App.tsx\`)**\n`;
  chatHistoryMd += `  - タブナビゲーションに「📋 フェーズ完了 (Phase Summary)」を追加。\n`;
  chatHistoryMd += `  - スライダーに連動したリアルタイムプレビュー、縮退レベルの動的計算、および1クリックコピー用クリップボードコピーUIボタンの統合。\n`;
  chatHistoryMd += `- **動作検証とテストスイートの構築 (\`verify-phase-summary.ts\`)**\n`;
  chatHistoryMd += `  - テスト用モックデータを用いて各レベルのしきい値に応じた境界値制御とトークン削減機能のアサーション検証をパス。\n\n`;
  chatHistoryMd += `## 2. 開発ログ履歴 (Change Log)\n\n`;
  
  const recordPath = path.resolve('C:/Users/tk030/Desktop/各種情報/Projects/AI開発コンテキスト最適化ツール/RECORD.md');
  if (fs.existsSync(recordPath)) {
    const recordContent = fs.readFileSync(recordPath, 'utf-8');
    const sections = recordContent.split('## 開発履歴 (Change Log)');
    if (sections.length > 1) {
      chatHistoryMd += `### 履歴記録 (RECORD.md より抜粋)\n\n`;
      chatHistoryMd += sections[1].split('## 各フェーズ進捗')[0].trim();
    }
  } else {
    chatHistoryMd += `*注: RECORD.md が見つかりませんでした。*\n`;
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'development_chat_history.md'), chatHistoryMd, 'utf-8');
  console.log('Generated: development_chat_history.md\n');

  console.log('==================================================');
  if (allPassed) {
    console.log('🎉 VERIFICATION AND PIPELINE RUN COMPLETED SUCCESSFULLY! 🎉');
    console.log('==================================================');
    process.exit(0);
  } else {
    console.error('❌ VERIFICATION COMPLETED WITH ERRORS! SOME TESTS FAILED. ❌');
    console.log('==================================================');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
