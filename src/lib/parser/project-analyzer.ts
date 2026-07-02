import { FileNode } from './file-tree';
import { isReadableFile, readFileContent } from './file-reader';
import { extractDependencies, resolveDependencyPath } from './dependency';
import { analyzeModule } from './module-analyzer';
import { estimateTokens } from './token-estimator';
import { ProjectAnalysisData, FileAnalysisInfo } from './types';

/**
 * プロジェクトノードツリー全体を解析し、依存関係やモジュール構造を統合した解析データを構築します。
 */
export async function analyzeProject(
  projectName: string,
  rootNodes: FileNode[],
  folderStructureText: string
): Promise<ProjectAnalysisData> {
  // 1. すべてのファイルを平滑化（flatten）
  const allFileNodes: FileNode[] = [];
  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'file') {
        allFileNodes.push(node);
      } else if (node.children) {
        traverse(node.children);
      }
    }
  };
  traverse(rootNodes);

  // 2. 読み込み可能なテキストファイルを抽出
  const readableNodes = allFileNodes.filter(node => 
    isReadableFile(node.name, node.size || 0)
  );

  // プロジェクト内の全ファイルの相対パス一覧 (依存関係解決に利用)
  const allProjectPaths = readableNodes.map(node => node.path);

  // 3. 各ファイルの解析を非同期で実行
  const fileAnalyses: FileAnalysisInfo[] = [];
  let totalBytes = 0;
  let totalTokens = 0;

  for (const node of readableNodes) {
    try {
      const fileHandle = node.handle as FileSystemFileHandle;
      const content = await readFileContent(fileHandle);
      const dotIndex = node.name.lastIndexOf('.');
      const ext = dotIndex !== -1 ? node.name.substring(dotIndex).toLowerCase() : '';

      // 依存関係抽出
      const rawDeps = extractDependencies(content, ext);
      const resolvedDeps = rawDeps.map(depPath => 
        resolveDependencyPath(node.path, depPath, allProjectPaths)
      );

      // クラス・関数の解析
      const moduleAnalysis = analyzeModule(content, ext);

      // トークン推定
      const tokens = estimateTokens(content);

      fileAnalyses.push({
        path: node.path,
        name: node.name,
        size: node.size || 0,
        content,
        tokens,
        dependencies: resolvedDeps,
        analysis: moduleAnalysis
      });

      totalBytes += node.size || 0;
      totalTokens += tokens;
    } catch (e) {
      console.warn(`Failed to analyze file: ${node.path}`, e);
      // 読み込めなかったファイルは依存関係等なしで基本情報のみ登録
      fileAnalyses.push({
        path: node.path,
        name: node.name,
        size: node.size || 0,
        tokens: 0,
        dependencies: []
      });
    }
  }

  return {
    projectName,
    files: fileAnalyses,
    folderStructureText,
    totalBytes,
    totalTokens
  };
}
