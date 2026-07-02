export interface FunctionInfo {
  name: string;
  arguments: string[];
  returnType?: string;
  description?: string;
  isExported?: boolean;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  description?: string;
  methods: FunctionInfo[];
  isExported?: boolean;
}

export interface ModuleAnalysisResult {
  classes: ClassInfo[];
  functions: FunctionInfo[];
  exports: string[];
}

/**
 * JS/TSコード内の定義の直前のJSDocコメントを取得します。
 */
function getJsDocDescription(content: string, index: number): string | undefined {
  // 定義のインデックスから手前を探索
  const beforeText = content.substring(0, index);
  const trimmed = beforeText.trimEnd();
  
  // */ で終わっているかチェック
  if (!trimmed.endsWith('*/')) {
    return undefined;
  }

  // /** を探す
  const lastDocStart = trimmed.lastIndexOf('/**');
  if (lastDocStart === -1) {
    return undefined;
  }

  // /** から */ までの間に関係ない文字（他のコードなど）が含まれていないかチェック
  const docComment = trimmed.substring(lastDocStart);
  // 他のコードブロックの閉じ括弧などが含まれる場合はJSDocではない
  if (docComment.includes('}') || docComment.includes(';')) {
    // 簡易的に判定。厳密ではないが実用上十分
    const lines = docComment.split('\n');
    // すべての行がコメント記号で始まっているか
    const isClean = lines.every((line, idx) => {
      const l = line.trim();
      return idx === 0 ? l.startsWith('/**') : (l.startsWith('*') || l.startsWith('*/'));
    });
    if (!isClean) return undefined;
  }

  // 内容をクリーンアップ
  return docComment
    .replace(/^\/\*\*|\*\/$/g, '') // 開始・終了タグの除去
    .split('\n')
    .map(line => line.trim().replace(/^\*\s*/, '')) // 行頭の * と空白を除去
    .filter(line => line.length > 0 && !line.startsWith('@')) // タグ (@param 等) は除外
    .join('\n')
    .trim();
}

/**
 * Pythonコード内のクラス・関数の定義直後のDocstringを取得します。
 */
function getPythonDocstring(lines: string[], startLineIndex: number): string | undefined {
  let currentIdx = startLineIndex + 1;
  // 空行をスキップ
  while (currentIdx < lines.length && lines[currentIdx].trim() === '') {
    currentIdx++;
  }

  if (currentIdx >= lines.length) return undefined;

  const line = lines[currentIdx].trim();
  let quoteChar = '';
  if (line.startsWith('"""')) quoteChar = '"""';
  else if (line.startsWith("'''")) quoteChar = "'''";

  if (!quoteChar) return undefined;

  // 1行で完結している場合
  if (line.endsWith(quoteChar) && line.length > quoteChar.length * 2) {
    return line.substring(quoteChar.length, line.length - quoteChar.length).trim();
  }

  // 複数行にわたる場合
  const docLines: string[] = [];
  // 最初の行のクォート以降を取得
  const firstLineContent = line.substring(quoteChar.length).trim();
  if (firstLineContent) docLines.push(firstLineContent);

  currentIdx++;
  while (currentIdx < lines.length) {
    const l = lines[currentIdx];
    if (l.trim().endsWith(quoteChar)) {
      const lastLineContent = l.trim().substring(0, l.trim().length - quoteChar.length).trim();
      if (lastLineContent) docLines.push(lastLineContent);
      break;
    }
    docLines.push(l.trim());
    currentIdx++;
  }

  return docLines.join('\n').trim();
}

/**
 * JS/TSにおけるクラスの中身（波括弧 { } の範囲）を抽出します。
 */
function extractJsClassBody(content: string, classIndex: number): { body: string; endIndex: number } | null {
  const classStartIndex = content.indexOf('{', classIndex);
  if (classStartIndex === -1) return null;

  let braceCount = 1;
  let idx = classStartIndex + 1;

  while (idx < content.length && braceCount > 0) {
    const char = content[idx];
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
    }
    idx++;
  }

  if (braceCount === 0) {
    return {
      body: content.substring(classStartIndex + 1, idx - 1),
      endIndex: idx
    };
  }

  return null;
}

/**
 * JS/TS用のモジュール解析
 */
