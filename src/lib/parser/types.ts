import { ResolvedDependency } from './dependency';
import { ModuleAnalysisResult } from './module-analyzer';

export interface FileAnalysisInfo {
  path: string; // プロジェクトルートからの相対パス
  name: string;
  size: number;
  content?: string;
  tokens: number;
  dependencies: ResolvedDependency[];
  analysis?: ModuleAnalysisResult;
}

export interface ProjectAnalysisData {
  projectName: string;
  files: FileAnalysisInfo[];
  folderStructureText: string;
  totalBytes: number;
  totalTokens: number;
}
