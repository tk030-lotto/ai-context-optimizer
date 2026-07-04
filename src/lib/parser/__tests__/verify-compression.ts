import { extractDependencies, resolveDependencyPath } from '../dependency';
import { analyzeModule } from '../module-analyzer';
import { estimateTokens, calculateReadTime } from '../token-estimator';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

const SAMPLE_TS_CONTENT = `
/**
 * Sample module.
 */
import { DEFAULT_EXCLUDED_DIRS } from '../config/constants';
import * as fs from 'fs';
import { isReadableFile } from './file-reader';

export interface DummyInterface {
  id: string;
}

/**
 * FileTreeParser handles directory traversal and tree rendering.
 */
export class FileTreeParser extends BaseParser {
  private rootPath: string;

  constructor(rootPath: string) {
    super();
    this.rootPath = rootPath;
  }

  /**
   * Scan a directory.
   * @param handle directory handle
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
 * Exported arrow function.
 */
export const runParser = async (config: object): Promise<boolean> => {
  return true;
};

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
    Document processing class.
    """
    def __init__(self, doc_path):
        self.doc_path = doc_path

    def process(self, mode: str) -> bool:
        """Process a document."""
        return True

def global_run():
    """Global function."""
    pass
`;

function runTests() {
  console.log('=== START KNOWLEDGE COMPRESSION ENGINE TESTING ===\n');

  console.log('[1/3] Testing dependency.ts...');

  const tsDeps = extractDependencies(SAMPLE_TS_CONTENT, '.ts');
  console.log('TS dependencies extracted:', tsDeps);
  assert(tsDeps.includes('../config/constants'), 'Should extract constants');
  assert(tsDeps.includes('fs'), 'Should extract fs');
  assert(tsDeps.includes('./file-reader'), 'Should extract file-reader');
  assert(tsDeps.length === 3, 'Should extract exactly 3 dependencies for TS');

  const pyDeps = extractDependencies(SAMPLE_PYTHON_CONTENT, '.py');
  console.log('Python dependencies extracted:', pyDeps);
  assert(pyDeps.includes('os'), 'Should extract os');
  assert(pyDeps.includes('sys'), 'Should extract sys');
  assert(pyDeps.includes('math'), 'Should extract math');
  assert(pyDeps.includes('datetime'), 'Should extract datetime');
  assert(pyDeps.includes('.utils'), 'Should extract .utils');
  assert(pyDeps.length === 5, 'Should extract exactly 5 dependencies for Python');

  const projectFiles = [
    'src/lib/config/constants.ts',
    'src/lib/parser/file-reader.ts',
    'src/lib/parser/file-tree.ts',
    'src/utils.py',
    'src/app/utils.py',
    'src/lib/config/constants/index.ts'
  ];

  const sourceFile = 'src/lib/parser/file-tree.ts';

  const res1 = resolveDependencyPath(sourceFile, '../config/constants', projectFiles);
  console.log('Resolve ../config/constants:', res1);
  assert(res1.resolvedPath === 'src/lib/config/constants.ts', 'Should resolve constants.ts');
  assert(res1.isExternal === false, 'Should not be external');

  const res2 = resolveDependencyPath(sourceFile, './file-reader', projectFiles);
  console.log('Resolve ./file-reader:', res2);
  assert(res2.resolvedPath === 'src/lib/parser/file-reader.ts', 'Should resolve file-reader.ts');
  assert(res2.isExternal === false, 'Should not be external');

  const res3 = resolveDependencyPath(sourceFile, 'fs', projectFiles);
  console.log('Resolve fs:', res3);
  assert(res3.resolvedPath === undefined, 'External resolved path should be undefined');
  assert(res3.isExternal === true, 'fs should be external');

  const aliasResult = resolveDependencyPath('src/app/page.tsx', '@/lib/config/constants', projectFiles);
  console.log('Resolve @/lib/config/constants:', aliasResult);
  assert(aliasResult.resolvedPath === 'src/lib/config/constants.ts', 'Should resolve @/ alias paths');
  assert(aliasResult.isExternal === false, 'Alias path should be treated as local');

  const pythonRelativeResult = resolveDependencyPath('src/app/main.py', '.utils', projectFiles);
  console.log('Resolve .utils from Python:', pythonRelativeResult);
  assert(pythonRelativeResult.resolvedPath === 'src/app/utils.py', 'Should resolve Python relative imports');
  assert(pythonRelativeResult.isExternal === false, 'Python relative import should be local');

  console.log('-> dependency.ts passed.\n');

  console.log('[2/3] Testing module-analyzer.ts...');

  const tsAnalysis = analyzeModule(SAMPLE_TS_CONTENT, '.ts');
  console.log('TS Analysis result:');
  console.log('Classes:', JSON.stringify(tsAnalysis.classes, null, 2));
  console.log('Functions:', JSON.stringify(tsAnalysis.functions, null, 2));
  console.log('Exports:', tsAnalysis.exports);

  assert(tsAnalysis.classes.length === 1, 'Should find 1 class in TS');
  const cls = tsAnalysis.classes[0];
  assert(cls.name === 'FileTreeParser', 'Class name should be FileTreeParser');
  assert(cls.extends === 'BaseParser', 'Should detect base class BaseParser');
  assert(!!cls.description?.includes('FileTreeParser'), 'Should extract class JSDoc');
  assert(cls.methods.length === 2, 'Should find 2 methods (scanDirectory, formatNode)');
  assert(cls.methods[0].name === 'scanDirectory', 'First method is scanDirectory');
  assert(cls.methods[0].arguments.includes('handle'), 'Should find arguments');
  assert(!!cls.methods[0].description?.includes('Scan a directory'), 'Should extract method JSDoc');

  assert(tsAnalysis.functions.length === 2, 'Should find 2 functions in TS');
  const runParserFunc = tsAnalysis.functions.find(f => f.name === 'runParser');
  const localHelperFunc = tsAnalysis.functions.find(f => f.name === 'localHelper');
  assert(!!runParserFunc, 'Should find arrow function runParser');
  assert(runParserFunc?.isExported === true, 'runParser should be exported');
  assert(!!localHelperFunc, 'Should find function localHelper');
  assert(localHelperFunc?.isExported === false, 'localHelper should not be exported');

  const advancedTsContent = `
export class AdvancedService {
  private readonly state = 0;

  public async loadItems(id: string): Promise<void> {
    return;
  }

  get value(): number {
    return this.state;
  }

  handler = (input: string): string => input.trim();
}
`;
  const advancedTsAnalysis = analyzeModule(advancedTsContent, '.ts');
  assert(advancedTsAnalysis.classes.length === 1, 'Should find 1 advanced class');
  assert(advancedTsAnalysis.classes[0].methods.some(m => m.name === 'loadItems'), 'Should detect modifier-based methods');
  assert(advancedTsAnalysis.classes[0].methods.some(m => m.name === 'handler'), 'Should detect class field arrow functions');

  const pyAnalysis = analyzeModule(SAMPLE_PYTHON_CONTENT, '.py');
  console.log('Python Analysis result:');
  console.log('Classes:', JSON.stringify(pyAnalysis.classes, null, 2));
  console.log('Functions:', JSON.stringify(pyAnalysis.functions, null, 2));

  assert(pyAnalysis.classes.length === 1, 'Should find 1 class in Python');
  const pyCls = pyAnalysis.classes[0];
  assert(pyCls.name === 'DocumentProcessor', 'Class name should be DocumentProcessor');
  assert(pyCls.extends === 'BaseProcessor', 'Should detect base class BaseProcessor');
  assert(!!pyCls.description?.includes('Document processing class'), 'Should extract class Docstring');
  assert(pyCls.methods.length === 2, 'Should find 2 methods (__init__, process) in Python');
  assert(pyCls.methods[1].name === 'process', 'Second method is process');
  assert(pyCls.methods[1].arguments.includes('mode'), 'Should extract argument mode');
  assert(pyCls.methods[1].description === 'Process a document.', 'Should extract method Docstring');

  assert(pyAnalysis.functions.length === 1, 'Should find 1 function in Python');
  assert(pyAnalysis.functions[0].name === 'global_run', 'Should find global function global_run');
  assert(pyAnalysis.functions[0].description === 'Global function.', 'Should extract global function Docstring');

  console.log('-> module-analyzer.ts passed.\n');

  console.log('[3/3] Testing token-estimator.ts...');

  const englishText = 'Hello world, this is a simple text with symbols {} and 123.';
  const japaneseText = 'こんにちは世界。これは日本語のテキストです。';
  const mixedText = `${englishText}\n${japaneseText}`;

  const engTokens = estimateTokens(englishText);
  const jpTokens = estimateTokens(japaneseText);
  const mixedTokens = estimateTokens(mixedText);

  console.log(`English text tokens: ${engTokens} (Chars: ${englishText.length})`);
  console.log(`Japanese text tokens: ${jpTokens} (Chars: ${japaneseText.length})`);
  console.log(`Mixed text tokens: ${mixedTokens} (Chars: ${mixedText.length})`);

  assert(engTokens > 0, 'Tokens should be greater than 0');
  assert(jpTokens > 0, 'Tokens should be greater than 0');
  assert(mixedTokens > engTokens, 'Mixed tokens should be larger than English-only tokens');

  const readTimeResult = calculateReadTime(mixedTokens, mixedText.length);
  console.log('Read time result:', readTimeResult);
  assert(readTimeResult.aiTimeSeconds > 0, 'AI time should be calculated');
  assert(readTimeResult.humanTimeMinutes > 0, 'Human time should be calculated');
  assert(typeof readTimeResult.aiTimeFormatted === 'string', 'Should produce formatted AI time');
  assert(typeof readTimeResult.humanTimeFormatted === 'string', 'Should produce formatted Human time');

  console.log('-> token-estimator.ts passed.\n');

  console.log('================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  console.log('================================================');
}

try {
  runTests();
  process.exit(0);
} catch (e: any) {
  console.error('\nTEST FAILED');
  console.error(e.message || e);
  process.exit(1);
}
