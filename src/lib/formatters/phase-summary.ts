import { ProjectAnalysisData } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface PhaseSummaryPackOptions {
  maxTokens?: number;
}

interface ParsedPhase {
  number: number;
  status: string;
  isCompleted: boolean;
  content: string;
  deliverables?: string[];
  issues?: string[];
  decisions?: string[];
  handoverNotes?: string[];
}

/**
 * プロジェクト解析データから、フェーズ完了時の引き継ぎ用まとめ（Phase Summary Pack）を自動生成します。
 * 目標トークン数に収まるよう、必要に応じて自動的に縮退レベルを切り替えます。
 *
 * 出力セクション（システム仕様書・AI開発運用仕様書に準拠）:
 * ## 1. 完了事項 (Completed)
 * ## 2. 現在のコード状態 (Current Status)
 * ## 3. 次フェーズのタスク (Next Actions)
 * ## 4. 成果物 (Deliverables)     — レベル1以上省略
 * ## 5. 課題 (Issues)              — レベル2以上省略
 * ## 6. 判断事項 (Decisions)       — レベル3以上省略
 * ## 7. 引継ぎ事項 (Handover Notes) — レベル4以上省略
 */
export function generatePhaseSummaryPack(
  data: ProjectAnalysisData,
  options: PhaseSummaryPackOptions = {}
): { markdown: string; fallbackLevel: number; estimatedTokens: number } {
  const maxTokens = options.maxTokens || 4000;

  let selectedMarkdown = '';
  let selectedLevel = 0;
  let selectedTokens = 0;

  for (let level = 0; level <= 5; level++) {
    const markdown = buildMarkdownForLevel(data, level);
    const tokens = estimateTokens(markdown);

    selectedMarkdown = markdown;
    selectedLevel = level;
    selectedTokens = tokens;

    if (tokens <= maxTokens) {
      break;
    }
  }

  if (selectedTokens > maxTokens || maxTokens < 2048) {
    const warningMessage = `> [!WARNING]\n> ⚠️ 指定されたトークン予算（${maxTokens}）が非常に小さいため、ファイル内容の大部分またはすべてがトリミングされました。本来の目的（十分なコード情報の提供）を果たせていない可能性があります。\n\n`;
    selectedMarkdown = warningMessage + selectedMarkdown;
    selectedTokens = estimateTokens(selectedMarkdown);
  }

  const userInstructionHeader = `### 📋 フェーズ完了引き継ぎサマリー（以下のコードブロックをコピーして次のチャットに送信してください）\n\n`;
  const copyableMarkdown = `${userInstructionHeader}\`\`\`markdown\n${selectedMarkdown}\n\`\`\``;

  return {
    markdown: copyableMarkdown,
    fallbackLevel: selectedLevel,
    estimatedTokens: estimateTokens(copyableMarkdown)
  };
}

function buildMarkdownForLevel(data: ProjectAnalysisData, level: number): string {
  const sections: string[] = [];
  const { phases, progressText } = parseProjectPlan(data);

  const completedPhases = phases.filter(p => p.isCompleted);
  const pendingPhases = phases.filter(p => !p.isCompleted);
  const latestCompleted = completedPhases.length > 0 ? completedPhases[completedPhases.length - 1] : null;

  const phaseTitle = latestCompleted ? `Phase ${latestCompleted.number} 完了` : 'フェーズ完了';
  sections.push(`# 【引継ぎ】${data.projectName} - ${phaseTitle}`);

  // 1. 完了事項
  sections.push('## 1. 完了事項 (Completed)');
  return sections.join('\n\n');
}

function buildCompletedSection(sections: string[], completedPhases: ParsedPhase[], level: number): void {
  if (completedPhases.length === 0) {
    sections.push('- 完了フェーズなし');
    return;
  }

  if (level === 0) {
    for (const p of completedPhases) {
      sections.push(`- **Phase ${p.number} [完了]**: ${p.content.split('\n')[0].trim() || p.status}`);
    }
  } else {
    const latest = completedPhases[completedPhases.length - 1];
    const older = completedPhases.slice(0, -1);
    sections.push(`- **Phase ${latest.number} [完了]**: ${latest.content.split('\n')[0].trim() || latest.status}`);
    if (older.length > 0) {
      sections.push(`  - *過去完了分: ${older.map(p => `Phase ${p.number}`).join(', ')}*`);
    }
  }
}

