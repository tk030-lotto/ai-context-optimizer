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
  
  let selectedMarkdown = '';
  let selectedLevel = 0;
  let selectedTokens = 0;

  // 縮退レベル 0 から 5 まで順にシミュレーション
  for (let level = 0; level <= 5; level++) {
    const markdown = buildMarkdownForLevel(data, level);
    const tokens = estimateTokens(markdown);
    
    selectedMarkdown = markdown;
    selectedLevel = level;
    selectedTokens = tokens;

    // 目標トークン数以下に収まった場合はそれを返す
    if (tokens <= maxTokens) {
      break;
    }
  }

  // トークン予算の妥当性検証・警告同梱
  if (selectedTokens > maxTokens || maxTokens < 2048) {
    const warningMessage = `> [!WARNING]\n> ⚠️ 指定されたトークン予算（${maxTokens}）が非常に小さいため、ファイル内容の大部分またはすべてがトリミングされました。本来の目的（十分なコード情報の提供）を果たせていない可能性があります。\n\n`;
    selectedMarkdown = warningMessage + selectedMarkdown;
    selectedTokens = estimateTokens(selectedMarkdown);
  }

  // ワンクリックコピー用ブロック包装
  const userInstructionHeader = `### 📋 引き継ぎプロンプト（以下のコードブロックをコピーして次のチャットに送信してください）\n\n`;
  const copyableMarkdown = `${userInstructionHeader}\`\`\`markdown\n${selectedMarkdown}\n\`\`\``;

  return {
    markdown: copyableMarkdown,
    fallbackLevel: selectedLevel,
    estimatedTokens: estimateTokens(copyableMarkdown)
  };
}

/**
 * 指定された縮退レベルで Markdown をビルドします。
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
    sections.push(completedTasks.length > 0 ? completedTasks.map(t => `- [x] ${t}`).join('\n') : '- No completed tasks found in task.md or project_plan.md.');
  }

  // 5. Current Task
  sections.push('## Current Task');
  const currentTasks = extractCurrentTasks(data);
  sections.push(currentTasks.map(t => `- [/] ${t}`).join('\n'));

  // 6. Next Task & Next Phase Implementation Plan Draft
  sections.push('## Next Task');
  const nextTasks = extractNextTasks(data);
  if (level >= 3 && nextTasks.length > 3) {
    const subset = nextTasks.slice(0, 3);
    sections.push(subset.map(t => `- [ ] ${t}`).join('\n') + `\n- ...and ${nextTasks.length - 3} more task(s) planned.`);
  } else {
    sections.push(nextTasks.length > 0 ? nextTasks.map(t => `- [ ] ${t}`).join('\n') : '- No planned next tasks found in task.md or project_plan.md.');
  }

  // 7. Constraints (レベル5では簡略化)
  if (level < 5) {
    sections.push('## Constraints');
    const constraints = extractConstraints(data);
    if (level >= 3 && constraints.length > 3) {
      const subset = constraints.slice(0, 3);
      sections.push(subset.map(c => `- ${c}`).join('\n') + `\n- (Additional rules/constraints omitted)`);
    } else {
      sections.push(constraints.length > 0 ? constraints.map(c => `- ${c}`).join('\n') : '- None specified');
    }
  }

  // 8. Known Issues (レベル4以上は省略)
  if (level < 4) {
    const issues = extractKnownIssues(data);
    if (issues.length > 0) {
      sections.push('## Known Issues');
      sections.push(issues.map(i => `- ${i}`).join('\n'));
    }
  }

  return sections.join('\n\n');
}

function extractProjectDescription(data: ProjectAnalysisData, level: number): string {
  const baseMeta = `- **Name**: ${data.projectName}
- **Scale**: ${data.files.length} files (${(data.totalBytes / 1024).toFixed(1)} KB)`;

  if (level >= 5) {
    return baseMeta;
  }

  const planFile = data.files.find(f => f.name.toLowerCase() === 'schedule.md' || f.name.toLowerCase() === 'project_plan.md');
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
      return `${baseMeta}\n- **Summary**: ${descLines.slice(0, 3).join(' ')}`;
    }
  }

  return baseMeta;
}

function extractCurrentStatus(data: ProjectAnalysisData): string {
  const scheduleFile = data.files.find(f => f.name.toLowerCase() === 'schedule.md' || f.name.toLowerCase() === 'record.md');
  if (scheduleFile && scheduleFile.content) {
    const lines = scheduleFile.content.split('\n');
    const statusLines = lines.filter(l => 
      l.includes('進捗率') || l.includes('ステータス') || l.includes('Phase') || l.includes('フェーズ')
    );
    if (statusLines.length > 0) {
      return statusLines.slice(0, 4).map(l => l.trim().replace(/^#+\s*/, '')).join('\n');
    }
  }

  return `- Total files: ${data.files.length}\n- Last updated: ${new Date().toISOString().split('T')[0]}`;
}

