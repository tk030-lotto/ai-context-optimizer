import { FileAnalysisInfo, ProjectAnalysisData } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface AuditPackOptions {
  maxTokens?: number; // 目標最大トークン（デフォルト 4000）
}

/**
 * 優先順位に基づいてコンテンツを制御・削ぎ落とした Audit Pack (Markdown) を生成します。
 */
export function generateAuditPack(
  data: ProjectAnalysisData,
  options: AuditPackOptions = {}
): { markdown: string; fallbackLevel: number; estimatedTokens: number } {
  const maxTokens = options.maxTokens || 4000;
  
  // 縮退レベル 0 から 5 まで順にシミュレーション
  for (let level = 0; level <= 5; level++) {
    const markdown = buildMarkdownForLevel(data, level);
    const tokens = estimateTokens(markdown);
    
    // 目標トークン数以下に収まった場合、または最終レベルに達した場合はそれを返す
    if (tokens <= maxTokens || level === 5) {
      return {
        markdown,
        fallbackLevel: level,
        estimatedTokens: tokens
      };
    }
  }

  // フォールバック（基本的にはここには来ないが、型安全のため）
  const fallbackMarkdown = buildMarkdownForLevel(data, 5);
  return {
    markdown: fallbackMarkdown,
    fallbackLevel: 5,
    estimatedTokens: estimateTokens(fallbackMarkdown)
  };
}

/**
 * 指定された縮退レベルで Markdown をビルドします。
 * 
 * レベル定義:
 * 0: フル出力 (コメント、引数型、全ファイル情報を含む)
 * 1: コメント (JSDoc/Docstring) の省略
 * 2: 詳細仕様 (引数リスト、戻り値の型) の省略、クラス名とメソッド・関数名のみ
 * 3: 優先度の低いファイル (テスト, 設定, ユーティリティ等) を Module Map / Dependencies から除外
 * 4: Module Map および Dependencies の完全省略 (主要ファイル一覧のみ)
 * 5: フォルダツリーの階層制限 (深さ2階層までに制限)
 */
function buildMarkdownForLevel(data: ProjectAnalysisData, level: number): string {
  const sections: string[] = [];
  
  // 1. Title & Metadata
  sections.push(`# Audit Pack - ${data.projectName}`);
  sections.push(`\nGenerated metadata:
- Date: ${new Date().toLocaleDateString()}
- Total Files: ${data.files.length}
- Target Token Limit: Optimized (Level ${level})`);

  // 2. System Overview
  sections.push('## System Overview');
  const overview = extractSystemOverview(data);
  sections.push(overview);

  // 3. Architecture
  sections.push('## Architecture');
  const architecture = inferArchitecture(data);
  sections.push(architecture);

  // 4. Folder Structure (レベル5では深さを制限)
  sections.push('## Folder Structure');
  const folderTree = limitFolderTreeDepth(data.folderStructureText, level === 5 ? 2 : 99);
  sections.push(`\`\`\`plaintext\n${folderTree}\n\`\`\``);

  // 5. Entry Points
  sections.push('## Entry Points');
  const entryPoints = findEntryPoints(data.files);
  if (entryPoints.length > 0) {
    sections.push(entryPoints.map(f => `- [${f.name}](file:///${f.path})`).join('\n'));
  } else {
    sections.push('No obvious entry points detected.');
  }

  // 6. External Libraries
  sections.push('## External Libraries');
  const extLibs = extractExternalLibraries(data.files);
  if (extLibs.length > 0) {
    sections.push(extLibs.map(lib => `- \`${lib}\``).join('\n'));
  } else {
    sections.push('No external libraries detected or listed.');
  }

  // 7. Module Map (クラス・関数定義情報。レベル4以上は省略)
  if (level < 4) {
    sections.push('## Module Map');
    const moduleMap = buildModuleMap(data.files, level);
    sections.push(moduleMap || 'No significant module definitions analyzed.');
  }

  // 8. Dependencies (ファイル間依存関係。レベル4以上は省略)
  if (level < 4) {
    sections.push('## Dependencies');
    const depsText = buildDependenciesSection(data.files, level);
    sections.push(depsText || 'No local dependency mappings found.');
  }

  // 9. Risk Areas
  sections.push('## Risk Areas');
  const risks = analyzeRiskAreas(data.files);
  if (risks.length > 0) {
    sections.push(risks.map(r => `- **[${r.file}](file:///${r.path})**: ${r.message}`).join('\n'));
  } else {
    sections.push('No significant complexity or dependency risks detected.');
  }

  // 10. Review Focus
  sections.push('## Review Focus');
  const reviewFocus = generateReviewFocus(risks);
  sections.push(reviewFocus);

  return sections.join('\n\n');
}

/**
 * プロジェクト内のドキュメント等から概要を抽出、またはフォルダ構造から簡易説明を生成
 */
