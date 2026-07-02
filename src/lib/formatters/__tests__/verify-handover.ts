import { generateHandoverPack } from '../handover';
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

This is a mock project description for testing. It has multiple phases and guidelines.

## 4. 工程管理表（進捗ステータス）
* **全体進捗率**: ▓▓▓▓▓░░░░░ 50% (6/12 フェーズ完了)

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

## 7. 現在地と次回タスク
* **【現在地】**：Phase 5 完了
* **【次回タスク】**：
  - Phase 6: Handover機能の実装
`,
      tokens: 1200,
      dependencies: []
    },
    {
      path: 'task.md',
      name: 'task.md',
      size: 2000,
      content: `# Task Checklist

- [x] Setup repository and routing
- [x] Implement token counter UI
- [x] Design file parser structures
- [x] Build audit pack generator
- [x] Support deep audit custom mode
- [x] Set up batch execute helper
- [x] Enable drag and drop picker
- [x] Create check-no-network verify script
- [x] Configure tailwindcss styles
- [x] Setup project workspace config
- [x] Prepare manual test specs
- [x] Implement folder structure printer
- [/] Build Chat Handover Formatter
- [ ] Create transfer mode generator
- [ ] Support external library summary tab
- [ ] Add known bugs checklist
`,
      tokens: 800,
      dependencies: []
    },
    {
      path: 'RECORD.md',
      name: 'RECORD.md',
      size: 1500,
      content: `# Project Logs

## Known Issues
- Large directories might exceed default token limits
- Browser compatibility with legacy showDirectoryPicker
- Async race condition during rapid directory scan
`,
      tokens: 600,
      dependencies: []
    }
  ];

  return {
    projectName: 'Verification Handover Project',
    files,
    folderStructureText: 'mock-root/\n├── PROJECT_PLAN.md\n├── task.md\n└── RECORD.md',
    totalBytes: 8500,
    totalTokens: 2600
  };
}

function runTests() {
  console.log('=== START HANDOVER PACK GENERATION TESTING ===\n');

  const data = buildMockProjectData();

  // 1. 各レベルでのトークン数を動的に抽出
  const resL0 = generateHandoverPack(data, { maxTokens: 10000 });
  const tok0 = resL0.estimatedTokens;
  assert(resL0.fallbackLevel === 0, 'Should start at level 0 with high token limit');

  const resL1 = generateHandoverPack(data, { maxTokens: tok0 - 1 });
  const tok1 = resL1.estimatedTokens;
  assert(resL1.fallbackLevel >= 1, 'Limit below Level 0 should trigger fallback to 1+');

  const resL2 = generateHandoverPack(data, { maxTokens: tok1 - 1 });
  const tok2 = resL2.estimatedTokens;
  assert(resL2.fallbackLevel >= 2, 'Limit below Level 1 should trigger fallback to 2+');

  const resL3 = generateHandoverPack(data, { maxTokens: tok2 - 1 });
  const tok3 = resL3.estimatedTokens;
  assert(resL3.fallbackLevel >= 3, 'Limit below Level 2 should trigger fallback to 3+');

  const resL4 = generateHandoverPack(data, { maxTokens: tok3 - 1 });
  const tok4 = resL4.estimatedTokens;
  assert(resL4.fallbackLevel >= 4, 'Limit below Level 3 should trigger fallback to 4+');

  const resL5 = generateHandoverPack(data, { maxTokens: tok4 - 1 });
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
  console.log('Test 1: Generates full handover summary (Level 0)');
  const testRes0 = generateHandoverPack(data, { maxTokens: 10000 });
  assert(testRes0.fallbackLevel === 0, 'Should be Level 0');
  assert(testRes0.markdown.includes('Setup repository and routing'), 'Should contain all completed tasks');
  assert(testRes0.markdown.includes('Create transfer mode generator'), 'Should contain next tasks');
  assert(testRes0.markdown.includes('Browser compatibility with legacy showDirectoryPicker'), 'Should contain known issues');
  assert(testRes0.markdown.includes('This is a mock project description for testing.'), 'Should contain project summary description');

  // Test 2: Completed Tasks の数制限（レベル1）
  console.log('Test 2: Completed tasks limited to 10 items (Level 1)');
  const testRes1 = generateHandoverPack(data, { maxTokens: tok0 - 1 });
  assert(testRes1.fallbackLevel === 1, 'Should fall back to level 1');
  assert(testRes1.markdown.includes('Setup repository and routing'), 'Should keep first items');
  assert(testRes1.markdown.includes('omitted.'), 'Should contain ellipsis/omitted message for completed tasks');

  // Test 3: Completed Tasks の完全省略（レベル2）
  console.log('Test 3: Completed tasks omitted with summary count (Level 2)');
  const testRes2 = generateHandoverPack(data, { maxTokens: tok1 - 1 });
  assert(testRes2.fallbackLevel === 2, 'Should fall back to level 2');
  assert(!testRes2.markdown.includes('Setup repository and routing'), 'Should not contain completed task details');
  assert(testRes2.markdown.includes('task(s) completed successfully.'), 'Should contain summary count text');
  assert(testRes2.markdown.includes('Create transfer mode generator'), 'Should still keep next tasks');

  // Test 4: Next Task / Constraints の数制限（レベル3）
  console.log('Test 4: Next tasks and constraints limited (Level 3)');
  const testRes3 = generateHandoverPack(data, { maxTokens: tok2 - 1 });
  assert(testRes3.fallbackLevel === 3, 'Should fall back to level 3');
  assert(testRes3.markdown.includes('planned.'), 'Should show planned count/ellipsis');
  assert(testRes3.markdown.includes('omitted'), 'Should show constraints omitted message');

  // Test 5: Known Issues の完全省略（レベル4）
  console.log('Test 5: Known issues section omitted (Level 4)');
  const testRes4 = generateHandoverPack(data, { maxTokens: tok3 - 1 });
  assert(testRes4.fallbackLevel === 4, 'Should fall back to level 4');
  assert(!testRes4.markdown.includes('## Known Issues'), 'Should completely omit Known Issues section');

  // Test 6: 限界値テスト（レベル5: 最小構成）
  console.log('Test 6: Minimum fallback summary (Level 5)');
  const testRes5 = generateHandoverPack(data, { maxTokens: tok4 - 1 });
  assert(testRes5.fallbackLevel === 5, 'Should fall back to level 5');
  assert(!testRes5.markdown.includes('## Constraints'), 'Should omit Constraints section');
  assert(!testRes5.markdown.includes('This is a mock project description for testing.'), 'Should omit detailed project description text');

  console.log('\n================================================');
  console.log('🎉 HANDOVER PACK TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ HANDOVER PACK TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
