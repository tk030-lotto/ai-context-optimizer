export interface ResolvedDependency {
  importPath: string;
  resolvedPath?: string;
  isExternal: boolean;
}

/**
 * コメント行を除去したテキストを返します。
 * 解析の精度を向上させるために使用します。
 */
function removeComments(content: string, fileExtension: string): string {
  const ext = fileExtension.toLowerCase();
  if (ext === '.py') {
    // Pythonのコメント除去 (# と トリプルクォート)
    let cleaned = content.replace(/#.*/g, '');
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');
    return cleaned;
  } else {
    // JS/TS系のコメント除去 (// と /* */)
    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // 行コメントは行末まで置換。URL等の http:// などに影響を与えないよう、簡略化しつつ注意
    cleaned = cleaned.replace(/\/\/.*/g, '');
    return cleaned;
  }
}

/**
 * ファイルのテキストからインポートされているパスのリストを抽出します。
 */
export function extractDependencies(fileContent: string, fileExtension: string): string[] {
  const cleanedContent = removeComments(fileContent, fileExtension);
  const dependencies = new Set<string>();
  const ext = fileExtension.toLowerCase();

  if (ext === '.py') {
    // Pythonのインポート抽出
    // 1. `import a, b, c` のパターン
    const importRegex = /^\s*import\s+([a-zA-Z0-9_\s,.]+)/gm;
    let match;
    while ((match = importRegex.exec(cleanedContent)) !== null) {
      const parts = match[1].split(',');
      for (const part of parts) {
        const name = part.trim().split(/\s+/)[0]; // `import a as b` の対策
        if (name) dependencies.add(name);
      }
    }

    // 2. `from a import b` のパターン
    const fromImportRegex = /^\s*from\s+([a-zA-Z0-9_\.]+)\s+import/gm;
    while ((match = fromImportRegex.exec(cleanedContent)) !== null) {
      const name = match[1].trim();
      if (name) dependencies.add(name);
    }
  } else {
    // JS/TSのインポート抽出
    // 1. `import ... from 'path'` または `export ... from 'path'`
    const fromRegex = /(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = fromRegex.exec(cleanedContent)) !== null) {
      dependencies.add(match[1]);
    }

    // 2. `import('path')` または `require('path')`
    const callRegex = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = callRegex.exec(cleanedContent)) !== null) {
      dependencies.add(match[1]);
    }

    // 3. `import 'path'`
    const directImportRegex = /\bimport\s+['"]([^'"]+)['"]/g;
    while ((match = directImportRegex.exec(cleanedContent)) !== null) {
      dependencies.add(match[1]);
    }
  }

  return Array.from(dependencies);
}

/**
 * 相対パスをスタックを用いて正規化します。
 * (例: "src/lib/parser" + "../config/constants" -> "src/lib/config/constants")
 */
function normalizeRelativePath(baseDir: string, relativePath: string): string {
  const baseParts = baseDir ? baseDir.split('/') : [];
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (part === '.' || part === '') {
      continue;
    }
    if (part === '..') {
      if (baseParts.length > 0) {
        baseParts.pop();
      }
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

/**
 * インポートパスからプロジェクト内の実ファイルを解決します。
 * 
 * @param sourceFilePath 解析対象ファイルのプロジェクトルートからの相対パス (例: "src/lib/parser/file-tree.ts")
 * @param importPath 抽出されたインポートパス (例: "../config/constants" または "react")
 * @param allProjectFiles プロジェクト内の全ファイルの相対パス一覧
 */
export function resolveDependencyPath(
  sourceFilePath: string,
  importPath: string,
  allProjectFiles: string[]
): ResolvedDependency {
  const isRelative = importPath.startsWith('.') || importPath.startsWith('/');
  
  if (!isRelative) {
    return {
      importPath,
      isExternal: true
    };
  }

  // 1. ソースファイルのディレクトリを取得
  const lastSlashIndex = sourceFilePath.lastIndexOf('/');
  const baseDir = lastSlashIndex !== -1 ? sourceFilePath.substring(0, lastSlashIndex) : '';

  // 2. パスを解決・正規化
  const resolvedBase = normalizeRelativePath(baseDir, importPath);

  // 3. 拡張子候補を当てはめて実在確認
  // JS/TS/Python/CSS 等の一般的なファイル拡張子を探索
  const extensions = [
    // JS/TS
    '.ts', '.tsx', '.js', '.jsx', '.d.ts',
    // ディレクトリインポート (Node/Vite等)
    '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
    // Python
    '.py', '/__init__.py',
    // CSS/その他
    '.css', '.json'
  ];

  // 完全一致する場合 (すでに拡張子が含まれているインポート)
  if (allProjectFiles.includes(resolvedBase)) {
    return {
      importPath,
      resolvedPath: resolvedBase,
      isExternal: false
    };
  }

  // 拡張子を補完して検索
  for (const ext of extensions) {
    const checkPath = resolvedBase + ext;
    if (allProjectFiles.includes(checkPath)) {
      return {
        importPath,
        resolvedPath: checkPath,
        isExternal: false
      };
    }
  }

  // 解決できなかったが、相対パスなので外部ではない
  return {
    importPath,
    resolvedPath: undefined,
    isExternal: false
  };
}