function extractSystemOverview(data: ProjectAnalysisData): string {
  // README.md または PROJECT_PLAN.md などのドキュメントファイルを探す
  const docFiles = data.files.filter(f => 
    f.name.toLowerCase() === 'readme.md' || 
    f.name.toLowerCase().includes('plan') || 
    f.name.toLowerCase().includes('specification') ||
    f.name.toLowerCase().includes('仕様書')
  );

  if (docFiles.length > 0) {
    // 最も適したドキュメントファイルの冒頭部分を取得
    const bestDoc = docFiles.find(f => f.name.toLowerCase() === 'readme.md') || docFiles[0];
    if (bestDoc.content) {
      // 最初のいくつかの見出しや段落を抜き出す
      const lines = bestDoc.content.split('\n');
      const overviewLines: string[] = [];
      let headerCount = 0;
      
      for (const line of lines) {
        if (line.trim().startsWith('#')) {
          headerCount++;
        }
        // 見出しが3つ目に入ったら、またはある程度の文字数に達したら打ち切る
        if (headerCount > 3 || overviewLines.join('\n').length > 500) {
          break;
        }
        overviewLines.push(line);
      }
      return overviewLines.join('\n').trim() + '\n\n*(Extracted from ' + bestDoc.name + ')*';
    }
  }

  return 'This project is a TypeScript/JavaScript or Python application. Under audit verification process.';
}

/**
 * フォルダの構成からアーキテクチャ概要を推測
 */
function inferArchitecture(data: ProjectAnalysisData): string {
  const paths = data.files.map(f => f.path);
  const architectureNotes: string[] = [];

  const hasFrontend = paths.some(p => p.includes('src/components') || p.includes('src/app') || p.includes('public/'));
  const hasBackend = paths.some(p => p.includes('server/') || p.includes('api/') || p.includes('backend/'));
  const hasLib = paths.some(p => p.includes('src/lib/') || p.includes('lib/'));

  if (hasFrontend) {
    architectureNotes.push('- **Frontend**: Single Page Application (React/Vite etc.) located in `src/` directory.');
  }
  if (hasBackend) {
    architectureNotes.push('- **Backend**: Server-side modules/API endpoints located in server directories.');
  }
  if (hasLib) {
    architectureNotes.push('- **Core Logic**: Reusable domain modules, parsers or formatters located in `src/lib/` or `lib/`.');
  }

  if (architectureNotes.length === 0) {
    architectureNotes.push('- Standard codebase layout.');
  }

  return 'Based on the folder structures, the application layout includes:\n' + architectureNotes.join('\n');
}

/**
 * フォルダツリーテキストの深さを制限する
 */
