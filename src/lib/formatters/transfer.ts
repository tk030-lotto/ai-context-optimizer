import { ProjectAnalysisData } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface TransferPackOptions {
  maxTokens?: number; // 目標最大トークン数（デフォルト 4000）
}

/**
 * 異なるAIモデル間での移行を目的として、プロジェクト概要や機能一覧をまとめる
 * AI Transfer Pack (Markdown) を生成します。
 * 目標トークン数に収まるよう、必要に応じて自動的に縮退レベルを切り替えます。
 */
export function generateTransferPack(
  data: ProjectAnalysisData,
  options: TransferPackOptions = {}
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
 * 0: フル出力 (各セクション詳細に出力、Design Decisions や Feature List を制限なしで表示)
 * 1: Completed Features の項目数を直近の最大10件のみに制限 (残りは件数のみ)
 * 2: Completed Features を完全省略 (要約件数のみ) し、Design Decisions を直近の 5 件に制限
 * 3: Feature List の詳細説明を省略し項目名のみ。Recommended Next Actions を最大3件、Constraints を最大3件に制限。
 * 4: Design Decisions セクションを完全省略
 * 5: Project Overview の説明文を最小限（メタ情報のみ）にし、Architecture セクションも極めてシンプルにする。
 */
function buildMarkdownForLevel(data: ProjectAnalysisData, level: number): string {
  const sections: string[] = [];
  
  // 1. Title
  sections.push('# AI Transfer Package');

  // 2. Project Overview
  sections.push('## Project Overview');
  const projectOverview = extractProjectOverview(data, level);
  sections.push(projectOverview);

  // 3. Architecture
  sections.push('## Architecture');
  const architecture = inferArchitecture(data, level);
  sections.push(architecture);

  // 4. Feature List
  sections.push('## Feature List');
  const features = extractFeatureList(data, level);
  sections.push(features.map(f => `- ${f}`).join('\n'));

  // 5. Completed Features
  sections.push('## Completed Features');
  const completed = extractCompletedFeatures(data);
  if (level >= 2) {
    sections.push(`- ${completed.length} feature(s)/task(s) completed. (Details omitted due to optimization level)`);
  } else if (level === 1 && completed.length > 10) {
    const subset = completed.slice(0, 10);
    sections.push(subset.map(c => `- [x] ${c}`).join('\n') + `\n- ...and ${completed.length - 10} more completed feature(s) omitted.`);
  } else {
    sections.push(completed.map(c => `- [x] ${c}`).join('\n'));
  }

  // 6. Current Status
  sections.push('## Current Status');
  const currentStatus = extractCurrentStatus(data);
  sections.push(currentStatus);

  // 7. Constraints (レベル5では簡略表示、レベル3以上では件数制限)
  sections.push('## Constraints');
  const constraints = extractConstraints(data);
  if (level >= 3 && constraints.length > 3) {
    const subset = constraints.slice(0, 3);
    sections.push(subset.map(c => `- ${c}`).join('\n') + `\n- (Additional constraints omitted)`);
  } else {
    sections.push(constraints.map(c => `- ${c}`).join('\n'));
  }

  // 8. Design Decisions (レベル4以上は省略、レベル2では最大5件)
  if (level < 4) {
    sections.push('## Design Decisions');
    const decisions = extractDesignDecisions(data);
    if (level >= 2 && decisions.length > 5) {
      const subset = decisions.slice(0, 5);
      sections.push(subset.map(d => `- ${d}`).join('\n') + `\n- (Additional decisions omitted)`);
    } else {
      sections.push(decisions.map(d => `- ${d}`).join('\n'));
    }
  }

  // 9. Recommended Next Actions (レベル3以上では最大3件)
  sections.push('## Recommended Next Actions');
  const nextActions = extractRecommendedNextActions(data);
  if (level >= 3 && nextActions.length > 3) {
    const subset = nextActions.slice(0, 3);
    sections.push(subset.map(a => `- [ ] ${a}`).join('\n') + `\n- ...and ${nextActions.length - 3} more recommended action(s) planned.`);
  } else {
    sections.push(nextActions.map(a => `- [ ] ${a}`).join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * プロジェクト概要の抽出
 */
function extractProjectOverview(data: ProjectAnalysisData, level: number): string {
  const baseMeta = `- **Name**: ${data.projectName}
- **Scale**: ${data.files.length} files (${(data.totalBytes / 1024).toFixed(1)} KB)`;

  if (level >= 5) {
    return baseMeta;
  }

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
      const truncatedDesc = desc.length > 300 ? desc.substring(0, 297) + '...' : desc;
      return `${baseMeta}\n- **Summary**: ${truncatedDesc}`;
    }
  }

  return `${baseMeta}\n- **Summary**: Standard Vite/React/TypeScript or Python workspace.`;
}

/**
 * アーキテクチャ構成を推測
 */
function inferArchitecture(data: ProjectAnalysisData, level: number): string {
  if (level >= 5) {
    return 'Client-side local execution workspace (React/Vite/TypeScript architecture).';
  }

  const paths = data.files.map(f => f.path);
  const notes: string[] = [];

  const hasComponents = paths.some(p => p.includes('src/components'));
  const hasApp = paths.some(p => p.includes('src/app'));
  const hasLib = paths.some(p => p.includes('src/lib'));
  const hasParser = paths.some(p => p.includes('src/lib/parser'));
  const hasFormatters = paths.some(p => p.includes('src/lib/formatters'));

  if (hasApp) {
    notes.push('- **Application Entry**: UI components and entry routes are located under `src/app/`.');
  }
  if (hasComponents) {
    notes.push('- **UI Components**: UI presentation components are structured in `src/components/`.');
  }
  if (hasLib) {
    notes.push('- **Core Library**: Core logics and formatters are placed under `src/lib/`.');
  }
  if (hasParser) {
    notes.push('- **Analysis Engines**: Abstract AST/file tree parsers are encapsulated in `src/lib/parser/`.');
  }
  if (hasFormatters) {
    notes.push('- **Output Formatters**: Format-specific layout modules are located in `src/lib/formatters/`.');
  }

  if (notes.length === 0) {
    notes.push('- Standard codebase layout configuration.');
  }

  return 'Codebase layout configuration:\n' + notes.join('\n');
}

/**
 * 機能一覧の抽出
 */
function extractFeatureList(data: ProjectAnalysisData, level: number): string[] {
  const features: string[] = [];
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');

  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      // 工程管理表のテーブル行からフェーズ名とタスク内容を抽出
      const tableMatch = line.match(/\|\s*\*\*(Phase\s*\d+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        const phaseName = tableMatch[1].trim();
        const statusText = tableMatch[2].trim();
        const taskContent = tableMatch[3].trim();
        
        if (level >= 3) {
          // 詳細説明を省略、タイトルのみ
          features.push(`${phaseName}: ${taskContent.split('（')[0].split('(')[0].trim()}`);
        } else {
          features.push(`${phaseName} (${statusText}): ${taskContent}`);
        }
      }
    }
  }

  if (features.length > 0) {
    return features;
  }

  return [
    'Project Structure Scanning (File tree parsing)',
    'Module Definition Analysis (API, Classes, Functions extractor)',
    'Dependency Mapping (File imports parser)',
    'Token Estimation & Read Time calculator',
    'Audit Pack & Handover Pack Generation UI'
  ];
}

/**
 * 実装済み機能の抽出
 */
function extractCompletedFeatures(data: ProjectAnalysisData): string[] {
  const completed: string[] = [];
  const taskFile = data.files.find(f => f.name.toLowerCase() === 'task.md');
  
  if (taskFile && taskFile.content) {
    const lines = taskFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && (trimmed.includes('[x]') || trimmed.includes('[X]'))) {
        const text = trimmed.replace(/^-\s*\[[xX]\]\s*/, '').trim();
        if (text) completed.push(text);
      }
    }
  }

  // PROJECT_PLAN.md からも補完
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      const tableMatch = line.match(/\|\s*\*\*(Phase\s*\d+)\*\*\s*\|\s*`\[x\]`\s*完了\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        completed.push(`Phase Completed: ${tableMatch[2].trim()}`);
      }
    }
  }

  const uniqueCompleted = Array.from(new Set(completed));
  return uniqueCompleted.length > 0 ? uniqueCompleted : ['Repository initialization and foundation layout setup.'];
}

