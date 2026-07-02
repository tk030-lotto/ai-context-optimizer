import { ProjectAnalysisData } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface DocPackOptions {
  maxTokens?: number; // 目標最大トークン数（デフォルト 4000）
}

/**
 * プロジェクト仕様書や紹介・まとめ記事の自動生成を目的として、
 * プロジェクトの概要、目的、背景、アーキテクチャ、機能一覧、技術ハイライト、導入メリット、将来計画をまとめる
 * Project Documentation Pack (Markdown) を生成します。
 * 目標トークン数に収まるよう、必要に応じて自動的に縮退レベルを切り替えます。
 */
export function generateDocPack(
  data: ProjectAnalysisData,
  options: DocPackOptions = {}
): { markdown: string; fallbackLevel: number; estimatedTokens: number } {
  const maxTokens = options.maxTokens || 4000;
  
  // 縮退レベル 0 から 5 まで順にシミュレーション
  for (let level = 0; level <= 5; level++) {
    const markdown = buildMarkdownForLevel(data, level);
    const tokens = estimateTokens(markdown);
    
    // 目標トークン数以下に収まった場合、または最終レベルに達した場合はそれを返す
    if (tokens <= maxTokens || level === 5) {
      return {
        markdown,
        fallbackLevel: level,
        estimatedTokens: tokens
      };
    }
  }

  // フォールバック
  const fallbackMarkdown = buildMarkdownForLevel(data, 5);
  return {
    markdown: fallbackMarkdown,
    fallbackLevel: 5,
    estimatedTokens: estimateTokens(fallbackMarkdown)
  };
}

/**
 * 指定された縮退レベルで Markdown をビルドします。
 * 
 * レベル定義:
 * 0: フル出力 (各セクションを詳細に出力、制限なし)
 * 1: Technical Highlights (技術選定や決定事項) を最大5件に制限
 * 2: Main Features の説明文を省略し、機能名のみのリストに簡略化
 * 3: Overview および Background の詳細説明を最大200文字に制限
 * 4: Future Plans セクションを省略（または最大3件に制限）
 * 5: Architecture を最小限の構成表記のみにし、Benefits セクションを完全省略
 */
function buildMarkdownForLevel(data: ProjectAnalysisData, level: number): string {
  const sections: string[] = [];
  
  // 1. Title
  sections.push('# Project Documentation');

  // 2. Overview
  sections.push('## Overview');
  const overview = extractOverview(data, level);
  sections.push(overview);

  // 3. Purpose
  sections.push('## Purpose');
  const purpose = extractPurpose(data);
  sections.push(purpose);

  // 4. Background
  sections.push('## Background');
  const background = extractBackground(data, level);
  sections.push(background);

  // 5. Architecture
  sections.push('## Architecture');
  const architecture = inferArchitecture(data, level);
  sections.push(architecture);

  // 6. Main Features
  sections.push('## Main Features');
  const features = extractFeatures(data, level);
  sections.push(features.map(f => `- ${f}`).join('\n'));

  // 7. Technical Highlights
  sections.push('## Technical Highlights');
  const highlights = extractTechnicalHighlights(data);
  if (level >= 1 && highlights.length > 5) {
    const subset = highlights.slice(0, 5);
    sections.push(subset.map(h => `- ${h}`).join('\n') + `\n- (Additional technical highlights omitted)`);
  } else {
    sections.push(highlights.map(h => `- ${h}`).join('\n'));
  }

  // 8. Benefits
  if (level < 5) {
    sections.push('## Benefits');
    const benefits = extractBenefits(data);
    sections.push(benefits.map(b => `- ${b}`).join('\n'));
  }

  // 9. Future Plans
  if (level < 4) {
    sections.push('## Future Plans');
    const plans = extractFuturePlans(data);
    sections.push(plans.map(p => `- ${p}`).join('\n'));
  } else if (level === 4) {
    const plans = extractFuturePlans(data);
    if (plans.length > 3) {
      sections.push('## Future Plans');
      const subset = plans.slice(0, 3);
      sections.push(subset.map(p => `- ${p}`).join('\n') + `\n- ...and ${plans.length - 3} more planned action(s) omitted.`);
    } else {
      sections.push('## Future Plans');
      sections.push(plans.map(p => `- ${p}`).join('\n'));
    }
  }

  return sections.join('\n\n');
}

/**
 * プロジェクト概要の抽出
 */
