import { ProjectAnalysisData } from '../parser/types';
import { estimateTokens } from '../parser/token-estimator';

export interface PhaseSummaryPackOptions {
  maxTokens?: number; // 目標最大トークン数（デフォルト 4000）
}

interface ParsedPhase {
  number: number;
  status: string;
  isCompleted: boolean;
  content: string;
}

/**
 * プロジェクト解析データから、フェーズ完了時の引き継ぎ用まとめ（Phase Summary Pack）を自動生成します。
 * 目標トークン数に収まるよう、必要に応じて自動的に縮退レベルを切り替えます。
 */
export function generatePhaseSummaryPack(
  data: ProjectAnalysisData,
  options: PhaseSummaryPackOptions = {}
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

  // 1. タイトル
  const phaseTitle = latestCompleted ? `Phase ${latestCompleted.number} 完了サマリー` : 'フェーズ完了サマリー';
  sections.push(`# 引き継ぎサマリー: ${data.projectName} (${phaseTitle})`);

  // 2. プロジェクト基本情報
  sections.push('## 1. プロジェクト基本情報');
  sections.push(`- **プロジェクト名**: ${data.projectName}
- **総ファイル数**: ${data.files.length} 件 (${(data.totalBytes / 1024).toFixed(1)} KB)
- **進捗ステータス**: ${progressText || '順調'}
- **技術スタック**: TypeScript / Node.js`);

  // 3. これまでに完了したこと
  sections.push('## 2. これまでに完了したこと');
  if (completedPhases.length > 0) {
    completedPhases.forEach(p => {
      sections.push(`### Phase ${p.number} (${p.status})\n${p.content}`);
    });
  } else {
    sections.push('- 完了フェーズなし');
  }

  // 4. 次期フェーズの実装計画ドラフト
  sections.push('## 3. 次期フェーズの実装計画ドラフト');
  if (pendingPhases.length > 0) {
    const nextPhase = pendingPhases[0];
    sections.push(`### Phase ${nextPhase.number} (${nextPhase.status})\n${nextPhase.content}`);
  } else {
    sections.push('- 次期予定タスク: 全フェーズ完了または要件確認中');
  }

  // 5. ソースコード構成
  sections.push('## 4. 主要ソースコード構成');
  const sourceFiles = data.files.filter(f => !f.path.includes('node_modules') && !f.path.includes('dist/'));
  if (level >= 3) {
    sections.push(`- 対象ソースファイル: ${sourceFiles.length} 件`);
  } else {
    sections.push(sourceFiles.slice(0, 15).map(f => `- \`${f.path}\``).join('\n'));
  }

  return sections.join('\n\n');
}

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
      if (line.includes('進捗率') || line.includes('全体進捗')) {
        progressText = line.replace(/^#+\s*/, '').trim();
      }

      const phaseMatch = line.match(/###?\s*Phase\s*(\d+)[:\s]*(.*)/i);
      if (phaseMatch) {
        if (currentPhase) {
          currentPhase.content = contentLines.join('\n').trim();
          phases.push(currentPhase);
          contentLines.length = 0;
        }

        const num = parseInt(phaseMatch[1], 10);
        const title = phaseMatch[2].trim();
        const isCompleted = line.includes('完了') || line.includes('[x]') || line.includes('done');
        currentPhase = {
          number: num,
          status: title || (isCompleted ? '完了' : '未完了'),
          isCompleted,
          content: ''
        };
      } else if (currentPhase) {
        contentLines.push(line);
      }
    }

    if (currentPhase) {
      currentPhase.content = contentLines.join('\n').trim();
      phases.push(currentPhase);
    }
  }

  return { phases, progressText };
}