/**
 * 現在の進捗状況を抽出
 */
function extractCurrentStatus(data: ProjectAnalysisData): string {
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const progressMatch = planFile.content.match(/(?:全体進捗率|Progress)\s*[:：]\s*(.+)/);
    if (progressMatch) {
      return `Progress: ${progressMatch[1].trim()}`;
    }
    const currentLocMatch = planFile.content.match(/(?:現在地|【現在地】|Current Location)\s*[:：]\s*(.+)/);
    if (currentLocMatch) {
      return `Current Phase: ${currentLocMatch[1].trim()}`;
    }
  }
  return `Analyzing development state. Total files analyzed: ${data.files.length}.`;
}

/**
 * 制約条件の抽出
 */
function extractConstraints(data: ProjectAnalysisData): string[] {
  const constraints: string[] = [];
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('##') && (trimmed.includes('成功条件') || trimmed.includes('防衛方針') || trimmed.includes('Constraints') || trimmed.includes('DoD'))) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const text = trimmed.replace(/^[-*]\s*(\[[ xX/]+\])?\s*/, '').trim();
          if (text) constraints.push(text);
        }
      }
    }
  }
  
  const uniqueConstraints = Array.from(new Set(constraints));
  if (uniqueConstraints.length > 0) {
    return uniqueConstraints;
  }
  
  return [
    'Secure offline client-side only processing (no network transmission).',
    'Follow single responsibility principle (1 file 1 component/logic).',
    'Strictly avoid full-file rewrites during refactoring.'
  ];
}