function buildCurrentStatusSection(sections: string[], data: ProjectAnalysisData, level: number): void {
  const codeFiles = data.files.filter(f => {
    if (level >= 4) {
      return !f.path.includes('node_modules') &&
             !f.path.includes('dist/') &&
             !f.name.toLowerCase().includes('project_plan') &&
             !f.name.toLowerCase().includes('record.md');
    }
    return !f.path.includes('node_modules') && !f.path.includes('dist/');
  });

  if (level >= 2) {
    sections.push(`- 対象ソースファイル: ${codeFiles.length} 件`);
    return;
  }

  if (level === 0) {
    const moduleLines: string[] = [];
    for (const file of codeFiles.slice(0, 15)) {
      if (file.analysis && (file.analysis.classes.length > 0 || file.analysis.functions.length > 0)) {
        const symbols = [
          ...file.analysis.classes.map(c => c.name),
          ...file.analysis.functions.map(f => f.name)
        ];
        moduleLines.push(`- \`${file.path}\` — ${symbols.join(', ')}`);
      }
    }
    if (moduleLines.length > 0) {
      sections.push(...moduleLines);
    } else {
      sections.push(`- 主要ファイル: ${codeFiles.slice(0, 15).map(f => `\`${f.path}\``).join(', ')}`);
    }
  } else {
    sections.push(codeFiles.slice(0, 15).map(f => `- \`${f.path}\``).join('\n'));
  }
}

function buildNextActionsSection(sections: string[], pendingPhases: ParsedPhase[], level: number): void {
  if (pendingPhases.length === 0) {
    sections.push('- 全フェーズ完了または要件確認中');
    return;
  }

  const [next, ...later] = pendingPhases;
  sections.push(`- **Phase ${next.number} [未着手]**: ${next.content.split('\n')[0].trim() || next.status}`);
  if (later.length > 0 && level < 3) {
    sections.push(`  - *以降の計画: ${later.map(p => `Phase ${p.number}`).join(', ')}*`);
  }
}

