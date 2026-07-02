import { generatePhaseSummaryPack } from '../phase-summary';
import { ProjectAnalysisData } from '../../parser/types';

// --- アサーションヘルパー ---
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// --- 検証用モックデータの構築 ---
function buildMockProjectData(): ProjectAnalysisData {
  const files: any[] = [
    {
      path: 'PROJECT_PLAN.md',
      name: 'PROJECT_PLAN.md',
      size: 5000,
      content: `# Mock Project Plan

## 1. プロジェクト概要
これはテスト用のモックプロジェクト計画書です。

* **全体進捗率**: ▓▓▓▓▓▓▓▓░░ 66% (8/12 フェーズ完了)

| フェーズ | ステータス | タスク内容 |
| :--- | :--- | :--- |
| **Phase 1** | \`[x]\` 完了 | 基盤環境の構築 |
| **Phase 2** | \`[x]\` 完了 | コア解析エンジンの実装 |
| **Phase 8** | \`[x]\` 完了 | ドキュメントパック機能の実装 |
| **Phase 9** | \`[ ]\` 未着手 | フェーズ完了機能の実装 |
| **Phase 10**| \`[ ]\` 未着手 | 総合テストとデバッグ |
`,
      tokens: 1200,
      dependencies: []
    },
    {
      path: 'src/lib/formatters/phase-summary.ts',
      name: 'phase-summary.ts',
      size: 8000,
      content: '// Mock content of phase-summary.ts',
      tokens: 1500,
      dependencies: [],
      analysis: {
        classes: [
          { name: 'PhaseSummaryPack' },
          { name: 'DummyClassA' },
          { name: 'DummyClassB' },
          { name: 'DummyClassC' },
          { name: 'DummyClassD' }
        ],
        functions: [
          { name: 'generatePhaseSummaryPack' },
          { name: 'buildMarkdownForLevel' },
          { name: 'helperFunctionA' },
          { name: 'helperFunctionB' },
          { name: 'helperFunctionC' },
          { name: 'helperFunctionD' },
          { name: 'helperFunctionE' }
        ],
        imports: [],
        exports: []
      }
    },
    {
      path: 'src/app/App.tsx',
      name: 'App.tsx',
      size: 12000,
      content: '// Mock content of App.tsx',
      tokens: 2200,
      dependencies: [],
      analysis: {
        classes: [
          { name: 'AppContainer' },
          { name: 'TabController' }
        ],
        functions: [
          { name: 'App' },
          { name: 'handleCopy' },
          { name: 'renderTabs' },
          { name: 'renderContent' },
          { name: 'fetchProjectData' },
          { name: 'calculateStats' }
        ],
        imports: [],
        exports: []
      }
    }
  ];

  return {
    projectName: 'Verification Phase Summary Project',
    files,
    folderStructureText: 'mock-root/\n├── PROJECT_PLAN.md\n└── src/\n    ├── app/\n    │   └── App.tsx\n    └── lib/\n        └── formatters/\n            └── phase-summary.ts',
    totalBytes: 25000,
    totalTokens: 4900
  };
}

