import { DEFAULT_EXCLUDED_DIRS, DEFAULT_EXCLUDED_EXTS } from '../config/constants';

// FileSystemDirectoryHandle.values() は TypeScript 標準 lib 未定義のため型補完
interface FileSystemDirectoryHandleIterable extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

export interface FileNode {
  name: string;
  path: string; // Relative path from the root
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileNode[];
  size?: number;
}

export interface TraverseOptions {
  excludedDirs?: string[];
  excludedExts?: Set<string>;
}

/**
 * File System Access API を用いてディレクトリを再帰的に走査します。
 * 
 * @param dirHandle ルートまたはサブディレクトリのハンドル
 * @param currentPath ルートからの相対パス
 * @param options 除外設定などのオプション
 */
export async function traverseDirectory(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = '',
  options: TraverseOptions = {}
): Promise<FileNode[]> {
  const excludedDirs = options.excludedDirs || DEFAULT_EXCLUDED_DIRS;
  const excludedExts = options.excludedExts || DEFAULT_EXCLUDED_EXTS;

  const nodes: FileNode[] = [];

  for await (const entry of (dirHandle as FileSystemDirectoryHandleIterable).values()) {
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      if (excludedDirs.includes(entry.name)) {
        continue;
      }
      const children = await traverseDirectory(entry, relativePath, options);
      nodes.push({
        name: entry.name,
        path: relativePath,
        kind: 'directory',
        handle: entry,
        children
      });
    } else if (entry.kind === 'file') {
      const dotIndex = entry.name.lastIndexOf('.');
      const ext = dotIndex !== -1 ? entry.name.substring(dotIndex).toLowerCase() : '';
      
      // 拡張子またはファイル名自体が除外リストにあればスキップ
      if (excludedExts.has(ext) || excludedExts.has(entry.name)) {
        continue;
      }

      let size = 0;
      try {
        const file = await entry.getFile();
        size = file.size;
      } catch (e) {
        console.warn(`Failed to get file details for ${entry.name}:`, e);
      }

      nodes.push({
        name: entry.name,
        path: relativePath,
        kind: 'file',
        handle: entry,
        size
      });
    }
  }

  // ディレクトリが先、ファイルが後になるよう名前順でソート
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * バイト数を読みやすい形式（KB, MB 等）にフォーマットします。
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

/**
 * 走査されたファイルノード配列から、視覚的なフォルダツリーテキストを生成します。
 */
export function generateTreeText(nodes: FileNode[], prefix = ''): string {
  let text = '';
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    
    if (node.kind === 'directory') {
      text += `${prefix}${connector}${node.name}/\n`;
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      if (node.children && node.children.length > 0) {
        text += generateTreeText(node.children, nextPrefix);
      }
    } else {
      const sizeStr = node.size !== undefined ? ` (${formatBytes(node.size)})` : '';
      text += `${prefix}${connector}${node.name}${sizeStr}\n`;
    }
  }
  return text;
}
