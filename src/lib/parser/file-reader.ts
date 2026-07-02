import { DEFAULT_EXCLUDED_EXTS, DEFAULT_MAX_FILE_SIZE_BYTES } from '../config/constants';

/**
 * ファイルが読み込み可能（テキストファイルかつサイズ上限以内）かを判定します。
 * 
 * @param fileName ファイル名
 * @param size ファイルサイズ（バイト）
 * @param maxBytes 許容する最大サイズ（バイト）
 * @param excludedExts 除外拡張子のセット
 */
export function isReadableFile(
  fileName: string,
  size: number,
  maxBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
  excludedExts = DEFAULT_EXCLUDED_EXTS
): boolean {
  // サイズ制限の検証
  if (size > maxBytes) {
    return false;
  }

  // 拡張子の検証
  const dotIndex = fileName.lastIndexOf('.');
  const ext = dotIndex !== -1 ? fileName.substring(dotIndex).toLowerCase() : '';
  if (excludedExts.has(ext) || excludedExts.has(fileName)) {
    return false;
  }

  return true;
}

/**
 * FileSystemFileHandle から安全にテキストコンテンツをデコードして読み込みます。
 * 
 * @param handle ファイルのハンドル
 */
export async function readFileContent(handle: FileSystemFileHandle): Promise<string> {
  try {
    const file = await handle.getFile();
    return await file.text();
  } catch (error) {
    console.error(`Failed to read file: ${handle.name}`, error);
    throw new Error(`ファイル「${handle.name}」の読み込みに失敗しました。: ${error instanceof Error ? error.message : String(error)}`);
  }
}
