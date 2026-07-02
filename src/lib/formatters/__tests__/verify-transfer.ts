import { generateTransferPack } from '../transfer';
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
      size: 6000,
      content: `# Mock Project Plan
This is a mock project description for testing transition features. It has detailed planning items.

## 4. 工程管理表（進捗ステータス）
* **全体進捗率**: ▓▓▓▓▓▓░░░░ 60% (7/12 フェーズ完了)

| フェーズ | ステータス | タスク内容 |
| :--- | :--- | :--- |
| **Phase 1** | \`[x]\` 完了 | 基盤の設計・構築 |
| **Phase 2** | \`[x]\` 完了 | 解析エンジンの作成 |
| **Phase 3** | \`[ ]\` 未着手 | 移行モードの追加 |

## 5. 成功条件（DoD）
- 外部通信の完全遮断
- ローカルのみの動作確認
- 100%クライアントサイド解析
- ファイル分割設計の遵守
`,
      tokens: 1500,
      dependencies: []
    },
    {
      path: 'task.md',
      name: 'task.md',
      size: 2500,
      content: `# Task Checklist
- [x] Design initial workspace
- [x] Create file analyzer structure
- [x] Implement UI dashboard
- [x] Configure tailwind components
- [x] Setup static network scanning script
- [x] Build audit pack generator logic
- [x] Deliver handover preview tab
- [x] Write regression testing specs
- [x] Validate build static bundle
- [x] Push commits to origin main
- [x] Extra mock task for testing limits
- [/] Develop transfer pack formatter
- [ ] Create documentation exporter
- [ ] Implement final release assets
- [ ] Verify edge cases of token shrinkage
`,
      tokens: 900,
      dependencies: []
    },
    {
      path: 'RECORD.md',
      name: 'RECORD.md',
      size: 2000,
      content: `# Project Logs

## 技術選定
- 選定した理由と要件についての決定事項。
- TypeScript を用いた型安全な型定義の整備。
- showDirectoryPicker によるセキュアなローカル処理。
- UIの高速化のために Vite + React 構成を採用。
`,
      tokens: 800,
      dependencies: []
    }
  ];

  return {
    projectName: 'Verification Transfer Project',
    files,
    folderStructureText: 'mock-root/\n├── PROJECT_PLAN.md\n├── task.md\n└── RECORD.md',
    totalBytes: 10500,
    totalTokens: 3200
  };
}

function runTests() {
  console.log('=== START TRANSFER PACK GENERATION TESTING ===\n');

  const data = buildMockProjectData();

  // 1. 各レベルでのトークン数を動的に抽出
  const resL0 = generateTransferPack(data, { maxTokens: 10000 });
  const tok0 = resL0.estimatedTokens;
  assert(resL0.fallbackLevel === 0, 'Should start at level 0 with high token limit');

  const resL1 = generateTransferPack(data, { maxTokens: tok0 - 1 });
  const tok1 = resL1.estimatedTokens;
  assert(resL1.fallbackLevel >= 1, 'Limit below Level 0 should trigger fallback to 1+');

  const resL2 = generateTransferPack(data, { maxTokens: tok1 - 1 });
  const tok2 = resL2.estimatedTokens;
  assert(resL2.fallbackLevel >= 2, 'Limit below Level 1 should trigger fallback to 2+');

  const resL3 = generateTransferPack(data, { maxTokens: tok2 - 1 });
  const tok3 = resL3.estimatedTokens;
  assert(resL3.fallbackLevel >= 3, 'Limit below Level 2 should trigger fallback to 3+');

  const resL4 = generateTransferPack(data, { maxTokens: tok3 - 1 });
  const tok4 = resL4.estimatedTokens;
  assert(resL4.fallbackLevel >= 4, 'Limit below Level 3 should trigger fallback to 4+');

  const resL5 = generateTransferPack(data, { maxTokens: tok4 - 1 });
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
  console.log('Test 1: Generates full transfer summary (Level 0)');
  const testRes0 = generateTransferPack(data, { maxTokens: 10000 });
  assert(testRes0.fallbackLevel === 0, 'Should be Level 0');
  assert(testRes0.markdown.includes('Design initial workspace'), 'Should contain all completed tasks/features');
  assert(testRes0.markdown.includes('Create documentation exporter'), 'Should contain recommended next actions');
  assert(testRes0.markdown.includes('showDirectoryPicker によるセキュアなローカル処理。'), 'Should contain design decisions');
  assert(testRes0.markdown.includes('This is a mock project description for testing transition features.'), 'Should contain project summary description');
  assert(testRes0.markdown.includes('## Architecture'), 'Should contain Architecture section');

  // Test 2: Completed Features の数制限（レベル1）
  console.log('Test 2: Completed features limited to 10 items (Level 1)');
  const testRes1 = generateTransferPack(data, { maxTokens: tok0 - 1 });
  assert(testRes1.fallbackLevel === 1, 'Should fall back to level 1');
  assert(testRes1.markdown.includes('Design initial workspace'), 'Should keep first items');
  assert(testRes1.markdown.includes('omitted.'), 'Should contain ellipsis/omitted message for completed tasks');

  // Test 3: Completed Features の完全省略 ＆ Decisions 制限（レベル2）
  console.log('Test 3: Completed features omitted & Decisions limited (Level 2)');
  const testRes2 = generateTransferPack(data, { maxTokens: tok1 - 1 });
  assert(testRes2.fallbackLevel === 2, 'Should fall back to level 2');
  assert(!testRes2.markdown.includes('Design initial workspace'), 'Should not contain completed task details');
  assert(testRes2.markdown.includes('feature(s)/task(s) completed.'), 'Should contain summary count text');
  assert(testRes2.markdown.includes('showDirectoryPicker によるセキュアなローカル処理。'), 'Should still keep decisions (less than 5)');

  // Test 4: Feature List 簡略化 ＆ Actions/Constraints 制限（レベル3）
  console.log('Test 4: Feature List simplified & Next actions/constraints limited (Level 3)');
  const testRes3 = generateTransferPack(data, { maxTokens: tok2 - 1 });
  assert(testRes3.fallbackLevel === 3, 'Should fall back to level 3');
  assert(testRes3.markdown.includes('planned.'), 'Should show planned count/ellipsis');
  assert(testRes3.markdown.includes('omitted'), 'Should show constraints omitted message');
  // Feature list should contain only phase title without status
  assert(testRes3.markdown.includes('Phase 1: 基盤の設計・構築'), 'Should have phase title in list');

  // Test 5: Design Decisions の完全省略（レベル4）
  console.log('Test 5: Design Decisions section omitted (Level 4)');
  const testRes4 = generateTransferPack(data, { maxTokens: tok3 - 1 });
  assert(testRes4.fallbackLevel === 4, 'Should fall back to level 4');
  assert(!testRes4.markdown.includes('## Design Decisions'), 'Should completely omit Design Decisions section');

  // Test 6: 限界値テスト（レベル5: 最小構成）
  console.log('Test 6: Minimum fallback summary (Level 5)');
  const testRes5 = generateTransferPack(data, { maxTokens: tok4 - 1 });
  assert(testRes5.fallbackLevel === 5, 'Should fall back to level 5');
  assert(testRes5.markdown.includes('Client-side local execution workspace'), 'Should show simplified architecture');
  assert(!testRes5.markdown.includes('This is a mock project description for testing transition features.'), 'Should omit detailed project description text');

  console.log('\n================================================');
  console.log('🎉 TRANSFER PACK TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ TRANSFER PACK TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
