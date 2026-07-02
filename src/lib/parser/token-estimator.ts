export interface ReadTimeResult {
  aiTimeSeconds: number;
  humanTimeMinutes: number;
  aiTimeFormatted: string;
  humanTimeFormatted: string;
}

/**
 * テキストの簡易トークン数を推定します。
 * 
 * 英語・半角記号（コード等）：文字数 / 3.8
 * 日本語・全角文字：文字数 * 1.3
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // ASCII文字 (半角英数・記号・改行・スペースなど) をマッチング
  const asciiMatch = text.match(/[\x00-\x7F]/g);
  const asciiCount = asciiMatch ? asciiMatch.length : 0;
  
  // 非ASCII文字 (日本語・全角記号など) の文字数
  const nonAsciiCount = text.length - asciiCount;

  // 各種比率で計算
  const asciiTokens = asciiCount / 3.8;
  const nonAsciiTokens = nonAsciiCount * 1.3;

  return Math.ceil(asciiTokens + nonAsciiTokens);
}

/**
 * 推定トークン数と文字数から、AIの想定読込時間および人間の想定読了時間を計算します。
 * 
 * AI処理想定時間：5,000 トークン/秒で処理と仮定
 * 人間読了想定時間：800 文字/分で読了と仮定
 */
export function calculateReadTime(tokenCount: number, charCount: number): ReadTimeResult {
  // AIのインジェスト想定時間 (秒)
  const aiTimeSeconds = parseFloat((tokenCount / 5000).toFixed(2));
  
  // 人間の読了想定時間 (分)
  const humanTimeMinutes = parseFloat((charCount / 800).toFixed(1));

  // フォーマットの作成
  const aiTimeFormatted = aiTimeSeconds < 0.1 
    ? '0.1秒未満' 
    : `${aiTimeSeconds}秒`;

  let humanTimeFormatted = '';
  if (humanTimeMinutes < 0.1) {
    humanTimeFormatted = '数秒';
  } else if (humanTimeMinutes < 1) {
    const seconds = Math.round(humanTimeMinutes * 60);
    humanTimeFormatted = `${seconds}秒`;
  } else {
    humanTimeFormatted = `${Math.ceil(humanTimeMinutes)}分`;
  }

  return {
    aiTimeSeconds,
    humanTimeMinutes,
    aiTimeFormatted,
    humanTimeFormatted
  };
}