function buildDeliverablesSection(sections: string[], completedPhases: ParsedPhase[]): void {
  const deliverables = new Set<string>();
  for (const p of completedPhases) {
    if (p.deliverables && p.deliverables.length > 0) {
      p.deliverables.forEach(d => deliverables.add(d));
    } else {
function buildIssuesSection(sections: string[], data: ProjectAnalysisData): void {
  const issues: string[] = [];
  const recordFile = data.files.find(f =>
    f.name.toLowerCase() === 'record.md' ||
    f.name.toLowerCase() === 'evaluation_report.md'
  );
  if (recordFile && recordFile.content) {
    for (const line of recordFile.content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.includes('課題') || trimmed.includes('留意事項') || trimmed.includes('検出事項') || trimmed.includes('Known Issues')) {
        const clean = trimmed.replace(/^[-*#\s]+/, '').trim();
        if (clean && clean.length > 5 && !issues.includes(clean)) issues.push(clean);
      }
    }
  }
  if (issues.length > 0) {
    for (const issue of issues) sections.push(`- ${issue}`);
  } else {
    sections.push('- なし');
  }
}

function buildDecisionsSection(sections: string[], data: ProjectAnalysisData): void {
  const decisions: string[] = [];
  const recordFile = data.files.find(f => f.name.toLowerCase() === 'record.md');
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  const targetFile = recordFile || planFile;

  if (targetFile && targetFile.content) {
    const lines = targetFile.content.split('\n');
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('##') && (
        trimmed.includes('技術決定') || trimmed.includes('設計判断') ||
        trimmed.includes('意思決定') || trimmed.includes('技術選定') ||
        trimmed.includes('Decision') || trimmed.includes('設計上の決定')
      )) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (trimmed.startsWith('##')) break;
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const text = trimmed.replace(/^[-*]\s*/, '').trim();
          if (text) decisions.push(text);
        }
      }
    }
  }
  if (decisions.length > 0) {
function buildHandoverNotesSection(sections: string[], data: ProjectAnalysisData): void {
  const notes: string[] = [];
  const handoverFiles = data.files.filter(f => {
    const name = f.name.toLowerCase();
    return name.includes('handover') || name.includes('transfer') ||
           name.includes('readme') || name.includes('record');
  });
  if (handoverFiles.length > 0) {
    for (const file of handoverFiles.slice(0, 5)) {
      notes.push(`- \`${file.path}\` を参照`);
    }
  }
  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    for (const line of planFile.content.split('\n')) {
      if (line.includes('進捗率') || line.includes('全体進捗')) {
        notes.push(`- **進捗**: ${line.replace(/^#+\s*/, '').trim()}`);
        break;
      }
    }
  }
  if (notes.length > 0) {
    sections.push(...notes);
function parseProjectPlan(data: ProjectAnalysisData): { phases: ParsedPhase[]; progressText: string } {
  const planFile = data.files.find(f =>
    f.name.toLowerCase() === 'schedule.md' ||
    f.name.toLowerCase() === 'project_plan.md' ||
    f.name.toLowerCase() === 'record.md'
  );

  const phases: ParsedPhase[] = [];
  let progressText = '';

  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    let currentPhase: ParsedPhase | null = null;
    const contentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('進捗率') || trimmed.includes('全体進捗')) {
        progressText = trimmed.replace(/^#+\s*/, '').trim();
      }

      // Markdown テーブル行
      const tableMatch = trimmed.match(
        /^\|\s*\*\*Phase\s*(\d+)\*\*\s*\|[^|]*`?\[([ x])\]`?\s*(?:完了|進行中|未着手)?\s*\|([^|]*)/i
      );
      if (tableMatch) {
        if (currentPhase) {
          currentPhase.content = contentLines.join('\n').trim();
          phases.push(currentPhase);
          contentLines.length = 0;
        }
        const num = parseInt(tableMatch[1], 10);
        const isCompleted = tableMatch[2].toLowerCase() === 'x';
        currentPhase = { number: num, status: isCompleted ? '完了' : '未着手', isCompleted, content: tableMatch[3].trim() };
        continue;
      }

      // 見出し行
      const phaseMatch = trimmed.match(/^#{1,3}\s*Phase\s*(\d+)[:\s]*(.*)/i);
      if (phaseMatch) {
        if (currentPhase) {
          currentPhase.content = contentLines.join('\n').trim();
          phases.push(currentPhase);
          contentLines.length = 0;
        }
        const num = parseInt(phaseMatch[1], 10);
        const rest = phaseMatch[2].trim();
        const isCompleted = /\b(完了|done|finished|completed|\[x\])\b/i.test(rest);
        currentPhase = { number: num, status: rest || (isCompleted ? '完了' : '未着手'), isCompleted, content: rest };
        continue;
      }

      // インライン形式
      const inlineMatch = trimmed.match(
        /^Phase\s+(\d+)\s*\[(完了|done|未着手|in\s*progress|x)\]?\s*[:\-]?\s*(.*)/i
      );
      if (inlineMatch && !trimmed.startsWith('-') && !trimmed.startsWith('*') && trimmed.length < 200) {
        const num = parseInt(inlineMatch[1], 10);
        const statusStr = inlineMatch[2] || '';
        const isCompleted = /\b(完了|done|finished|completed|x)\b/i.test(statusStr);
        phases.push({ number: num, status: statusStr || (isCompleted ? '完了' : '未着手'), isCompleted, content: inlineMatch[3].trim() });
        continue;
      }

      if (currentPhase) {
        if (!trimmed.startsWith('|---') && trimmed !== '|') {
          contentLines.push(line);
        }
      }
    }

    if (currentPhase) {
      currentPhase.content = contentLines.join('\n').trim();
      phases.push(currentPhase);
    }
  }

  const seen = new Set<number>();
  const deduped = phases.reverse().filter(p => {
    if (seen.has(p.number)) return false;
    seen.add(p.number);
    return true;
  }).reverse();

  return { phases: deduped, progressText };
}
  } else {
    sections.push('- 引継ぎ事項なし');
  }
}

    for (const d of decisions) sections.push(`- ${d}`);
  } else {
    sections.push('- 判断事項なし');
  }
}

      const firstLine = p.content.split('\n')[0].trim();
      if (firstLine && firstLine.length > 5) deliverables.add(firstLine);
    }
  }
  if (deliverables.size > 0) {
    for (const d of deliverables) sections.push(`- ${d}`);
  } else {
    sections.push('- 成果物なし');
  }
}

  buildCompletedSection(sections, completedPhases, level);

  // 2. 現在のコード状態
  sections.push('## 2. 現在のコード状態 (Current Status)');
  buildCurrentStatusSection(sections, data, level);

  // 3. 次フェーズのタスク
  sections.push('## 3. 次フェーズのタスク (Next Actions)');
  buildNextActionsSection(sections, pendingPhases, level);

  // 4. 成果物 — レベル1以上省略
  if (level < 1) {
    sections.push('## 4. 成果物 (Deliverables)');
    buildDeliverablesSection(sections, completedPhases);
  }

  // 5. 課題 — レベル2以上省略
  if (level < 2) {
    sections.push('## 5. 課題 (Issues)');
    buildIssuesSection(sections, data);
  }

  // 6. 判断事項 — レベル3以上省略
  if (level < 3) {
    sections.push('## 6. 判断事項 (Decisions)');
    buildDecisionsSection(sections, data);
  }

  // 7. 引継ぎ事項 — レベル4以上省略
  if (level < 4) {
    sections.push('## 7. 引継ぎ事項 (Handover Notes)');
    buildHandoverNotesSection(sections, data);
  }

  return sections.join('\n\n');
}
