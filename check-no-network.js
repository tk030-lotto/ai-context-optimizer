import fs from 'fs';
import path from 'path';

const TARGET_DIR = './src';
const VIOLATING_KEYWORDS = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /navigator\.sendBeacon/
];

// List of allowed files or patterns (if any)
const ALLOWED_EXCEPTIONS = [];

/**
 * 外部URLを検出する正規表現。グローバルフラグ付きのため、
 * ファイルごとに新しいインスタンスを生成して lastIndex 蓄積バグを防止する。
 */
function createUrlPattern() {
  return /https?:\/\/(?!(localhost|127\.0\.0\.1|::1)\b)[a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=%]+/g;
}

/**
 * HTML固有の外部リソース参照パターン (src=, href=, url() など)
 * スクリプトやスタイルシートの外部読み込みを検出する。
 */
const HTML_EXTERNAL_RESOURCE_PATTERNS = [
  /(?:src|href|action)\s*=\s*["']https?:\/\/(?!(localhost|127\.0\.0\.1))[^"']+["']/,
  /url\s*\(\s*["']?https?:\/\/(?!(localhost|127\.0\.0\.1))[^"')]+["']?\s*\)/,
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];
  const ext = path.extname(filePath).toLowerCase();
  const isHtmlOrCss = ext === '.html' || ext === '.css';

  lines.forEach((line, index) => {
    if (!isHtmlOrCss) {
      // JS/TS ファイル: ネットワーク系キーワードチェック
      VIOLATING_KEYWORDS.forEach(regex => {
        if (regex.test(line)) {
          violations.push({
            line: index + 1,
            content: line.trim(),
            reason: `Detected keyword: ${regex.toString()}`
          });
        }
      });
    } else {
      // HTML/CSS ファイル: 外部リソース参照パターンチェック
      HTML_EXTERNAL_RESOURCE_PATTERNS.forEach(regex => {
        if (regex.test(line)) {
          violations.push({
            line: index + 1,
            content: line.trim(),
            reason: `Detected external resource reference in ${ext.toUpperCase()}: ${regex.toString()}`
          });
        }
      });
    }

    // 全ファイル共通: ファイルごとに新しい正規表現インスタンスで外部 URL チェック（lastIndex 蓄積防止）
    const urlPattern = createUrlPattern();
    let match;
    while ((match = urlPattern.exec(line)) !== null) {
      const url = match[0];
      violations.push({
        line: index + 1,
        content: line.trim(),
        reason: `Detected external URL: ${url}`
      });
    }
  });

  return violations;
}

function scanDir(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (stat.isFile() && /\.(js|ts|jsx|tsx|html|css)$/.test(file)) {
      const fileViolations = checkFile(fullPath);
      if (fileViolations.length > 0) {
        results.push({
          file: fullPath,
          violations: fileViolations
        });
      }
    }
  });

  return results;
}

console.log('=== Starting No-Network Static Scan ===');
console.log(`Scanning directory: ${TARGET_DIR}`);
const allViolations = scanDir(TARGET_DIR);

if (allViolations.length > 0) {
  console.error('\n🔴 SECURITY VIOLATION: External network communication detected!');
  allViolations.forEach(item => {
    console.error(`\nFile: ${item.file}`);
    item.violations.forEach(v => {
      console.error(`  Line ${v.line}: ${v.reason}`);
      console.error(`    > ${v.content}`);
    });
  });
  console.log('\nScan failed.');
  process.exit(1);
} else {
  console.log('\n🟢 PASS: No external network communication detected. Security policy verified.');
  process.exit(0);
}
