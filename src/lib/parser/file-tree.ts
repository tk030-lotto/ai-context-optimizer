import { DEFAULT_EXCLUDED_DIRS, DEFAULT_EXCLUDED_EXTS } from '../config/constants';

interface FileSystemDirectoryHandleIterable extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

export interface FileNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileNode[];
  size?: number;
}

export interface TraverseOptions {
  excludedDirs?: string[];
  excludedExts?: Set<string>;
}

const COMPOUND_EXTENSIONS = ['.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst', '.tar.br'];

function extractFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  for (const compound of COMPOUND_EXTENSIONS) {
    if (lower.endsWith(compound)) {
      return compound;
    }
  }
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex !== -1 ? fileName.substring(dotIndex).toLowerCase() : '';
}

/**
 * File System Access API を用いてディレクトリを再帰的に走査します。
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
      const ext = extractFileExtension(entry.name);
      
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

  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

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