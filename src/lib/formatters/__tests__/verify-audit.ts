import { generateAuditPack } from '../audit';
import { ProjectAnalysisData } from '../../parser/types';

// --- アサーションヘルパー ---
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// --- 検証用モックデータの構築 ---
function buildMockProjectData(fileCount: number): ProjectAnalysisData {
  const files: any[] = [];
  
  // 大量のモックファイルを作成して情報量を増やす
  for (let i = 1; i <= fileCount; i++) {
    const isTest = i % 3 === 0;
    const isConfig = i % 5 === 0;
    const fileName = isTest ? `helper_${i}.test.ts` : isConfig ? `config_${i}.ts` : `service_${i}.ts`;
    const filePath = isTest 
      ? `src/services/__tests__/${fileName}` 
      : isConfig 
        ? `src/config/${fileName}` 
        : `src/services/${fileName}`;

    files.push({
      path: filePath,
      name: fileName,
      size: 5000,
      content: `// Source code for ${fileName}`,
      tokens: 1500,
      dependencies: [
        { importPath: 'fs', isExternal: true },
        { importPath: '../config/config_5', resolvedPath: 'src/config/config_5.ts', isExternal: false }
      ],
      analysis: {
        classes: [
          {
            name: `ServiceClass${i}`,
            extends: 'BaseService',
            description: `This is class ${i} used for system operation simulation.`,
            methods: [
              { name: 'initialize', arguments: ['config', 'options'], returnType: 'void', description: 'Initialize service instance' },
              { name: 'execute', arguments: ['param1'], returnType: 'Promise<boolean>', description: 'Execute service core logic' },
              { name: 'cleanup', arguments: [], returnType: 'void', description: 'Cleanup resources' }
            ]
          }
        ],
        functions: [
          {
            name: `globalUtility${i}`,
            arguments: ['input'],
            returnType: 'string',
            description: 'Convert input to uppercase string'
          }
        ],
        exports: [`ServiceClass${i}`, `globalUtility${i}`]
      }
    });
  }

  // 木構造アスキーアート
  let folderStructureText = 'project-root/\n';
  folderStructureText += '├── package.json\n';
  folderStructureText += '└── src/\n';
  folderStructureText += '    ├── config/\n';
  folderStructureText += '    │   ├── config_5.ts\n';
  folderStructureText += '    │   └── config_10.ts\n';
  folderStructureText += '    └── services/\n';
  folderStructureText += '        ├── service_1.ts\n';
  folderStructureText += '        ├── service_2.ts\n';
  folderStructureText += '        └── __tests__/\n';
  folderStructureText += '            ├── helper_3.test.ts\n';
  folderStructureText += '            └── helper_6.test.ts\n';

  return {
    projectName: 'Verification Project',
    files,
    folderStructureText,
    totalBytes: fileCount * 5000,
    totalTokens: fileCount * 1500
  };
}

function runTests() {
  console.log('=== START AUDIT PACK GENERATION TESTING ===\n');

  const data = buildMockProjectData(15);
  console.log(`Mock Project Stats: Files=${data.files.length}, Bytes=${data.totalBytes}`);

  // Test 1: 十分に大きいトークン制限（縮退レベル0: フル）
  console.log('Test 1: Generates full pack (Level 0)');
  const res0 = generateAuditPack(data, { maxTokens: 10000 });
  console.log(`Estimated Tokens: ${res0.estimatedTokens}, Fallback Level: ${res0.fallbackLevel}`);
  assert(res0.fallbackLevel === 0, 'Should use level 0 when token limit is very high');
  assert(res0.markdown.includes('initialize(config, options)'), 'Level 0 should contain full signature');
  assert(res0.markdown.includes('Initialize service instance'), 'Level 0 should contain JSDoc');
  assert(res0.markdown.includes('helper_3.test.ts'), 'Level 0 should contain test files');

  // Test 2: 中程度のトークン制限（縮退レベル1〜2）
  console.log('Test 2: Generates optimized pack (JSDoc omitted - Level 1/2)');
  // レベル1ではJSDocが除外される
  const res1 = generateAuditPack(data, { maxTokens: 2000 });
  console.log(`Estimated Tokens: ${res1.estimatedTokens}, Fallback Level: ${res1.fallbackLevel}`);
  assert(res1.fallbackLevel >= 1, 'Should fall back to level 1 or higher');
  assert(res1.estimatedTokens <= 2000, 'Should respect token limit');

  if (res1.fallbackLevel === 1) {
    assert(!res1.markdown.includes('Initialize service instance'), 'Level 1 should omit description');
    assert(res1.markdown.includes('initialize(config, options)'), 'Level 1 should keep method signature');
  }

  // Test 3: 厳しいトークン制限（縮退レベル3: テストファイル等除外）
  console.log('Test 3: Generates compact pack (Tests/configs omitted - Level 3)');
  const res3 = generateAuditPack(data, { maxTokens: 1500 });
  console.log(`Estimated Tokens: ${res3.estimatedTokens}, Fallback Level: ${res3.fallbackLevel}`);
  assert(res3.fallbackLevel >= 3, 'Should fall back to level 3 or higher');
  assert(res3.estimatedTokens <= 1500, 'Should respect token limit');
  
  const moduleMapSection = res3.markdown.substring(res3.markdown.indexOf('## Module Map'));
  assert(!moduleMapSection.includes('helper_3.test.ts'), 'Level 3 should omit test files from module map');

  // Test 4: 極めて厳しい制限（縮退レベル4: Module Map完全省略）
  console.log('Test 4: Generates minimal pack (Module map completely omitted - Level 4)');
  const res4 = generateAuditPack(data, { maxTokens: 800 });
  console.log(`Estimated Tokens: ${res4.estimatedTokens}, Fallback Level: ${res4.fallbackLevel}`);
  assert(res4.fallbackLevel >= 4, 'Should fall back to level 4 or higher');
  assert(res4.estimatedTokens <= 800, 'Should respect token limit');
  assert(!res4.markdown.includes('## Module Map'), 'Level 4 should completely omit module map section');

  // Test 5: 限界値テスト
  console.log('Test 5: Check boundary handling (Level 5)');
  const res5 = generateAuditPack(data, { maxTokens: 200 });
  console.log(`Estimated Tokens: ${res5.estimatedTokens}, Fallback Level: ${res5.fallbackLevel}`);
  assert(res5.fallbackLevel === 5, 'Should fall back to maximum level 5');

  console.log('\n================================================');
  console.log('🎉 AUDIT PACK TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ AUDIT PACK TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