function extractCompletedTasks(data: ProjectAnalysisData): string[] {
  const completed: string[] = [];
  const targetFiles = data.files.filter(f => 
    f.name.toLowerCase() === 'schedule.md' || 
    f.name.toLowerCase() === 'record.md' || 
    f.name.toLowerCase() === 'tasks.md' ||
    f.name.toLowerCase() === 'task.md' ||
    f.name.toLowerCase() === 'project_plan.md'
  );

  for (const file of targetFiles) {
    if (!file.content) continue;
    const lines = file.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [x]') || trimmed.startsWith('* [x]') || trimmed.includes('[完了]')) {
        const clean = trimmed.replace(/^[-*]\s*\[x\]\s*/i, '').replace(/\|/g, ' ').trim();
        if (clean && !completed.includes(clean)) {
          completed.push(clean);
        }
      }
    }
  }

  return completed;
}

function extractCurrentTasks(data: ProjectAnalysisData): string[] {
  const current: string[] = [];
  const targetFiles = data.files.filter(f => 
    f.name.toLowerCase() === 'schedule.md' || 
    f.name.toLowerCase() === 'tasks.md' ||
    f.name.toLowerCase() === 'task.md'
  );

  for (const file of targetFiles) {
    if (!file.content) continue;
    const lines = file.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [/]') || trimmed.includes('[進行中]')) {
        const clean = trimmed.replace(/^[-*]\s*\[\/\]\s*/i, '').replace(/\|/g, ' ').trim();
        if (clean && !current.includes(clean)) {
          current.push(clean);
        }
      }
    }
  }

  return current.length > 0 ? current : ['No ongoing tasks found in progress in task.md.'];
}

function extractNextTasks(data: ProjectAnalysisData): string[] {
  const next: string[] = [];
  const targetFiles = data.files.filter(f => 
    f.name.toLowerCase() === 'schedule.md' || 
    f.name.toLowerCase() === 'tasks.md' ||
    f.name.toLowerCase() === 'task.md' ||
    f.name.toLowerCase() === 'record.md' ||
    f.name.toLowerCase() === 'project_plan.md'
  );

  for (const file of targetFiles) {
    if (!file.content) continue;
    const lines = file.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('* [ ]') || trimmed.includes('[未着手]')) {
        const clean = trimmed.replace(/^[-*]\s*\[\s*\]\s*/i, '').replace(/\|/g, ' ').trim();
        if (clean && !next.includes(clean)) {
          next.push(clean);
        }
      }
    }
  }

  return next;
}

function extractConstraints(data: ProjectAnalysisData): string[] {
  const constraints: string[] = [];
  const agentFile = data.files.find(f => f.name.toLowerCase() === 'agents.md' || f.name.toLowerCase() === '.cursorrules');
  if (agentFile && agentFile.content) {
    const lines = agentFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('### 第') || trimmed.startsWith('## 【最厳守】') || trimmed.startsWith('## 【最最厳守】')) {
        const ruleName = trimmed.replace(/^#+\s*/, '');
        if (!constraints.includes(ruleName)) {
          constraints.push(ruleName);
        }
      }
    }
  }

  return constraints;
}

function extractKnownIssues(data: ProjectAnalysisData): string[] {
  const issues: string[] = [];
  const recordFile = data.files.find(f => f.name.toLowerCase() === 'record.md' || f.name.toLowerCase() === 'evaluation_report.md');
  if (recordFile && recordFile.content) {
    const lines = recordFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('課題') || trimmed.includes('留意事項') || trimmed.includes('検出事項')) {
        const clean = trimmed.replace(/^[-*#]\s*/, '').trim();
        if (clean && clean.length > 5 && !issues.includes(clean)) {
          issues.push(clean);
        }
      }
    }
  }

  return issues;
}