function extractOverview(data: ProjectAnalysisData, level: number): string {
  const baseMeta = `Project Name: ${data.projectName}
Scale: ${data.files.length} files (${(data.totalBytes / 1024).toFixed(1)} KB)`;

  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  const readmeFile = data.files.find(f => f.name.toLowerCase() === 'readme.md');
  const sourceFile = planFile || readmeFile;
  
  if (sourceFile && sourceFile.content) {
    const lines = sourceFile.content.split('\n');
    let foundHeader = false;
    const descLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') && !trimmed.startsWith('##')) {
        foundHeader = true;
        continue;
      }
      if (foundHeader) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed !== '') {
          descLines.push(trimmed);
        }
      }
    }
    if (descLines.length > 0) {
      const desc = descLines.join(' ');
      if (level >= 3) {
        const truncatedDesc = desc.length > 200 ? desc.substring(0, 197) + '...' : desc;
        return `${baseMeta}\nSummary: ${truncatedDesc}`;
      } else {
        const truncatedDesc = desc.length > 500 ? desc.substring(0, 497) + '...' : desc;
        return `${baseMeta}\nSummary: ${truncatedDesc}`;
      }
    }
  }

  return `${baseMeta}\nSummary: A client-side static web utility for scanning directories and compiling LLM-friendly developer contexts without data leaks.`;
}

/**
 * 開発目的の抽出
 */
function extractPurpose(data: ProjectAnalysisData): string {
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    let inSection = false;
    const purposeLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('##') && (trimmed.includes('目的') || trimmed.includes('ゴール') || trimmed.includes('Purpose') || trimmed.includes('Goal'))) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed !== '') {
          purposeLines.push(trimmed);
        }
      }
    }
    if (purposeLines.length > 0) {
      return purposeLines.join('\n');
    }
  }

  return `The core purpose of this project is to optimize the AI development workflow by parsing raw workspace folder structures, analyzing module interfaces (classes, methods, dependencies), and composing highly structured, compressed context packages for LLMs to reduce token consumption and manual overhead.`;
}

/**
 * 開発背景の抽出
 */
function extractBackground(data: ProjectAnalysisData, level: number): string {
  const defaultBg = `As AI-driven development scales, modern source trees grow larger, causing "context bloat" and token overflow in LLMs. Developers face immense difficulty transferring complex project progress, architectural decisions, and current constraints across different chat sessions or distinct LLM models.`;
  
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    let inSection = false;
    const bgLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // 背景に関連するセクションを探索
      if (trimmed.startsWith('##') && (trimmed.includes('背景') || trimmed.includes('課題') || trimmed.includes('Background') || trimmed.includes('Overview'))) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed !== '' && !trimmed.startsWith('* **')) { // メタデータを除外
          bgLines.push(trimmed);
        }
      }
    }
    if (bgLines.length > 0) {
      const text = bgLines.join(' ');
      if (level >= 3) {
        return text.length > 200 ? text.substring(0, 197) + '...' : text;
      }
      return text.length > 500 ? text.substring(0, 497) + '...' : text;
    }
  }

  if (level >= 3) {
    return defaultBg.length > 200 ? defaultBg.substring(0, 197) + '...' : defaultBg;
  }
  return defaultBg;
}

/**
 * アーキテクチャ構成
 */
function inferArchitecture(data: ProjectAnalysisData, level: number): string {
  if (level >= 5) {
    return 'Client-side web application leveraging standard File System Access API for local, memory-only project static analysis.';
  }

  const paths = data.files.map(f => f.path);
  const notes: string[] = [];

  const hasComponents = paths.some(p => p.includes('src/components'));
  const hasApp = paths.some(p => p.includes('src/app'));
  const hasLib = paths.some(p => p.includes('src/lib'));
  const hasParser = paths.some(p => p.includes('src/lib/parser'));
  const hasFormatters = paths.some(p => p.includes('src/lib/formatters'));

  notes.push('- **Platform**: Client-side execution context built on Vite + React + TypeScript + TailwindCSS.');
  notes.push('- **Security**: Zero remote network APIs involved. Processing occurs entirely in browser memory.');
  
  if (hasApp) {
    notes.push('- **App Entry**: Main control flows and reactive state management (`src/app/`).');
  }
  if (hasComponents) {
    notes.push('- **UI Layer**: Reusable components representing directory pickers, file viewers, and status indicators (`src/components/`).');
  }
  if (hasLib) {
    notes.push('- **Core Library**: Reusable core utilities and formatters located under `src/lib/`.');
  }
  if (hasParser) {
    notes.push('- **Analysis Engines**: Module parsing, dependency path resolution, and token weight estimates (`src/lib/parser/`).');
  }
  if (hasFormatters) {
    notes.push('- **Formatters**: Layout configurations for specialized LLM context prompts (`src/lib/formatters/`).');
  }

  return 'The application features a modular static architecture designed for rapid client-side file reading:\n' + notes.join('\n');
}

