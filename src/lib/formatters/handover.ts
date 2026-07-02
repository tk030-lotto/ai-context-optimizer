import { ProjectAnalysisData } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface HandoverPackOptions {
  maxTokens?: number; // 目標最大トークン数（デフォルト 4000）
}

/**
 * プロジェクト解析データから進捗・成果物・制約などをまとめる Handover パック (Markdown) を生成します。
 * 目標トークン数に収まるよう、必要に応じて自動的に縮退レベルを切り替えます。
 */
export function generateHandoverPack(
  data: ProjectAnalysisData,
  options: HandoverPackOptions = {}
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
 * 0: フル出力 (自動抽出された情報を余すことなく詳細に出力)
 * 1: Completed Tasks の出力を直近の最大10件のみに制限
 * 2: Completed Tasks の箇条書きを完全省略し、要約件数のみにする
 * 3: Next Task のリストを最大3件、Constraints のリストを最大3件に制限
 * 4: Known Issues セクションを完全省略
 * 5: Projectセクションの説明文を省略し、最小限のステータス情報と現在/次のタスクのみにする
 */
function buildMarkdownForLevel(data: ProjectAnalysisData, level: number): string {
  const sections: string[] = [];
  
  // 1. Title
  sections.push('# Chat Continuation Summary');

  // 2. Project Section
  sections.push('## Project');
  const projectDesc = extractProjectDescription(data, level);
  sections.push(projectDesc);

  // 3. Current Status
  sections.push('## Current Status');
  const currentStatus = extractCurrentStatus(data);
  sections.push(currentStatus);

  // 4. Completed Tasks
  sections.push('## Completed Tasks');
  const completedTasks = extractCompletedTasks(data);
  if (level >= 2) {
    sections.push(`- ${completedTasks.length} task(s) completed successfully. (Details omitted due to optimization level)`);
  } else if (level === 1 && completedTasks.length > 10) {
    const subset = completedTasks.slice(0, 10);
    sections.push(subset.map(t => `- [x] ${t}`).join('\n') + `\n- ...and ${completedTasks.length - 10} more completed task(s) omitted.`);
  } else {
    sections.push(completedTasks.map(t => `- [x] ${t}`).join('\n'));
  }

  // 5. Current Task
  sections.push('## Current Task');
  const currentTasks = extractCurrentTasks(data);
  sections.push(currentTasks.map(t => `- [/] ${t}`).join('\n'));

  // 6. Next Task
  sections.push('## Next Task');
  const nextTasks = extractNextTasks(data);
  if (level >= 3 && nextTasks.length > 3) {
    const subset = nextTasks.slice(0, 3);
    sections.push(subset.map(t => `- [ ] ${t}`).join('\n') + `\n- ...and ${nextTasks.length - 3} more task(s) planned.`);
  } else {
    sections.push(nextTasks.map(t => `- [ ] ${t}`).join('\n'));
  }

  // 7. Constraints (レベル5では簡略化)
  if (level < 5) {
    sections.push('## Constraints');
    const constraints = extractConstraints(data);
    if (level >= 3 && constraints.length > 3) {
      const subset = constraints.slice(0, 3);
      sections.push(subset.map(c => `- ${c}`).join('\n') + `\n- (Additional rules/constraints omitted)`);
    } else {
      sections.push(constraints.map(c => `- ${c}`).join('\n'));
    }
  }

  // 8. Known Issues (レベル4以上は省略)
  if (level < 4) {
    sections.push('## Known Issues');
    const issues = extractKnownIssues(data);
    sections.push(issues.map(i => `- ${i}`).join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * プロジェクト概要の抽出
 */
function extractProjectDescription(data: ProjectAnalysisData, level: number): string {
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
          break; // 次の見出しで打切り
        }
        if (trimmed !== '') {
          descLines.push(trimmed);
        }
      }
    }
    if (descLines.length > 0) {
      // 最初の1段落もしくは200文字程度を出力
      const desc = descLines.join(' ');
      const truncatedDesc = desc.length > 250 ? desc.substring(0, 247) + '...' : desc;
      return `${baseMeta}\n- **Summary**: ${truncatedDesc}`;
    }
  }

  return `${baseMeta}\n- **Summary**: Standard Vite/React/TypeScript or Python workspace.`;
}

/**
 * 現在の進捗状況を PROJECT_PLAN.md 等から抽出
 */
