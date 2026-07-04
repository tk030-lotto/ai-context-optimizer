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

function generateTreeTextNode(dirPath: string, prefix = ''): string {
  let text = '';
  const files = fs.readdirSync(dirPath).sort();
  const filtered = files.filter(f => {
    if (DEFAULT_EXCLUDED_DIRS.includes(f)) return false;
    if (DEFAULT_EXCLUDED_EXTS.has(path.extname(f).toLowerCase())) return false;
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

function getReadableFiles(dirPath: string, baseDir: string): { relativePath: string; absolutePath: string; size: number }[] {
  let results: { relativePath: string; absolutePath: string; size: number }[] = [];
  const list = fs.readdirSync(dirPath);

  for (const file of list) {
    if (DEFAULT_EXCLUDED_DIRS.includes(file)) continue;

    const absolutePath = path.join(dirPath, file);
    const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, '/');
    const stat = fs.statSync(absolutePath);

    if (stat.isDirectory()) {
      results = results.concat(getReadableFiles(absolutePath, baseDir));
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (!DEFAULT_EXCLUDED_EXTS.has(ext) && stat.size <= DEFAULT_MAX_FILE_SIZE_BYTES) {
        results.push({ relativePath, absolutePath, size: stat.size });
      }
    }
  }

  return results;
}

function findTextFile(candidates: string[]): string | undefined {
  return candidates.find(candidate => fs.existsSync(candidate));
}

async function main() {
  const startTime = Date.now();
  console.log('==================================================');
  console.log('   AI Development Context Optimizer - Verify All');
  console.log('==================================================\n');

  console.log('--- [1/3] Running Formatter and Parser Tests ---');
  const testResults: { name: string; success: boolean; output: string; error?: string }[] = [];
  let allPassed = true;

  for (const testFile of TESTS) {
    const name = path.basename(testFile);
    console.log(`Running ${name}...`);
    try {
      const output = execSync(`npx vite-node ${testFile}`, { encoding: 'utf-8', stdio: 'pipe' });
      testResults.push({ name, success: true, output });
      console.log(`  PASS ${name}`);
    } catch (e: any) {
      allPassed = false;
      const errorMsg = e.stderr || e.stdout || e.message;
      testResults.push({ name, success: false, output: e.stdout || '', error: errorMsg });
      console.error(`  FAIL ${name}`);
    }
  }

  console.log('\n--- [2/3] Analyzing Tool Project Itself ---');
  const projectRoot = path.resolve('.');
  const readableFiles = getReadableFiles(projectRoot, projectRoot);
  const allProjectPaths = readableFiles.map(f => f.relativePath);

  const fileAnalyses: FileAnalysisInfo[] = [];
  let totalBytes = 0;
  let totalTokens = 0;

  for (const file of readableFiles) {
    const content = fs.readFileSync(file.absolutePath, 'utf-8');
    const ext = path.extname(file.relativePath).toLowerCase();
    const rawDeps = extractDependencies(content, ext);
    const resolvedDeps = rawDeps.map(depPath => resolveDependencyPath(file.relativePath, depPath, allProjectPaths));
    const moduleAnalysis = analyzeModule(content, ext);
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

  const folderStructureText = `${TARGET_PROJECT_NAME}/\n${generateTreeTextNode(projectRoot)}`;
  const projectAnalysisData: ProjectAnalysisData = {
    projectName: TARGET_PROJECT_NAME,
    files: fileAnalyses,
    folderStructureText,
    totalBytes,
    totalTokens
  };

  console.log(`Analyzed ${readableFiles.length} files. Total size: ${totalBytes} bytes. Est. tokens: ${totalTokens}.`);

  console.log('\n--- [3/3] Generating Pipeline Artifacts ---');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'result.json'), JSON.stringify(projectAnalysisData, null, 2), 'utf-8');

  const testReportMd = [
    '# AI Pipeline - Test Report',
    '',
    `- Scan Timestamp: ${new Date().toISOString()}`,
    `- Total Tests Run: ${TESTS.length}`,
    `- Status: ${allPassed ? 'ALL PASSED' : 'SOME TESTS FAILED'}`,
    '',
    '## Test Execution Summary',
    '',
    '| Test File | Status |',
    '| :--- | :--- |',
    ...TESTS.map(test => {
      const baseName = path.basename(test);
      const result = testResults.find(r => r.name === baseName);
      return `| \`${test}\` | ${result?.success ? 'PASS' : 'FAIL'} |`;
    })
  ].join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'test_report.md'), testReportMd, 'utf-8');

  const durationMs = Date.now() - startTime;
  const logMd = [
    '# AI Pipeline - Execution Log',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    `- Action: verify-all-tests-and-generate-pipeline`,
    `- Total Execution Duration: ${durationMs} ms`,
    `- Analyzed Project Directory: \`${projectRoot}\``,
    `- Total Files Count: ${readableFiles.length}`,
    `- Total Project Bytes: ${totalBytes}`,
    `- Estimated Total Tokens: ${totalTokens}`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'log.md'), logMd, 'utf-8');

  const sourcePath = findTextFile([
    path.resolve('RECORD.md'),
    path.resolve('record.md'),
    path.resolve('PROJECT_PLAN.md')
  ]);

  const chatHistoryParts = [
    '# AI Pipeline - Development Chat History',
    '',
    '## 1. Context',
    '- This file is generated locally for note/article drafting.',
    '- It collects the current implementation status and a short excerpt from a local planning or record file.',
    '',
    '## 2. Source Excerpt'
  ];

  if (sourcePath) {
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    chatHistoryParts.push(`- Source file: ${path.basename(sourcePath)}`);
    chatHistoryParts.push('');
    chatHistoryParts.push('```text');
    chatHistoryParts.push(sourceContent.slice(0, 4000));
    chatHistoryParts.push('```');
  } else {
    chatHistoryParts.push('- No RECORD.md or PROJECT_PLAN.md file was found.');
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'development_chat_history.md'), chatHistoryParts.join('\n'), 'utf-8');

  console.log('\n==================================================');
  if (allPassed) {
    console.log('VERIFICATION AND PIPELINE RUN COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
    process.exit(0);
  } else {
    console.error('VERIFICATION COMPLETED WITH ERRORS! SOME TESTS FAILED.');
    console.log('==================================================');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