function analyzeJsTsModule(content: string): ModuleAnalysisResult {
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];
  const exports: string[] = [];

  // エクスポートシンボルの抽出 (例: export { foo, bar })
  const namedExportsRegex = /export\s+\{\s*([a-zA-Z0-9_,\s]+)\s*\}/g;
  let match;
  while ((match = namedExportsRegex.exec(content)) !== null) {
    const symbols = match[1].split(',').map(s => s.trim());
    for (const sym of symbols) {
      if (sym) exports.push(sym);
    }
  }

  // 1. クラス定義の解析
  // export または export default に対応
  const classRegex = /(?:export\s+(?:default\s+)?)?class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_<>\.,\s]+))?/g;
  const processedClassIndexes: number[] = [];

  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const extendsClass = match[2]?.trim();
    const isExported = match[0].startsWith('export');
    const classIndex = match.index;

    if (isExported) {
      exports.push(className);
    }

    const jsdoc = getJsDocDescription(content, classIndex);
    const bodyInfo = extractJsClassBody(content, classIndex);

    const methods: FunctionInfo[] = [];
    if (bodyInfo) {
      processedClassIndexes.push(classIndex);
      // クラスボディ内のメソッド抽出
      const methodRegex = /(?:async\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
      let methodMatch;
      while ((methodMatch = methodRegex.exec(bodyInfo.body)) !== null) {
        const methodName = methodMatch[1];
        // constructor やゲッターセッター風のものはメソッドから除外するか
        if (methodName === 'constructor') continue;

        const args = methodMatch[2].split(',').map(a => a.trim().split(':')[0].trim()).filter(Boolean);
        const retType = methodMatch[3]?.trim();
        
        // メソッドのJSDoc抽出
        const methodDoc = getJsDocDescription(bodyInfo.body, methodMatch.index);

        methods.push({
          name: methodName,
          arguments: args,
          returnType: retType,
          description: methodDoc
        });
      }
    }

    classes.push({
      name: className,
      extends: extendsClass,
      description: jsdoc,
      methods,
      isExported
    });
  }

  // 2. 関数定義の解析 (通常の function キーワード)
  const funcRegex = /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1];
    const isExported = match[0].startsWith('export');
    const args = match[2].split(',').map(a => a.trim().split(':')[0].trim()).filter(Boolean);
    const retType = match[3]?.trim();
    const jsdoc = getJsDocDescription(content, match.index);

    if (isExported) {
      exports.push(funcName);
    }

    functions.push({
      name: funcName,
      arguments: args,
      returnType: retType,
      description: jsdoc,
      isExported
    });
  }

  // 3. アロー関数の解析 (定数として export されるもの)
  const arrowRegex = /(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const funcName = match[1];
    const isExported = match[0].startsWith('export');
    const args = match[2].split(',').map(a => a.trim().split(':')[0].trim()).filter(Boolean);
    const retType = match[3]?.trim();
    const jsdoc = getJsDocDescription(content, match.index);

    if (isExported) {
      exports.push(funcName);
    }

    functions.push({
      name: funcName,
      arguments: args,
      returnType: retType,
      description: jsdoc,
      isExported
    });
  }

  return {
    classes,
    functions,
    exports: Array.from(new Set(exports))
  };
}

/**
 * Python用のモジュール解析
 */
function analyzePythonModule(content: string): ModuleAnalysisResult {
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];
  const exports: string[] = [];

  const lines = content.split('\n');

  // インデントの深さを測る
  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. クラス定義の検出
    if (trimmed.startsWith('class ')) {
      const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?:/);
      if (classMatch) {
        const className = classMatch[1];
        const baseClass = classMatch[2]?.trim();
        const docstring = getPythonDocstring(lines, i);
        const classIndent = getIndent(line);

        exports.push(className);

        // クラスボディ内のメソッド抽出
        const methods: FunctionInfo[] = [];
        let j = i + 1;
        
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();

          // 空行はスキップ
          if (nextTrimmed === '') {
            j++;
            continue;
          }

          // インデントがクラス定義以下になったらクラススコープ終了
          if (getIndent(nextLine) <= classIndent) {
            break;
          }

          // メソッド定義の検出
          if (nextTrimmed.startsWith('def ')) {
            const methodMatch = nextTrimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
            if (methodMatch) {
              const methodName = methodMatch[1];
              // self 等を除いた引数リスト
              const args = methodMatch[2]
                .split(',')
                .map(a => a.trim().split(':')[0].trim())
                .filter(a => a && a !== 'self' && a !== 'cls');
              const retType = methodMatch[3]?.trim();
              const methodDoc = getPythonDocstring(lines, j);

              methods.push({
                name: methodName,
                arguments: args,
                returnType: retType,
                description: methodDoc
              });
            }
          }
          j++;
        }

        classes.push({
          name: className,
          extends: baseClass,
          description: docstring,
          methods,
          isExported: true // Pythonは基本的にモジュールレベルはすべて公開
        });
        
        // クラスの末尾までインデックスを進める (j-1 まで処理済み)
        i = j - 1;
      }
    }
    // 2. モジュールレベルの関数定義の検出
    else if (trimmed.startsWith('def ')) {
      const funcMatch = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const args = funcMatch[2]
          .split(',')
          .map(a => a.trim().split(':')[0].trim())
          .filter(Boolean);
        const retType = funcMatch[3]?.trim();
        const docstring = getPythonDocstring(lines, i);

        exports.push(funcName);

        functions.push({
          name: funcName,
          arguments: args,
          returnType: retType,
          description: docstring,
          isExported: true
        });
      }
    }
  }

  return {
    classes,
    functions,
    exports
  };
}

/**
 * ファイルの拡張子に基づいて、関数名、クラス名、API仕様を解析・抽出します。
 * 
 * @param fileContent ファイルのテキストコンテンツ
 * @param fileExtension ファイルの拡張子 (.ts, .js, .py 等)
 */
export function analyzeModule(fileContent: string, fileExtension: string): ModuleAnalysisResult {
  const ext = fileExtension.toLowerCase();
  if (ext === '.py') {
    return analyzePythonModule(fileContent);
  } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return analyzeJsTsModule(fileContent);
  }
  
  // 未対応のファイル形式は空の解析結果を返す
  return {
    classes: [],
    functions: [],
    exports: []
  };
}
