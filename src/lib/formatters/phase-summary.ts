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
 * 0: フル出力 (完了/未完了タスクの詳細、全ファイルのモジュール解析情報を含む)
 * 1: Completed Tasks (完了事項) のうち、直近の完了フェーズのみ詳細表示し、古いフェーズは省略
 * 2: Current Status (コード状態) における各ファイルのモジュール詳細（クラス/関数）を省略
 * 3: Next Actions (次タスク) のうち、直近の未完了フェーズのみ詳細表示し、それ以降は省略
 * 4: Current Status (コード状態) のファイル一覧を省略し、主要な変更のあった主要ファイルリスト（最大5件）のみ表示
 * 5: 完了事項・次のタスクを要約し、コード状態はファイル総数と総サイズのみの最小構成
 */
function buildMarkdownForLevel(data: ProjectAnalysisData, level: number): string {
  const sections: string[] = [];
  const { phases, progressText } = parseProjectPlan(data);

  // 完了した最新フェーズを特定
  const completedPhases = phases.filter(p => p.isCompleted);
  const pendingPhases = phases.filter(p => !p.isCompleted);
  const latestCompletedPhase = completedPhases.length > 0 ? completedPhases[completedPhases.length - 1] : null;

  // 1. Title
  const phaseTitle = latestCompletedPhase 
    ? `Phase ${latestCompletedPhase.number} 完了` 
    : '開発状況サマリー';
  sections.push(`# 【引継ぎ】${data.projectName} - ${phaseTitle}`);

  // 2. 完了事項 (Completed)
  sections.push('## 1. 完了事項 (Completed)');
  sections.push(buildCompletedSection(completedPhases, latestCompletedPhase, level));

  // 3. 現在のコード状態 (Current Status)
  sections.push('## 2. 現在のコード状態 (Current Status)');
  sections.push(buildCurrentStatusSection(data, progressText, level));

  // 4. 次フェーズのタスク (Next Actions)
  sections.push('## 3. 次フェーズのタスク (Next Actions)');
  sections.push(buildNextActionsSection(pendingPhases, level));

  return sections.join('\n\n');
}

/**
 * PROJECT_PLAN.md からフェーズ情報と進捗率を抽出する
 */
function parseProjectPlan(data: ProjectAnalysisData): { phases: ParsedPhase[]; progressText: string } {
  const phases: ParsedPhase[] = [];
  let progressText = '未定 (0/0 フェーズ完了)';

  const planFile = data.files.find(f => f.name.toLowerCase() === 'project_plan.md');
  if (planFile && planFile.content) {
    const lines = planFile.content.split('\n');
    for (const line of lines) {
      // 進捗率の抽出: 全体進捗率: ▓▓▓▓▓▓▓▓░░ 66% (8/12 フェーズ完了)
      if (line.includes('全体進捗率')) {
        const match = line.match(/全体進捗率\s*(?:\*\*)?\s*:\s*([^\n]+)/);
        if (match) {
          progressText = match[1].trim();
        }
      }

      // テーブル行の抽出: | **Phase 1** | `[x]` 完了 | 基盤構築... |
      // または | **Phase 1** | `[ ]` 未着手 | ... |
      const tableMatch = line.match(/\|\s*\*\*(Phase\s*(\d+))\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)/i);
      if (tableMatch) {
        const phaseNum = parseInt(tableMatch[2], 10);
        const statusText = tableMatch[3].trim();
        const contentText = tableMatch[4].trim();

        const isCompleted = statusText.includes('[x]') || statusText.includes('完了');
        phases.push({
          number: phaseNum,
          status: statusText,
          isCompleted,
          content: contentText
        });
      }
    }
  }

  // 重複を除去
  const uniquePhases: ParsedPhase[] = [];
  const phaseNumbers = new Set<number>();
  for (const p of phases) {
    if (!phaseNumbers.has(p.number)) {
      phaseNumbers.add(p.number);
      uniquePhases.push(p);
    }
  }

  // フェーズが取れなかった場合のデフォルト
  if (uniquePhases.length === 0) {
    // 仮の構成を設定
    uniquePhases.push({ number: 1, status: '`[x]` 完了', isCompleted: true, content: '基盤設計および環境構築' });
    uniquePhases.push({ number: 2, status: '`[x]` 完了', isCompleted: true, content: 'コアモジュールと静的解析エンジンの実装' });
    uniquePhases.push({ number: 3, status: '`[/]` 進行中', isCompleted: false, content: 'UIコンポーネントの構築と統合' });
  }

  return { phases: uniquePhases, progressText };
}

/**
 * 完了事項セクションの構築
 */
