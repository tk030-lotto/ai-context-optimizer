import { extractDependencies, resolveDependencyPath } from '../dependency';
import { analyzeModule } from '../module-analyzer';
import { estimateTokens, calculateReadTime } from '../token-estimator';

// --- モックデータ定義 ---

const SAMPLE_TS_CONTENT = `
/**
 * 設定モジュールとその他のユーティリティのインポート
 */
import { DEFAULT_EXCLUDED_DIRS } from '../config/constants';
import * as fs from 'fs';
import { isReadableFile } from './file-reader';

export interface DummyInterface {
  id: string;
}

/**
 * プロジェクトツリーの生成とトラバースを管理するクラスです。
 * 複数行のJSDocコメントテスト。
 */
export class FileTreeParser extends BaseParser {
  private rootPath: string;

  constructor(rootPath: string) {
    super();
    this.rootPath = rootPath;
  }

  /**
   * ディレクトリをスキャンしてノードを返します。
   * @param handle ディレクトリハンドル
   */
  async scanDirectory(handle: any): Promise<any[]> {
    const list: any[] = [];
    return list;
  }

  private formatNode(node: any): string {
    return node.name;
  }
}

/**
 * 簡易的なアロー関数のエクスポートテスト
 */
export const runParser = async (config: object): Promise<boolean> => {
  return true;
};

/**
 * 通常の関数定義のテスト
 */
function localHelper(value: number): string {
  return String(value);
}
`;

const SAMPLE_PYTHON_CONTENT = `
import os
import sys, math
from datetime import datetime, timedelta
from .utils import helper_func

class DocumentProcessor(BaseProcessor):
    """
    ドキュメントの解析とテキスト抽出を行うクラス。
    PythonのトリプルクォートDocstringテスト。
    """
    def __init__(self, doc_path):
        self.doc_path = doc_path

    def process(self, mode: str) -> bool:
        """ファイルを処理します。"""
        return True

def global_run():
    """グローバル関数のテスト"""
    pass
`;