/**
 * 主要機能の抽出
 */
function extractFeatures(data: ProjectAnalysisData, level: number): string[] {
  const features: string[] = [];
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');

  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      const tableMatch = line.match(/\|\s*\*\*(Phase\s*\d+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        const phaseName = tableMatch[1].trim();
        const statusText = tableMatch[2].trim();
        const taskContent = tableMatch[3].trim();
        
        if (level >= 2) {
          features.push(`${phaseName}: ${taskContent.split('（')[0].split('(')[0].trim()}`);
        } else {
          features.push(`${phaseName} [${statusText}]: ${taskContent}`);
        }
      }
    }
  }

  if (features.length > 0) {
    return features;
  }

  return [
    'Directory Tree Scanning: Generate interactive directory lists based on customizable exclusion configurations.',
    'Module Parsing: Static regex analysis for classes, methods, imports, and variables across JS/TS/Python source files.',
    'Dependency Mapping: Path resolution mapping to identify modular relationships and external requirements.',
    'Context Compression: Configurable token constraints using weight scaling to prevent model context limits.',
    'Multi-Pack Exporters: Custom prompt builders tailored for Chat Handover, Deep Audit, and Transfer Pack templates.'
  ];
}

/**
 * 技術ハイライトの抽出
 */
function extractTechnicalHighlights(data: ProjectAnalysisData): string[] {
  const highlights: string[] = [];
  const recordFile = data.files.find(f => f.name.toLowerCase() === 'record.md');
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  const targetFile = recordFile || planFile;
  
  if (targetFile && targetFile.content) {
    const lines = targetFile.content.split('\n');
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('##') && (
        trimmed.includes('技術決定') || 
        trimmed.includes('設計判断') || 
        trimmed.includes('意思決定') || 
        trimmed.includes('技術選定') || 
        trimmed.includes('Decision') || 
        trimmed.includes('成功条件') || 
        trimmed.includes('防衛方針')
      )) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const text = trimmed.replace(/^[-*]\s*(\[[ xX/]+\])?\s*/, '').trim();
          if (text) highlights.push(text);
        }
      }
    }
  }

  const uniqueHighlights = Array.from(new Set(highlights));
  if (uniqueHighlights.length > 0) {
    return uniqueHighlights;
  }

  return [
    'Secure offline client-side only processing (no network transmission).',
    'Vite + React + TypeScript + TailwindCSS codebase configuration.',
    'File System Access API (showDirectoryPicker) for loading outside directories in Chrome/Edge.',
    'Tokenizer estimation weighing English/Japanese ratios dynamically.',
    '6-stage progressive information shrinkage logic per pack type.'
  ];
}

/**
 * 導入メリット
 */
function extractBenefits(data: ProjectAnalysisData): string[] {
  return [
    `Zero Information Leakage: Full offline processing guarantees that "${data.projectName}" source files are never transmitted to external APIs.`,
    'Reduced Token Overhead: Smart context compression filters out comments, modules, and duplicate structures, saving up to 80% in token usage.',
    'Seamless LLM Continuity: Facilitates fast chat transition by consolidating tasks, decisions, and progress in unified copyable templates.',
    'High Portability: Lightweight, single-page bundle executes instantly on standard web browsers with a single shell launcher.'
  ];
}

/**
 * 将来の計画
 */
function extractFuturePlans(data: ProjectAnalysisData): string[] {
  const plans: string[] = [];
  const taskFile = data.files.find(f => f.name.toLowerCase() === 'task.md');
  
  if (taskFile && taskFile.content) {
    const lines = taskFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && trimmed.includes('[ ]')) {
        const text = trimmed.replace(/^-\s*\[\s*\]\s*/, '').trim();
        if (text) plans.push(text);
      }
    }
  }
  
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      const tableMatch = line.match(/\|\s*\*\*(Phase\s*\d+)\*\*\s*\|\s*`\[\s*\]`\s*未着手\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        plans.push(`Phase Pending: ${tableMatch[2].trim()}`);
      }
    }
  }
  
  const uniquePlans = Array.from(new Set(plans));
  return uniquePlans.length > 0 ? uniquePlans : ['Implementation of Phase Summary formatter.', 'Integrate regression test scenarios.', 'Final builds distribution.'];
}