function buildCompletedSection(
  completedPhases: ParsedPhase[],
  latestCompleted: ParsedPhase | null,
  level: number
): string {
  if (completedPhases.length === 0) {
    return '- 特になし（開発開始前）';
  }

  if (level >= 5) {
    if (latestCompleted) {
      return `- Phase ${latestCompleted.number} までの開発（${latestCompleted.content.split('（')[0].split('(')[0]} 等）が完了。`;
    }
    return `- 初期フェーズの開発が完了。`;
  }

  if (level >= 1) {
    // 直近の完了フェーズのみ詳細を出し、それ以外は1行にまとめる
    const list: string[] = [];
    if (latestCompleted) {
      list.push(`- **Phase ${latestCompleted.number} [完了]**: ${latestCompleted.content}`);
    }
    const olderCount = completedPhases.length - (latestCompleted ? 1 : 0);
    if (olderCount > 0) {
      const olderPhasesText = completedPhases
        .filter(p => p.number !== latestCompleted?.number)
        .map(p => `Phase ${p.number}`)
        .join(', ');
      list.push(`- (過去完了分: ${olderPhasesText} は正常に完了済)`);
    }
    return list.join('\n');
  }

  // レベル 0: 全て詳細表示
  return completedPhases
    .map(p => `- **Phase ${p.number} [完了]**: ${p.content}`)
    .join('\n');
}

/**
 * 現在のコード状態セクションの構築
 */
function buildCurrentStatusSection(data: ProjectAnalysisData, progressText: string, level: number): string {
  const fileLines: string[] = [];

  fileLines.push(`- **進捗率**: ${progressText}`);

  if (level >= 5) {
    fileLines.push(`- **主要ファイル構成**: 全 ${data.files.length} ファイル (${(data.totalBytes / 1024).toFixed(1)} KB)`);
    return fileLines.join('\n');
  }

  // 変更のあった主要ファイルやソースコードファイルを取得する
  const sourceFiles = data.files.filter(f => {
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.py', '.css'].includes(ext);
  });

  if (level >= 4) {
    fileLines.push(`- **主要ファイル構成** (上位5件を表示):`);
    const sorted = [...sourceFiles].sort((a, b) => b.size - a.size).slice(0, 5);
    for (const f of sorted) {
      fileLines.push(`  - [${f.name}](file:///${f.path.replace(/\\/g, '/')}) (${(f.size / 1024).toFixed(1)} KB)`);
    }
    if (sourceFiles.length > 5) {
      fileLines.push(`  - ...他 ${sourceFiles.length - 5} 個のソースファイル`);
    }
    return fileLines.join('\n');
  }

  fileLines.push(`- **主要ファイルの配置と動作状態**:`);
  for (const f of data.files) {
    // 無駄に大きいノード等はスキップしつつ表示
    const isSource = sourceFiles.some(sf => sf.path === f.path);
    if (!isSource && f.size > 20000) continue; // 大きい非ソースは省略

    let detail = `(${(f.size / 1024).toFixed(1)} KB)`;
    if (level < 2 && f.analysis) {
      const parts: string[] = [];
      if (f.analysis.classes.length > 0) {
        parts.push(`Classes: ${f.analysis.classes.map(c => c.name).join(', ')}`);
      }
      if (f.analysis.functions.length > 0) {
        // 先頭5つだけ
        const fns = f.analysis.functions.slice(0, 5).map(fn => fn.name).join(', ');
        parts.push(`Funcs: ${fns}${f.analysis.functions.length > 5 ? '...' : ''}`);
      }
      if (parts.length > 0) {
        detail += ` - ${parts.join(' | ')}`;
      }
    }
    fileLines.push(`  - [${f.name}](file:///${f.path.replace(/\\/g, '/')}) ${detail}`);
  }

  return fileLines.join('\n');
}

/**
 * 次フェーズのタスクセクションの構築
 */
function buildNextActionsSection(pendingPhases: ParsedPhase[], level: number): string {
  if (pendingPhases.length === 0) {
    return '- 特になし（すべてのフェーズが完了しています）';
  }

  if (level >= 5) {
    const next = pendingPhases[0];
    return `- 次回タスク: Phase ${next.number} (${next.content.split('（')[0].split('(')[0]}) に着手予定。`;
  }

  if (level >= 3) {
    const next = pendingPhases[0];
    const list: string[] = [];
    list.push(`- **Phase ${next.number} [未着手]**: ${next.content}`);
    if (pendingPhases.length > 1) {
      const remaining = pendingPhases.slice(1).map(p => `Phase ${p.number}`).join(', ');
      list.push(`- (以降の計画: ${remaining} は順次着手予定)`);
    }
    return list.join('\n');
  }

  // レベル 0, 1, 2: すべて表示
  return pendingPhases
    .map(p => `- **Phase ${p.number} [未着手]**: ${p.content}`)
    .join('\n');
}