// --- 検証関数 ---

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function runTests() {
  console.log('=== START KNOWLEDGE COMPRESSION ENGINE TESTING ===\n');

  // --- 1. dependency.ts の検証 ---
  console.log('[1/3] Testing dependency.ts...');
  
  // TSのインポート抽出テスト
  const tsDeps = extractDependencies(SAMPLE_TS_CONTENT, '.ts');
  console.log('TS dependencies extracted:', tsDeps);
  assert(tsDeps.includes('../config/constants'), 'Should extract constants');
  assert(tsDeps.includes('fs'), 'Should extract fs');
  assert(tsDeps.includes('./file-reader'), 'Should extract file-reader');
  assert(tsDeps.length === 3, 'Should extract exactly 3 dependencies for TS');

  // Pythonのインポート抽出テスト
  const pyDeps = extractDependencies(SAMPLE_PYTHON_CONTENT, '.py');
  console.log('Python dependencies extracted:', pyDeps);
  assert(pyDeps.includes('os'), 'Should extract os');
  assert(pyDeps.includes('sys'), 'Should extract sys');
  assert(pyDeps.includes('math'), 'Should extract math');
  assert(pyDeps.includes('datetime'), 'Should extract datetime');
  assert(pyDeps.includes('.utils'), 'Should extract .utils');
  assert(pyDeps.length === 5, 'Should extract exactly 5 dependencies for Python');

  // パス解決テスト
  const projectFiles = [
    'src/lib/config/constants.ts',
    'src/lib/parser/file-reader.ts',
    'src/lib/parser/file-tree.ts',
    'src/utils.py'
  ];

  const sourceFile = 'src/lib/parser/file-tree.ts';

  // 相対パス解決
  const res1 = resolveDependencyPath(sourceFile, '../config/constants', projectFiles);
  console.log('Resolve ../config/constants:', res1);
  assert(res1.resolvedPath === 'src/lib/config/constants.ts', 'Should resolve constants.ts');
  assert(res1.isExternal === false, 'Should not be external');

  // 相対パス解決 (同一ディレクトリ)
  const res2 = resolveDependencyPath(sourceFile, './file-reader', projectFiles);
  console.log('Resolve ./file-reader:', res2);
  assert(res2.resolvedPath === 'src/lib/parser/file-reader.ts', 'Should resolve file-reader.ts');
  assert(res2.isExternal === false, 'Should not be external');

  // 外部/標準ライブラリ解決
  const res3 = resolveDependencyPath(sourceFile, 'fs', projectFiles);
  console.log('Resolve fs:', res3);
  assert(res3.resolvedPath === undefined, 'External resolved path should be undefined');
  assert(res3.isExternal === true, 'fs should be external');

  console.log('-> dependency.ts passed.\n');


  // --- 2. module-analyzer.ts の検証 ---
  console.log('[2/3] Testing module-analyzer.ts...');

  // TSモジュール解析
  const tsAnalysis = analyzeModule(SAMPLE_TS_CONTENT, '.ts');
  console.log('TS Analysis result:');
  console.log('Classes:', JSON.stringify(tsAnalysis.classes, null, 2));
  console.log('Functions:', JSON.stringify(tsAnalysis.functions, null, 2));
  console.log('Exports:', tsAnalysis.exports);

  assert(tsAnalysis.classes.length === 1, 'Should find 1 class in TS');
  const cls = tsAnalysis.classes[0];
  assert(cls.name === 'FileTreeParser', 'Class name should be FileTreeParser');
  assert(cls.extends === 'BaseParser', 'Should detect base class BaseParser');
  assert(cls.description?.includes('プロジェクトツリーの生成'), 'Should extract class JSDoc');
  assert(cls.methods.length === 2, 'Should find 2 methods (scanDirectory, formatNode)');
  assert(cls.methods[0].name === 'scanDirectory', 'First method is scanDirectory');
  assert(cls.methods[0].arguments.includes('handle'), 'Should find arguments');
  assert(cls.methods[0].description?.includes('ディレクトリをスキャン'), 'Should extract method JSDoc');

  assert(tsAnalysis.functions.length === 2, 'Should find 2 functions in TS');
  const runParserFunc = tsAnalysis.functions.find(f => f.name === 'runParser');
  const localHelperFunc = tsAnalysis.functions.find(f => f.name === 'localHelper');
  
  assert(!!runParserFunc, 'Should find arrow function runParser');
  assert(runParserFunc?.isExported === true, 'runParser should be exported');
  assert(!!localHelperFunc, 'Should find function localHelper');
  assert(localHelperFunc?.isExported === false, 'localHelper should not be exported');

  // Pythonモジュール解析
  const pyAnalysis = analyzeModule(SAMPLE_PYTHON_CONTENT, '.py');
  console.log('Python Analysis result:');
  console.log('Classes:', JSON.stringify(pyAnalysis.classes, null, 2));
  console.log('Functions:', JSON.stringify(pyAnalysis.functions, null, 2));

  assert(pyAnalysis.classes.length === 1, 'Should find 1 class in Python');
  const pyCls = pyAnalysis.classes[0];
  assert(pyCls.name === 'DocumentProcessor', 'Class name should be DocumentProcessor');
  assert(pyCls.extends === 'BaseProcessor', 'Should detect base class BaseProcessor');
  assert(pyCls.description?.includes('ドキュメントの解析'), 'Should extract class Docstring');
  assert(pyCls.methods.length === 2, 'Should find 2 methods (__init__, process) in Python');
  assert(pyCls.methods[1].name === 'process', 'Second method is process');
  assert(pyCls.methods[1].arguments.includes('mode'), 'Should extract argument mode');
  assert(pyCls.methods[1].description === 'ファイルを処理します。', 'Should extract method Docstring');

  assert(pyAnalysis.functions.length === 1, 'Should find 1 function in Python');
  assert(pyAnalysis.functions[0].name === 'global_run', 'Should find global function global_run');
  assert(pyAnalysis.functions[0].description === 'グローバル関数のテスト', 'Should extract global function Docstring');

  console.log('-> module-analyzer.ts passed.\n');


  // --- 3. token-estimator.ts の検証 ---
  console.log('[3/3] Testing token-estimator.ts...');

  const englishText = 'Hello world, this is a simple text with symbols {} and 123.';
  const japaneseText = 'こんにちは世界、これは日本語の文章です。';
  const mixedText = `${englishText}\n${japaneseText}`;

  // トークン推定
  const engTokens = estimateTokens(englishText);
  const jpTokens = estimateTokens(japaneseText);
  const mixedTokens = estimateTokens(mixedText);

  console.log(`English text tokens: ${engTokens} (Chars: ${englishText.length})`);
  console.log(`Japanese text tokens: ${jpTokens} (Chars: ${japaneseText.length})`);
  console.log(`Mixed text tokens: ${mixedTokens} (Chars: ${mixedText.length})`);

  assert(engTokens > 0, 'Tokens should be greater than 0');
  assert(jpTokens > 0, 'Tokens should be greater than 0');
  assert(mixedTokens === Math.ceil(englishText.length / 3.8 + 1 /* 改行 */ / 3.8 + japaneseText.length * 1.3), 'Mixed tokens calculation check');

  // 読込想定時間
  const readTimeResult = calculateReadTime(mixedTokens, mixedText.length);
  console.log('Read time result:', readTimeResult);
  assert(readTimeResult.aiTimeSeconds > 0, 'AI time should be calculated');
  assert(readTimeResult.humanTimeMinutes > 0, 'Human time should be calculated');
  assert(typeof readTimeResult.aiTimeFormatted === 'string', 'Should produce formatted AI time');
  assert(typeof readTimeResult.humanTimeFormatted === 'string', 'Should produce formatted Human time');

  console.log('-> token-estimator.ts passed.\n');

  console.log('================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('================================================');
}

// 実行
try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\n❌ TEST FAILED ❌');
  console.error(e.message || e);
  process.exit(1);
}
