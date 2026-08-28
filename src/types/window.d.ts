/**
 * File System Access API の型定義拡張。
 * Chrome/Edge の showDirectoryPicker() を window に追加する。
 */
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
