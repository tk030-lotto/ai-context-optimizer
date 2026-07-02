import { generateDocPack } from '../doc';
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
This is a mock project description for testing documentation features. It outlines the general goal and scope of the optimization tool in a very detailed manner, including various details that would make this paragraph extremely long and exceed the two hundred character limit easily. We want to ensure that this description is comprehensive enough to trigger the truncation logic properly in our test cases.

## 目的
AI駆動開発における「コンテキスト肥大化」と「モデル間引継ぎの負荷」を解決し、トークン消費の最適化およびAI監査（Sonnet等）の効率を最大化する。

## 背景
大規模開発でのAI利用において、ソースコードの膨大化に伴いLLMのコンテキスト制限に達しやすくなる問題があります。この問題は、日々の開発の中でファイル数が増加するにつれて深刻化し、AIへの指示が不正確になる原因となります。そのため、コンテキストを適切に要約・圧縮し、必要な情報だけを選択的に提示する仕組みが強く求められています。これにより、開発効率を大幅に向上させ、トークンコストを削減します。

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
- モック決定事項5件目としての追加。
- モック決定事項6件目としての追加。
- モック決定事項7件目としての追加。
`,
      tokens: 800,
      dependencies: []
    }
  ];

  return {
    projectName: 'Verification Doc Project',
    files,
    folderStructureText: 'mock-root/\n├── PROJECT_PLAN.md\n├── task.md\n└── RECORD.md',
    totalBytes: 10500,
    totalTokens: 3200
  };
}

function runTests() {
  console.log('=== START DOCUMENTATION PACK GENERATION TESTING ===\n');

  const data = buildMockProjectData();

  // 1. 各レベルでのトークン数を動的に抽出
  const resL0 = generateDocPack(data, { maxTokens: 10000 });
  const tok0 = resL0.estimatedTokens;
  assert(resL0.fallbackLevel === 0, 'Should start at level 0 with high token limit');

  const resL1 = generateDocPack(data, { maxTokens: tok0 - 1 });
  const tok1 = resL1.estimatedTokens;
  assert(resL1.fallbackLevel >= 1, 'Limit below Level 0 should trigger fallback to 1+');

  const resL2 = generateDocPack(data, { maxTokens: tok1 - 1 });
  const tok2 = resL2.estimatedTokens;
  assert(resL2.fallbackLevel >= 2, 'Limit below Level 1 should trigger fallback to 2+');

  const resL3 = generateDocPack(data, { maxTokens: tok2 - 1 });
  const tok3 = resL3.estimatedTokens;
  assert(resL3.fallbackLevel >= 3, 'Limit below Level 2 should trigger fallback to 3+');

  const resL4 = generateDocPack(data, { maxTokens: tok3 - 1 });
  const tok4 = resL4.estimatedTokens;
  assert(resL4.fallbackLevel >= 4, 'Limit below Level 3 should trigger fallback to 4+');

  const resL5 = generateDocPack(data, { maxTokens: tok4 - 1 });
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
  console.log('Test 1: Generates full documentation (Level 0)');
  const testRes0 = generateDocPack(data, { maxTokens: 10000 });
  assert(testRes0.fallbackLevel === 0, 'Should be Level 0');
  assert(testRes0.markdown.includes('# Project Documentation'), 'Should contain main title');
  assert(testRes0.markdown.includes('## Overview'), 'Should contain Overview section');
  assert(testRes0.markdown.includes('## Purpose'), 'Should contain Purpose section');
  assert(testRes0.markdown.includes('## Background'), 'Should contain Background section');
  assert(testRes0.markdown.includes('## Architecture'), 'Should contain Architecture section');
  assert(testRes0.markdown.includes('## Main Features'), 'Should contain Main Features section');
  assert(testRes0.markdown.includes('## Technical Highlights'), 'Should contain Technical Highlights section');
  assert(testRes0.markdown.includes('## Benefits'), 'Should contain Benefits section');
  assert(testRes0.markdown.includes('## Future Plans'), 'Should contain Future Plans section');
  assert(testRes0.markdown.includes('Vite + React 構成を採用。'), 'Should contain design decisions in Technical Highlights');
  assert(testRes0.markdown.includes('Create documentation exporter'), 'Should contain future plans');

  // Test 2: Technical Highlights の数制限（レベル1）
  console.log('Test 2: Technical highlights limited (Level 1)');
  const testRes1 = generateDocPack(data, { maxTokens: tok0 - 1 });
  assert(testRes1.fallbackLevel === 1, 'Should fall back to level 1');
  assert(testRes1.markdown.includes('omitted'), 'Should contain highlights omitted message');

  // Test 3: Main Features の説明簡略化（レベル2）
  console.log('Test 3: Main Features simplified (Level 2)');
  const testRes2 = generateDocPack(data, { maxTokens: tok1 - 1 });
  assert(testRes2.fallbackLevel === 2, 'Should fall back to level 2');
  assert(testRes2.markdown.includes('Phase 1: 基盤の設計・構築'), 'Should have simplified task format');
  assert(!testRes2.markdown.includes('[完了]'), 'Should not contain full statuses like [完了] or [未着手]');

  // Test 4: Overview & Background 切り詰め（レベル3）
  console.log('Test 4: Overview & Background truncated to 200 chars (Level 3)');
  const testRes3 = generateDocPack(data, { maxTokens: tok2 - 1 });
  assert(testRes3.fallbackLevel === 3, 'Should fall back to level 3');
  assert(testRes3.markdown.includes('...'), 'Should contain ellipsis for truncated descriptions');

  // Test 5: Future Plans の制限/省略（レベル4）
  console.log('Test 5: Future Plans section limited or omitted (Level 4)');
  const testRes4 = generateDocPack(data, { maxTokens: tok3 - 1 });
  assert(testRes4.fallbackLevel === 4, 'Should fall back to level 4');
  assert(testRes4.markdown.includes('Future Plans') || !testRes4.markdown.includes('Create documentation exporter'), 'Should limit or omit Future Plans');

  // Test 6: Architecture 最小化 ＆ Benefits 省略（レベル5）
  console.log('Test 6: Minimum fallback documentation (Level 5)');
  const testRes5 = generateDocPack(data, { maxTokens: tok4 - 1 });
  assert(testRes5.fallbackLevel === 5, 'Should fall back to level 5');
  assert(testRes5.markdown.includes('Client-side web application leveraging standard File System Access API'), 'Should contain simplified architecture text');
  assert(!testRes5.markdown.includes('## Benefits'), 'Should completely omit Benefits section');

  console.log('\n================================================');
  console.log('🎉 DOCUMENTATION PACK TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ DOCUMENTATION PACK TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
