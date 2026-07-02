import { generateDeepAuditPack } from '../deep-audit';
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
      path: 'src/services/data-processor.ts',
      name: 'data-processor.ts',
      size: 15000,
      content: `/**
 * Data processing core module.
 * Exposes methods to analyze and format data.
 */
import { helper } from '../utils/helper';
import * as fs from 'fs';

export class DataProcessor extends BaseProcessor {
  private id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }

  /**
   * Process raw input string.
   * @param input raw data
   */
  async processData(input: string): Promise<boolean> {
    // Process input text inside this block
    const formatted = helper(input);
    return true;
  }
}

/**
 * Validate processor health.
 */
export function checkHealth(): boolean {
  // Inline comment in function
  return true;
}
`,
      tokens: 3000,
      dependencies: [
        { importPath: 'fs', isExternal: true },
        { importPath: '../utils/helper', resolvedPath: 'src/utils/helper.ts', isExternal: false }
      ],
      analysis: {
        classes: [
          {
            name: 'DataProcessor',
            extends: 'BaseProcessor',
            description: 'Data processing core module. Exposes methods to analyze and format data.',
            methods: [
              { name: 'processData', arguments: ['input'], returnType: 'Promise<boolean>', description: 'Process raw input string.' }
            ],
            isExported: true
          }
        ],
        functions: [
          {
            name: 'checkHealth',
            arguments: [],
            returnType: 'boolean',
            description: 'Validate processor health.',
            isExported: true
          }
        ],
        exports: ['DataProcessor', 'checkHealth']
      }
    },
    {
      path: 'src/utils/helper.ts',
      name: 'helper.ts',
      size: 2000,
      content: 'export function helper(val: string) { return val.trim(); }',
      tokens: 500,
      dependencies: [],
      analysis: {
        classes: [],
        functions: [
          { name: 'helper', arguments: ['val'], returnType: 'string', isExported: true }
        ],
        exports: ['helper']
      }
    },
    {
      path: 'src/app/index.ts',
      name: 'index.ts',
      size: 1000,
      content: "import { DataProcessor } from '../services/data-processor';",
      tokens: 200,
      dependencies: [
        { importPath: '../services/data-processor', resolvedPath: 'src/services/data-processor.ts', isExternal: false }
      ],
      analysis: {
        classes: [],
        functions: [],
        exports: []
      }
    }
  ];

  return {
    projectName: 'Verification Deep Project',
    files,
    folderStructureText: 'project-root/\n├── src/\n│   ├── app/\n│   │   └── index.ts\n│   ├── services/\n│   │   └── data-processor.ts\n│   └── utils/\n│       └── helper.ts',
    totalBytes: 18000,
    totalTokens: 3700
  };
}