function runTests() {
  console.log('=== START PHASE SUMMARY PACK GENERATION TESTING ===\n');

  const data = buildMockProjectData();

  // 1. 各レベルでのトークン数を動的に抽出
  const resL0 = generatePhaseSummaryPack(data, { maxTokens: 15000 });
  const tok0 = resL0.estimatedTokens;
  assert(resL0.fallbackLevel === 0, 'Should start at level 0 with high token limit');

  const resL1 = generatePhaseSummaryPack(data, { maxTokens: tok0 - 1 });
  const tok1 = resL1.estimatedTokens;
  assert(resL1.fallbackLevel >= 1, 'Limit below Level 0 should trigger fallback to 1+');

  const resL2 = generatePhaseSummaryPack(data, { maxTokens: tok1 - 1 });
  const tok2 = resL2.estimatedTokens;
  assert(resL2.fallbackLevel >= 2, 'Limit below Level 1 should trigger fallback to 2+');

  const resL3 = generatePhaseSummaryPack(data, { maxTokens: tok2 - 1 });
  const tok3 = resL3.estimatedTokens;
  assert(resL3.fallbackLevel >= 3, 'Limit below Level 2 should trigger fallback to 3+');

  const resL4 = generatePhaseSummaryPack(data, { maxTokens: tok3 - 1 });
  const tok4 = resL4.estimatedTokens;
  assert(resL4.fallbackLevel >= 4, 'Limit below Level 3 should trigger fallback to 4+');

  const resL5 = generatePhaseSummaryPack(data, { maxTokens: tok4 - 1 });
  const tok5 = resL5.estimatedTokens;
  assert(resL5.fallbackLevel === 5, 'Limit below Level 4 should trigger fallback to 5');

  console.log(`Token sizes at each fallback level:`);
  console.log(`- Level 0: ${tok0}`);
  console.log(`- Level 1: ${tok1}`);
  console.log(`- Level 2: ${tok2}`);
  console.log(`- Level 3: ${tok3}`);
  console.log(`- Level 4: ${tok4}`);
  console.log(`- Level 5: ${tok5}`);

  // Test 1: 十分に大きいトークン制限（縮退レベル0: フル）
  console.log('Test 1: Generates full summary (Level 0)');
  const testRes0 = generatePhaseSummaryPack(data, { maxTokens: 15000 });
  assert(testRes0.fallbackLevel === 0, 'Should be Level 0');
  assert(testRes0.markdown.includes('# 【引継ぎ】Verification Phase Summary Project - Phase 8 完了'), 'Should contain main title');
  assert(testRes0.markdown.includes('## 1. 完了事項 (Completed)'), 'Should contain Completed section');
  assert(testRes0.markdown.includes('## 2. 現在のコード状態 (Current Status)'), 'Should contain Current Status section');
  assert(testRes0.markdown.includes('## 3. 次フェーズのタスク (Next Actions)'), 'Should contain Next Actions section');
  assert(testRes0.markdown.includes('Phase 8 [完了]**: ドキュメントパック機能の実装'), 'Should list Phase 8');
  assert(testRes0.markdown.includes('Phase 1 [完了]**'), 'Should list Phase 1');
  assert(testRes0.markdown.includes('generatePhaseSummaryPack'), 'Should contain function name in Level 0 code status');

  // Test 2: 完了事項の制限（レベル1）
  console.log('Test 2: Completed tasks limited (Level 1)');
  const testRes1 = generatePhaseSummaryPack(data, { maxTokens: tok0 - 1 });
  assert(testRes1.fallbackLevel === 1, 'Should fall back to level 1');
  assert(testRes1.markdown.includes('Phase 8 [完了]**: ドキュメントパック機能の実装'), 'Should keep latest phase detail');
  assert(testRes1.markdown.includes('過去完了分: Phase 1, Phase 2'), 'Should summarize older phases');

  // Test 3: コード状態におけるモジュール詳細の省略（レベル2）
  console.log('Test 3: Module analysis detail omitted in current status (Level 2)');
  const testRes2 = generatePhaseSummaryPack(data, { maxTokens: tok1 - 1 });
  assert(testRes2.fallbackLevel === 2, 'Should fall back to level 2');
  assert(!testRes2.markdown.includes('generatePhaseSummaryPack'), 'Should omit function names in Level 2+ code status');
  assert(testRes2.markdown.includes('phase-summary.ts'), 'Should still keep filenames');

  // Test 4: 次フェーズタスクの制限（レベル3）
  console.log('Test 4: Pending tasks limited (Level 3)');
  const testRes3 = generatePhaseSummaryPack(data, { maxTokens: tok2 - 1 });
  assert(testRes3.fallbackLevel === 3, 'Should fall back to level 3');
  assert(testRes3.markdown.includes('Phase 9 [未着手]**: フェーズ完了機能の実装'), 'Should keep next phase detail');
  assert(testRes3.markdown.includes('以降の計画: Phase 10'), 'Should summarize later phases');

  // Test 5: コード状態ファイル一覧の省略（レベル4）
  console.log('Test 5: File list simplified to major only (Level 4)');
  const testRes4 = generatePhaseSummaryPack(data, { maxTokens: tok3 - 1 });
  assert(testRes4.fallbackLevel === 4, 'Should fall back to level 4');
  assert(!testRes4.markdown.includes('PROJECT_PLAN.md ('), 'Should omit PROJECT_PLAN.md from list, showing only code files');

  // Test 6: 最小限サマリー（レベル5）
  console.log('Test 6: Minimum fallback summary (Level 5)');
  const testRes5 = generatePhaseSummaryPack(data, { maxTokens: tok4 - 1 });
  assert(testRes5.fallbackLevel === 5, 'Should fall back to level 5');
  assert(testRes5.markdown.includes('Phase 8 までの開発'), 'Should keep short summary of completed work');
  assert(testRes5.markdown.includes('主要ファイル構成**: 全 3 ファイル'), 'Should show summary stats only');
  assert(testRes5.markdown.includes('次回タスク: Phase 9'), 'Should show short summary of next tasks');

  console.log('\n================================================');
  console.log('🎉 PHASE SUMMARY PACK TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ PHASE SUMMARY PACK TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
