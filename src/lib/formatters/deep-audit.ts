import { ProjectAnalysisData, FileAnalysisInfo } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface DeepAuditPackOptions {
  maxTokens?: number; // 目標最大トークン（デフォルト 4000）
}

/**
 * 特定のファイル（モジュール）に焦点を当てた詳細な監査パック（Markdown）を生成します。
 * 目標トークン数に収まるよう、必要に応じて自動的に縮退レベルを切り替えます。
 */
export function generateDeepAuditPack(
  data: ProjectAnalysisData,
  targetFilePath: string,
  options: DeepAuditPackOptions = {}
): { markdown: string; fallbackLevel: number; estimatedTokens: number } {
  const maxTokens = options.maxTokens || 4000;
  
  // 縮退レベル 0 から 5 まで順にシミュレーション
  for (let level = 0; level <= 5; level++) {
    const markdown = buildMarkdownForLevel(data, targetFilePath, level);
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
  const fallbackMarkdown = buildMarkdownForLevel(data, targetFilePath, 5);
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
 * 0: フル出力 (ソースコード全文、コメント、関連ファイル、詳細仕様を含む)
 * 1: ソースコード内のコメント (JSDoc/Docstring/インラインコメント) の除去、説明文の省略
 * 2: ソースコードを「スケルトン（定義のみ、実装部省略）」に置換
 * 3: 関連ファイル (Related Files) および 依存関係 (Dependencies) セクションを省略
 * 4: クラス・関数の詳細定義（引数リストや戻り値の型）を省略し、名前のみにする
 * 5: コードブロック (Code Summary) を完全に省略
 */
function buildMarkdownForLevel(
  data: ProjectAnalysisData,
  targetFilePath: string,
  level: number
): string {
  const file = data.files.find(f => f.path === targetFilePath);
  if (!file) {
    return `# Deep Audit Pack - File Not Found\n\nSpecified file \`${targetFilePath}\` could not be found in the project analysis data.`;
  }

  const sections: string[] = [];
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex !== -1 ? file.name.substring(dotIndex).toLowerCase() : '';
  const isPython = ext === '.py';

  // 1. Title
  sections.push(`# Deep Audit Pack - ${file.name}`);

  // 2. Module Name
  sections.push('## Module Name');
  sections.push(`- **Path**: [${file.path}](file:///${file.path})
- **Size**: ${(file.size / 1024).toFixed(2)} KB
- **Language**: ${isPython ? 'Python' : 'JavaScript/TypeScript'}
- **Tokens (Raw File)**: ${file.tokens}
- **Optimized Level**: Level ${level}`);

  // 3. Purpose
  sections.push('## Purpose');
  if (level < 1) {
    const purpose = extractPurpose(file);
    sections.push(purpose);
  } else {
    sections.push('Detailed purpose omitted due to optimization level.');
  }

  // 4. Related Files (レベル3以上は省略)
  if (level < 3) {
    sections.push('## Related Files');
    const related = findRelatedFiles(data, targetFilePath);
    if (related.importedBy.length > 0 || related.dependsOn.length > 0) {
      const relLines: string[] = [];
      if (related.importedBy.length > 0) {
        relLines.push('**Imported by**:');
        related.importedBy.forEach(path => relLines.push(`- [${path}](file:///${path})`));
      }
      if (related.dependsOn.length > 0) {
        if (relLines.length > 0) relLines.push('');
        relLines.push('**Depends on**:');
        related.dependsOn.forEach(path => relLines.push(`- [${path}](file:///${path})`));
      }
      sections.push(relLines.join('\n'));
    } else {
      sections.push('No local related files detected.');
    }
  }

  // 5. Dependencies (レベル3以上は省略)
  if (level < 3) {
    sections.push('## Dependencies');
    const extLibs = file.dependencies.filter(d => d.isExternal).map(d => d.importPath);
    const localDeps = file.dependencies.filter(d => !d.isExternal && d.resolvedPath).map(d => d.resolvedPath!);

    const depLines: string[] = [];
    if (extLibs.length > 0) {
      depLines.push('**External Libraries**:');
      extLibs.forEach(lib => depLines.push(`- \`${lib}\``));
    }
    if (localDeps.length > 0) {
      if (depLines.length > 0) depLines.push('');
      depLines.push('**Local Imports**:');
      localDeps.forEach(path => depLines.push(`- [${path}](file:///${path})`));
    }

    if (depLines.length === 0) {
      sections.push('No import dependencies detected.');
    } else {
      sections.push(depLines.join('\n'));
    }
  }

  // 6. Public APIs
  sections.push('## Public APIs');
  const publicApis = buildPublicApisList(file);
  sections.push(publicApis || 'No public exports detected.');

  // 7. Classes
  sections.push('## Classes');
  const classesText = buildClassesSection(file, level);
  sections.push(classesText || 'No classes defined in this module.');

  // 8. Functions
  sections.push('## Functions');
  const functionsText = buildFunctionsSection(file, level);
  sections.push(functionsText || 'No module-level functions defined.');

  // 9. Data Flow
  sections.push('## Data Flow');
  const dataFlow = inferDataFlow(file);
  sections.push(dataFlow);

  // 10. Code Summary (レベル5は省略)
  if (level < 5) {
    sections.push('## Code Summary');
    const codeBlockLang = isPython ? 'python' : (ext === '.tsx' ? 'tsx' : 'typescript');
    let codeContent = '';
    
    if (level === 0) {
      codeContent = file.content || '// No source content available';
    } else if (level === 1) {
      codeContent = cleanCodeComments(file.content || '', ext);
    } else {
      // レベル 2, 3, 4 ではスケルトンコードを表示
      codeContent = buildSkeletonCode(file, ext, level);
    }
    
    sections.push(`\`\`\`${codeBlockLang}\n${codeContent}\n\`\`\``);
  }

  // 11. Potential Risks
  sections.push('## Potential Risks');
  const risks = analyzePotentialRisks(file);
  if (risks.length > 0) {
    sections.push(risks.map(r => `- **${r.type}**: ${r.message}`).join('\n'));
  } else {
    sections.push('No significant local risks detected.');
  }

  return sections.join('\n\n');
}

/**
 * モジュールの最初の説明またはJSDocからPurpose（目的）を抽出
 */
function extractPurpose(file: FileAnalysisInfo): string {
  if (file.analysis) {
    // 最初に見つかったクラスまたは関数の説明文を流用
    for (const cls of file.analysis.classes) {
      if (cls.description) return cls.description;
    }
    for (const func of file.analysis.functions) {
      if (func.description) return func.description;
    }
  }
  
  // ファイル冒頭のコメントを簡易抽出
  if (file.content) {
    const lines = file.content.split('\n').slice(0, 10);
    const firstComments: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**')) {
        firstComments.push(trimmed.replace(/^\/\/|^\/\*\*|^\*|\*\/$/g, '').trim());
      } else if (trimmed.startsWith('#')) {
        firstComments.push(trimmed.replace(/^#/g, '').trim());
      } else if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        // Python トリプルクォート開始
        firstComments.push(trimmed.replace(/^"""|^'''/g, '').trim());
      } else if (trimmed !== '') {
        // コメント以外が出現したら打ち切る
        break;
      }
    }
    const cleanComments = firstComments.filter(c => c.length > 0);
    if (cleanComments.length > 0) {
      return cleanComments.join('\n');
    }
  }

  return `This module provides functionality related to \`${file.name}\`.`;
}

/**
 * 関連するローカルファイル（依存先、被依存元）を特定
 */
interface RelatedFilesInfo {
  dependsOn: string[];
  importedBy: string[];
}

function findRelatedFiles(data: ProjectAnalysisData, targetFilePath: string): RelatedFilesInfo {
  const dependsOn: string[] = [];
  const importedBy: string[] = [];

  const targetFile = data.files.find(f => f.path === targetFilePath);
  if (targetFile) {
    // 依存しているファイル
    targetFile.dependencies.forEach(dep => {
      if (!dep.isExternal && dep.resolvedPath) {
        dependsOn.push(dep.resolvedPath);
      }
    });
  }

  // 依存されているファイル（インポート元）
  data.files.forEach(file => {
    if (file.path === targetFilePath) return;
    const isImported = file.dependencies.some(dep => 
      !dep.isExternal && dep.resolvedPath === targetFilePath
    );
    if (isImported) {
      importedBy.push(file.path);
    }
  });

  return {
    dependsOn: Array.from(new Set(dependsOn)).sort(),
    importedBy: Array.from(new Set(importedBy)).sort()
  };
}

/**
 * 公開APIの概要一覧を構築
 */
function buildPublicApisList(file: FileAnalysisInfo): string {
  if (!file.analysis) return '';
  const apis: string[] = [];

  const { classes, functions, exports } = file.analysis;

  // エクスポート宣言されたクラスと関数
  classes.forEach(cls => {
    if (cls.isExported || exports.includes(cls.name)) {
      apis.push(`- **Class**: \`${cls.name}\``);
    }
  });

  functions.forEach(func => {
    if (func.isExported || exports.includes(func.name)) {
      apis.push(`- **Function**: \`${func.name}\``);
    }
  });

  return apis.join('\n');
}

/**
 * Classesセクションをビルド
 */
function buildClassesSection(file: FileAnalysisInfo, level: number): string {
  if (!file.analysis || file.analysis.classes.length === 0) return '';
  const lines: string[] = [];

  for (const cls of file.analysis.classes) {
    let clsHeader = `### Class: \`${cls.name}\``;
    if (cls.extends) {
      clsHeader += ` extends \`${cls.extends}\``;
    }
    lines.push(clsHeader);

    if (level < 1 && cls.description) {
      lines.push(`> ${cls.description.replace(/\n/g, '\n> ')}`);
    }

    if (cls.methods.length > 0) {
      lines.push('\n**Methods**:');
      for (const method of cls.methods) {
        let methodSig = `- \`${method.name}`;
        if (level < 4) {
          methodSig += `(${method.arguments.join(', ')})`;
          if (method.returnType) {
            methodSig += `: ${method.returnType}`;
          }
        }
        methodSig += '\`';
        lines.push(methodSig);

        if (level < 1 && method.description) {
          lines.push(`  > ${method.description.replace(/\n/g, '\n  > ')}`);
        }
      }
    }
    lines.push(''); // クラス間スペース
  }

  return lines.join('\n').trim();
}

/**
 * Functionsセクションをビルド
 */
function buildFunctionsSection(file: FileAnalysisInfo, level: number): string {
  if (!file.analysis || file.analysis.functions.length === 0) return '';
  const lines: string[] = [];

  for (const func of file.analysis.functions) {
    let funcSig = `### Function: \`${func.name}`;
    if (level < 4) {
      funcSig += `(${func.arguments.join(', ')})`;
      if (func.returnType) {
        funcSig += `: ${func.returnType}`;
      }
    }
    funcSig += '\`';
    lines.push(funcSig);

    if (level < 1 && func.description) {
      lines.push(`> ${func.description.replace(/\n/g, '\n> ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * 入出力からデータフローを推測
 */
function inferDataFlow(file: FileAnalysisInfo): string {
  const inputs: string[] = [];
  const outputs: string[] = [];

  // 入力：ローカルインポートなど
  file.dependencies.forEach(dep => {
    if (!dep.isExternal && dep.resolvedPath) {
      const name = dep.resolvedPath.split('/').pop() || dep.importPath;
      inputs.push(`\`${name}\` (local module)`);
    } else if (dep.isExternal) {
      inputs.push(`\`${dep.importPath}\` (external package)`);
    }
  });

  // 出力：公開API
  if (file.analysis) {
    file.analysis.exports.forEach(exp => {
      outputs.push(`\`${exp}\``);
    });
  }

  const inText = inputs.length > 0 ? inputs.join(', ') : 'No special inputs (pure library/entry point)';
  const outText = outputs.length > 0 ? outputs.join(', ') : 'No public exports (executes internally)';

  return `1. **Inputs (Dependencies)**: Imports symbols from ${inText}.
2. **Internal Processing**: Exposes classes or functions for execution.
3. **Outputs (API Boundaries)**: Exports ${outText} to parent/imported modules.`;
}

/**
 * コメントやDocstringをコードから除去
 */
function cleanCodeComments(content: string, ext: string): string {
  const isPython = ext.toLowerCase() === '.py';
  if (isPython) {
    // 1. # コメントの除去
    let cleaned = content.replace(/#.*/g, '');
    // 2. トリプルクォートDocstringの除去
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');
    // 3. 空行の整理
    return cleaned
      .split('\n')
      .map(line => line.trimEnd())
      .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
      .join('\n')
      .trim();
  } else {
    // JS/TS
    // 1. 複数行コメントの除去
    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // 2. 行コメントの除去
    cleaned = cleaned.replace(/(^|[^:])\/\/.*/g, '$1');
    // 3. 空行の整理
    return cleaned
      .split('\n')
      .map(line => line.trimEnd())
      .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
      .join('\n')
      .trim();
  }
}

/**
 * クラス・関数定義データからスケルトンコードを再生成する
 */
function buildSkeletonCode(file: FileAnalysisInfo, ext: string, level: number): string {
  if (!file.analysis) return '// No module analysis structure available to generate skeleton.';
  
  const lines: string[] = [];
  const isPython = ext.toLowerCase() === '.py';

  if (isPython) {
    for (const cls of file.analysis.classes) {
      let clsLine = `class ${cls.name}`;
      if (cls.extends) {
        clsLine += `(${cls.extends})`;
      }
      clsLine += ':';
      lines.push(clsLine);
      
      if (cls.methods.length === 0) {
        lines.push('    pass');
      } else {
        for (const method of cls.methods) {
          let args = '';
          if (level < 4) {
            args = ['self', ...method.arguments].join(', ');
          } else {
            args = '...';
          }
          let methodLine = `    def ${method.name}(${args})`;
          if (level < 4 && method.returnType) {
            methodLine += ` -> ${method.returnType}`;
          }
          methodLine += ':';
          lines.push(methodLine);
          lines.push('        pass');
        }
      }
      lines.push(''); // 空行
    }

    for (const func of file.analysis.functions) {
      let args = '';
      if (level < 4) {
        args = func.arguments.join(', ');
      } else {
        args = '...';
      }
      let funcLine = `def ${func.name}(${args})`;
      if (level < 4 && func.returnType) {
        funcLine += ` -> ${func.returnType}`;
      }
      funcLine += ':';
      lines.push(funcLine);
      lines.push('    pass');
      lines.push('');
    }
  } else {
    for (const cls of file.analysis.classes) {
      const exportPrefix = cls.isExported ? 'export ' : '';
      let clsLine = `${exportPrefix}class ${cls.name}`;
      if (cls.extends) {
        clsLine += ` extends ${cls.extends}`;
      }
      clsLine += ' {';
      lines.push(clsLine);

      for (const method of cls.methods) {
        let args = '';
        if (level < 4) {
          args = method.arguments.join(', ');
        } else {
          args = '...';
        }
        let methodLine = `  ${method.name}(${args})`;
        if (level < 4 && method.returnType) {
          methodLine += `: ${method.returnType}`;
        }
        methodLine += ';';
        lines.push(methodLine);
      }
      lines.push('}');
      lines.push('');
    }

    for (const func of file.analysis.functions) {
      const exportPrefix = func.isExported ? 'export ' : '';
      let args = '';
      if (level < 4) {
        args = func.arguments.join(', ');
      } else {
        args = '...';
      }
      let funcLine = `${exportPrefix}function ${func.name}(${args})`;
      if (level < 4 && func.returnType) {
        funcLine += `: ${func.returnType}`;
      }
      funcLine += ';';
      lines.push(funcLine);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

interface RiskInfo {
  type: string;
  message: string;
}

/**
 * モジュール固有のリスク領域を分析
 */
function analyzePotentialRisks(file: FileAnalysisInfo): RiskInfo[] {
  const risks: RiskInfo[] = [];

  // 1. サイズ過大
  if (file.size > 20 * 1024) {
    risks.push({
      type: 'Large File Size',
      message: `File size is ${(file.size / 1024).toFixed(1)} KB. Suggest extracting core logic to sub-modules.`
    });
  }

  // 2. 結合度（ローカル依存関係数）
  const localDeps = file.dependencies.filter(d => !d.isExternal);
  if (localDeps.length > 5) {
    risks.push({
      type: 'High Coupling',
      message: `Module has ${localDeps.length} local dependencies. High coupling increases regression risks.`
    });
  }

  // 3. クラス内のメソッド過大
  if (file.analysis) {
    for (const cls of file.analysis.classes) {
      if (cls.methods.length > 10) {
        risks.push({
          type: 'Complex Class',
          message: `Class \`${cls.name}\` has ${cls.methods.length} methods. High cognitive load.`
        });
      }
    }
  }

  return risks;
}