function runTests() {
  console.log('=== START DEEP AUDIT PACK GENERATION TESTING ===\n');

  const data = buildMockProjectData();
  const targetFilePath = 'src/services/data-processor.ts';

  // 1. 各レベルでのトークン数を動的に抽出
  const resL0 = generateDeepAuditPack(data, targetFilePath, { maxTokens: 10000 });
  const tok0 = resL0.estimatedTokens;
  assert(resL0.fallbackLevel === 0, 'Initial fallback simulation should start at level 0');

  const resL1 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok0 - 1 });
  const tok1 = resL1.estimatedTokens;
  assert(resL1.fallbackLevel >= 1, 'Token limit below level 0 should trigger fallback to 1+');

  const resL2 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok1 - 1 });
  const tok2 = resL2.estimatedTokens;
  assert(resL2.fallbackLevel >= 2, 'Token limit below level 1 should trigger fallback to 2+');

  const resL3 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok2 - 1 });
  const tok3 = resL3.estimatedTokens;
  assert(resL3.fallbackLevel >= 3, 'Token limit below level 2 should trigger fallback to 3+');

  const resL4 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok3 - 1 });
  const tok4 = resL4.estimatedTokens;
  assert(resL4.fallbackLevel >= 4, 'Token limit below level 3 should trigger fallback to 4+');

  const resL5 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok4 - 1 });
  const tok5 = resL5.estimatedTokens;
  assert(resL5.fallbackLevel === 5, 'Token limit below level 4 should trigger fallback to 5');

  console.log(`Token sizes at each fallback level:`);
  console.log(`- Level 0: ${tok0}`);
  console.log(`- Level 1: ${tok1}`);
  console.log(`- Level 2: ${tok2}`);
  console.log(`- Level 3: ${tok3}`);
  console.log(`- Level 4: ${tok4}`);
  console.log(`- Level 5: ${tok5}`);

  // Test 1: 十分に大きいトークン制限（縮退レベル0: フル）
  console.log('Test 1: Generates full deep pack (Level 0)');
  const testRes0 = generateDeepAuditPack(data, targetFilePath, { maxTokens: 10000 });
  console.log(`Estimated Tokens: ${testRes0.estimatedTokens}, Fallback Level: ${testRes0.fallbackLevel}`);
  assert(testRes0.fallbackLevel === 0, 'Should use level 0 when token limit is very high');
  assert(testRes0.markdown.includes('Process raw input string.'), 'Level 0 should contain JSDoc');
  assert(testRes0.markdown.includes('// Process input text inside this block'), 'Level 0 should contain code comments');
  assert(testRes0.markdown.includes('## Related Files'), 'Level 0 should contain related files');

  // Test 2: コメント省略（レベル1）
  console.log('Test 2: Generates clean code pack (Level 1)');
  const testRes1 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok0 - 1 });
  console.log(`Estimated Tokens: ${testRes1.estimatedTokens}, Fallback Level: ${testRes1.fallbackLevel}`);
  assert(testRes1.fallbackLevel === 1, 'Should fall back to level 1');
  assert(!testRes1.markdown.includes('// Process input text inside this block'), 'Level 1 should omit inline comments');
  assert(!testRes1.markdown.includes('Process raw input string.'), 'Level 1 should omit JSDoc');
  assert(testRes1.markdown.includes('processData(input)'), 'Level 1 should keep method implementation');

  // Test 3: スケルトン化（レベル2）
  console.log('Test 3: Generates skeleton code pack (Level 2)');
  const testRes2 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok1 - 1 });
  console.log(`Estimated Tokens: ${testRes2.estimatedTokens}, Fallback Level: ${testRes2.fallbackLevel}`);
  assert(testRes2.fallbackLevel === 2, 'Should fall back to level 2');
  assert(testRes2.markdown.includes('processData(input)'), 'Level 2 should show declaration');
  assert(!testRes2.markdown.includes('const formatted = helper(input)'), 'Level 2 should omit method body');
  assert(testRes2.markdown.includes('## Related Files'), 'Level 2 should still contain related files');

  // Test 4: 関連ファイル・依存の省略（レベル3）
  console.log('Test 4: Generates minimized pack (Level 3)');
  const testRes3 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok2 - 1 });
  console.log(`Estimated Tokens: ${testRes3.estimatedTokens}, Fallback Level: ${testRes3.fallbackLevel}`);
  assert(testRes3.fallbackLevel === 3, 'Should fall back to level 3');
  assert(!testRes3.markdown.includes('## Related Files'), 'Level 3 should completely omit related files section');
  assert(testRes3.markdown.includes('processData(input)'), 'Level 3 should show function arguments');

  // Test 5: 詳細仕様の省略（レベル4）
  console.log('Test 5: Generates signature-only pack (Level 4)');
  const testRes4 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok3 - 1 });
  console.log(`Estimated Tokens: ${testRes4.estimatedTokens}, Fallback Level: ${testRes4.fallbackLevel}`);
  assert(testRes4.fallbackLevel === 4, 'Should fall back to level 4');
  assert(testRes4.markdown.includes('processData'), 'Level 4 should show name');
  assert(!testRes4.markdown.includes('processData(input)'), 'Level 4 should omit arguments in method signature');

  // Test 6: 限界値テスト（レベル5: コードブロック省略）
  console.log('Test 6: Check boundary handling (Level 5)');
  const testRes5 = generateDeepAuditPack(data, targetFilePath, { maxTokens: tok4 - 1 });
  console.log(`Estimated Tokens: ${testRes5.estimatedTokens}, Fallback Level: ${testRes5.fallbackLevel}`);
  assert(testRes5.fallbackLevel === 5, 'Should fall back to maximum level 5');
  assert(!testRes5.markdown.includes('## Code Summary'), 'Level 5 should omit code block entirely');

  console.log('\n================================================');
  console.log('🎉 DEEP AUDIT PACK TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ DEEP AUDIT PACK TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