function limitFolderTreeDepth(treeText: string, maxDepth: number): string {
  if (maxDepth >= 99) return treeText;

  const lines = treeText.split('\n');
  const filteredLines: string[] = [];

  for (const line of lines) {
    // アスキーアートのインデント（縦線やスペース）から深さを判定
    const match = line.match(/^([│\s]*)(├──|└──|──)/);
    if (match) {
      const prefix = match[1];
      const depth = Math.floor(prefix.length / 4) + 1;
      if (depth <= maxDepth) {
        filteredLines.push(line);
      }
    } else {
      // マッチしない行（空行やルート行など）はそのまま追加
      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}

/**
 * 主要なエントリーポイントファイルを検出
 */
function findEntryPoints(files: FileAnalysisInfo[]): FileAnalysisInfo[] {
  const entryKeywords = ['main.ts', 'main.tsx', 'index.ts', 'index.tsx', 'app.tsx', 'server.js', 'app.py', 'index.html'];
  return files.filter(f => entryKeywords.includes(f.name.toLowerCase()) || f.path.startsWith('src/main'));
}

/**
 * 外部ライブラリの一覧を集約
 */
function extractExternalLibraries(files: FileAnalysisInfo[]): string[] {
  const libs = new Set<string>();
  for (const file of files) {
    for (const dep of file.dependencies) {
      if (dep.isExternal) {
        libs.add(dep.importPath);
      }
    }
  }
  return Array.from(libs).sort();
}

/**
 * 優先度の低いファイル（テストや設定ファイル）を判定
 */
function isLowPriorityFile(file: FileAnalysisInfo): boolean {
  const pathLower = file.path.toLowerCase();
  return (
    pathLower.includes('__tests__') ||
    pathLower.includes('test.') ||
    pathLower.includes('.spec.') ||
    pathLower.includes('config.') ||
    pathLower.includes('constants.') ||
    pathLower.includes('setup')
  );
}

/**
 * クラス・関数の定義情報 (Module Map) を構築
 */
function buildModuleMap(files: FileAnalysisInfo[], level: number): string {
  const mapLines: string[] = [];

  for (const file of files) {
    // レベル3では、優先度の低いファイルを省略
    if (level >= 3 && isLowPriorityFile(file)) {
      continue;
    }

    if (!file.analysis) continue;
    const { classes, functions } = file.analysis;
    if (classes.length === 0 && functions.length === 0) continue;

    mapLines.push(`### [${file.path}](file:///${file.path})`);

    // クラス情報
    for (const cls of classes) {
      let clsHeader = `- **Class**: \`${cls.name}\``;
      if (cls.extends) {
        clsHeader += ` extends \`${cls.extends}\``;
      }
      mapLines.push(clsHeader);

      if (level < 1 && cls.description) {
        mapLines.push(`  > ${cls.description.replace(/\n/g, '\n  > ')}`);
      }

      for (const method of cls.methods) {
        let methodSig = `  - \`method ${method.name}`;
        if (level < 2) {
          methodSig += `(${method.arguments.join(', ')})`;
          if (method.returnType) {
            methodSig += `: ${method.returnType}`;
          }
        }
        methodSig += '`';
        mapLines.push(methodSig);

        if (level < 1 && method.description) {
          mapLines.push(`    * ${method.description.replace(/\n/g, '\n    * ')}`);
        }
      }
    }

    // 関数情報
    for (const func of functions) {
      let funcSig = `- **Function**: \`${func.name}`;
      if (level < 2) {
        funcSig += `(${func.arguments.join(', ')})`;
        if (func.returnType) {
          funcSig += `: ${func.returnType}`;
        }
      }
      funcSig += '`';
      mapLines.push(funcSig);

      if (level < 1 && func.description) {
        mapLines.push(`  > ${func.description.replace(/\n/g, '\n  > ')}`);
      }
    }
  }

  return mapLines.join('\n');
}

/**
 * 内部依存関係の記述部を構築
 */
function buildDependenciesSection(files: FileAnalysisInfo[], level: number): string {
  const depLines: string[] = [];

  for (const file of files) {
    if (level >= 3 && isLowPriorityFile(file)) {
      continue;
    }

    const localDeps = file.dependencies.filter(d => !d.isExternal && d.resolvedPath);
    if (localDeps.length === 0) continue;

    depLines.push(`- **[${file.name}](file:///${file.path})** depends on:`);
    for (const dep of localDeps) {
      depLines.push(`  - [${dep.resolvedPath}](file:///${dep.resolvedPath})`);
    }
  }

  return depLines.join('\n');
}

interface RiskInfo {
  file: string;
  path: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * ファイルごとの静的リスク（サイズ過大、複雑度等）を分析
 */
function analyzeRiskAreas(files: FileAnalysisInfo[]): RiskInfo[] {
  const risks: RiskInfo[] = [];

  for (const file of files) {
    // 1. サイズ過大リスク (100KB超)
    if (file.size > 100 * 1024) {
      risks.push({
        file: file.name,
        path: file.path,
        message: `File size is large (${(file.size / 1024).toFixed(1)} KB), which may impact cognitive load.`,
        severity: 'medium'
      });
    }

    if (file.analysis) {
      // 2. クラス内のメソッド数が多すぎる (15個超)
      for (const cls of file.analysis.classes) {
        if (cls.methods.length > 15) {
          risks.push({
            file: file.name,
            path: file.path,
            message: `Class \`${cls.name}\` has too many methods (${cls.methods.length}). Suggest refactoring.`,
            severity: 'medium'
          });
        }
      }

      // 3. モジュール内の定義数が多すぎる (20個超)
      const definitionCount = file.analysis.classes.length + file.analysis.functions.length;
      if (definitionCount > 20) {
        risks.push({
          file: file.name,
          path: file.path,
          message: `Module has high density of symbols (${definitionCount} classes/functions).`,
          severity: 'low'
        });
      }
    }

    // 4. 依存関係の集中 (依存先が8個超)
    const localDeps = file.dependencies.filter(d => !d.isExternal);
    if (localDeps.length > 8) {
      risks.push({
        file: file.name,
        path: file.path,
        message: `Module has high number of local dependencies (${localDeps.length}). Highly coupled.`,
        severity: 'high'
      });
    }
  }

  return risks;
}

/**
 * リスク情報からレビュー重点項目を構築
 */
function generateReviewFocus(risks: RiskInfo[]): string {
  const highRisks = risks.filter(r => r.severity === 'high');
  const medRisks = risks.filter(r => r.severity === 'medium');

  const focusPoints: string[] = [];

  if (highRisks.length > 0) {
    focusPoints.push(`1. **Highly Coupled Modules**: Focus on architectural boundary decoupling, specifically for modules with high dependencies like ${highRisks.map(r => `\`${r.file}\``).slice(0, 3).join(', ')}.`);
  }
  if (medRisks.length > 0) {
    focusPoints.push(`2. **Large File Sizes / Class complexity**: Verify if large classes or files (${medRisks.map(r => `\`${r.file}\``).slice(0, 3).join(', ')}) can be split or simplified.`);
  }

  focusPoints.push('3. **API Integrity & Typings**: Verify interface boundaries, parameters, and error handling for main entry points.');
  focusPoints.push('4. **Security & Data Isolation**: Review that no hardcoded credentials or unwanted external requests exist.');

  return focusPoints.join('\n');
}
