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

// Regexp to catch any http:// or https:// but ignore standard localhosts and data URIs
const URL_PATTERN = /https?:\/\/(?!(localhost|127\.0\.0\.1|::1)\b)[a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=%]+/g;

// List of allowed files or patterns (if any)
const ALLOWED_EXCEPTIONS = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    // Check keywords
    VIOLATING_KEYWORDS.forEach(regex => {
      if (regex.test(line)) {
        violations.push({
          line: index + 1,
          content: line.trim(),
          reason: `Detected keyword: ${regex.toString()}`
        });
      }
    });

    // Check URLs
    let match;
    while ((match = URL_PATTERN.exec(line)) !== null) {
      const url = match[0];
      // Basic exception checks
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
    } else if (stat.isFile() && /\.(js|ts|jsx|tsx)$/.test(file)) {
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