/**
 * 技術選定・設計判断の抽出
 */
function extractDesignDecisions(data: ProjectAnalysisData): string[] {
  const decisions: string[] = [];
  const recordFile = data.files.find(f => f.name.toLowerCase() === 'record.md');
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  const targetFile = recordFile || planFile;
  
  if (targetFile && targetFile.content) {
    const lines = targetFile.content.split('\n');
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      // 設計判断に関連する見出しを探す
      if (trimmed.startsWith('##') && (
        trimmed.includes('技術決定') || 
        trimmed.includes('設計判断') || 
        trimmed.includes('意思決定') || 
        trimmed.includes('技術選定') || 
        trimmed.includes('Decision') || 
        trimmed.includes('設計上の決定')
      )) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const text = trimmed.replace(/^[-*]\s*/, '').trim();
          if (text) decisions.push(text);
        }
      }
    }
  }

  const uniqueDecisions = Array.from(new Set(decisions));
  if (uniqueDecisions.length > 0) {
    return uniqueDecisions;
  }

  return [
    'Strict offline-first architecture using showDirectoryPicker for safety.',
    'Separation of concerns: AST parsing (parser/) and Markdown presentation (formatters/).',
    'Token estimator with weight logic to simulate LLM contexts locally.',
    'Responsive dark-theme UI implemented with tailwindcss.'
  ];
}

/**
 * 推奨される次のアクション
 */
function extractRecommendedNextActions(data: ProjectAnalysisData): string[] {
  const actions: string[] = [];
  const taskFile = data.files.find(f => f.name.toLowerCase() === 'task.md');
  
  if (taskFile && taskFile.content) {
    const lines = taskFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && trimmed.includes('[ ]')) {
        const text = trimmed.replace(/^-\s*\[\s*\]\s*/, '').trim();
        if (text) actions.push(text);
      }
    }
  }
  
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      const tableMatch = line.match(/\|\s*\*\*(Phase\s*\d+)\*\*\s*\|\s*`\[\s*\]`\s*未着手\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        actions.push(`Phase Pending: ${tableMatch[2].trim()}`);
      }
    }
  }
  
  const uniqueActions = Array.from(new Set(actions));
  return uniqueActions.length > 0 ? uniqueActions : ['Further UI polish and performance verification.'];
}