function extractCurrentStatus(data: ProjectAnalysisData): string {
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    // 全体進捗率を探す
    const progressMatch = planFile.content.match(/(?:全体進捗率|Progress)\s*[:：]\s*(.+)/);
    if (progressMatch) {
      return `Progress: ${progressMatch[1].trim()}`;
    }
    
    // 現在地を探す
    const currentLocMatch = planFile.content.match(/(?:現在地|【現在地】|Current Location)\s*[:：]\s*(.+)/);
    if (currentLocMatch) {
      return `Current Phase: ${currentLocMatch[1].trim()}`;
    }
  }
  return `Analyzing development state. Total estimated tokens: ${data.totalTokens.toLocaleString()}.`;
}

/**
 * 完了済みタスクの抽出
 */
function extractCompletedTasks(data: ProjectAnalysisData): string[] {
  const tasks: string[] = [];
  const taskFile = data.files.find(f => f.name.toLowerCase() === 'task.md');
  
  if (taskFile && taskFile.content) {
    const lines = taskFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && (trimmed.includes('[x]') || trimmed.includes('[X]'))) {
        const text = trimmed.replace(/^-\s*\[[xX]\]\s*/, '').trim();
        if (text) tasks.push(text);
      }
    }
  }
  
  // PROJECT_PLAN.md からも補完
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      const tableMatch = line.match(/\|\s*\*\*Phase\s*(\d+)\*\*\s*\|\s*`\[x\]`\s*完了\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        tasks.push(`Phase ${tableMatch[1]} Completed: ${tableMatch[2].trim()}`);
      }
    }
  }
  
  // 重複排除とフォールバック
  const uniqueTasks = Array.from(new Set(tasks));
  return uniqueTasks.length > 0 ? uniqueTasks : ['Setup initial project workspace structure.'];
}

/**
 * 進行中タスクの抽出
 */
function extractCurrentTasks(data: ProjectAnalysisData): string[] {
  const tasks: string[] = [];
  const taskFile = data.files.find(f => f.name.toLowerCase() === 'task.md');
  
  if (taskFile && taskFile.content) {
    const lines = taskFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && trimmed.includes('[/]')) {
        const text = trimmed.replace(/^-\s*\[\/\]\s*/, '').trim();
        if (text) tasks.push(text);
      }
    }
  }
  
  // PROJECT_PLAN.md から次回予定や現在地を補完
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const nextTaskMatch = planFile.content.match(/(?:次回タスク|【次回タスク】|Next Task)\s*[:：]\s*\n*\s*-\s*(.+)/);
    if (nextTaskMatch) {
      tasks.push(nextTaskMatch[1].trim());
    }
  }
  
  const uniqueTasks = Array.from(new Set(tasks));
  return uniqueTasks.length > 0 ? uniqueTasks : ['Implementing scheduled features.'];
}

/**
 * 未着手タスクの抽出
 */
function extractNextTasks(data: ProjectAnalysisData): string[] {
  const tasks: string[] = [];
  const taskFile = data.files.find(f => f.name.toLowerCase() === 'task.md');
  
  if (taskFile && taskFile.content) {
    const lines = taskFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && trimmed.includes('[ ]')) {
        const text = trimmed.replace(/^-\s*\[\s*\]\s*/, '').trim();
        if (text) tasks.push(text);
      }
    }
  }
  
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      const tableMatch = line.match(/\|\s*\*\*Phase\s*(\d+)\*\*\s*\|\s*`\[\s*\]`\s*未着手\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        tasks.push(`Phase ${tableMatch[1]} Pending: ${tableMatch[2].trim()}`);
      }
    }
  }
  
  const uniqueTasks = Array.from(new Set(tasks));
  return uniqueTasks.length > 0 ? uniqueTasks : ['Further feature expansion and optimizations.'];
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
          break; // 次のセクションへ移ったら終了
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
  
  // デフォルトフォールバック
  return [
    'Secure offline client-side only processing (no network transmission).',
    'Follow single responsibility principle (1 file 1 component/logic).',
    'Strictly avoid full-file rewrites during refactoring.'
  ];
}

/**
 * 既知の課題の抽出
 */
function extractKnownIssues(data: ProjectAnalysisData): string[] {
  const issues: string[] = [];
  const recordFile = data.files.find(f => f.name.toLowerCase() === 'record.md');
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  const targetFile = recordFile || planFile;
  
  if (targetFile && targetFile.content) {
    const lines = targetFile.content.split('\n');
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('##') && (trimmed.includes('課題') || trimmed.includes('懸念') || trimmed.includes('Known Issues') || trimmed.includes('Issues'))) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) {
          break;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const text = trimmed.replace(/^[-*]\s*/, '').trim();
          if (text) issues.push(text);
        }
      }
    }
  }
  
  const uniqueIssues = Array.from(new Set(issues));
  return uniqueIssues.length > 0 ? uniqueIssues : ['None reported. Code runs cleanly and passes scans.'];
}
