/**
 * デフォルトで走査から除外するディレクトリ名のリスト
 */
export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.vite',
  '.nuxt',
  '.idea',
  '.vscode',
  'coverage',
  '.sass-cache',
  'bower_components',
  'jspm_packages',
  '.yarn',
  '.pnpm-store',
  'ai_pipeline' // 本ツールのパイプライン出力フォルダ自体も除外
];

/**
 * デフォルトで読み込みを除外するバイナリ・メディア等のファイル拡張子（すべて小文字・ドット含む）
 */
export const DEFAULT_EXCLUDED_EXTS = new Set([
  // 画像
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.tiff', '.bmp',
  // 音声・動画
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',
  // 圧縮・アーカイブ
  '.zip', '.gz', '.tar', '.tgz', '.rar', '.7z', '.bz2',
  // ドキュメント（バイナリ形式）
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // 実行ファイル・バイナリ
  '.exe', '.dll', '.so', '.dylib', '.bin', '.out', '.class', '.o',
  // フォント
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // その他ロック・データベース・キャッシュ
  '.sqlite', '.db', '.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
]);

/**
 * 読み込みを許可するデフォルトの最大ファイルサイズ（バイト）
 * デフォルト: 512KB (524,288 バイト)
 */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 512 * 1024;
