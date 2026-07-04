export interface ResolvedDependency {
  importPath: string;
  resolvedPath?: string;
  isExternal: boolean;
}

function removeComments(content: string, fileExtension: string): string {
  const ext = fileExtension.toLowerCase();

  if (ext === '.py') {
    let cleaned = content.replace(/#.*/g, '');
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');
    return cleaned;
  }

  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*/g, '');
  return cleaned;
}

export function extractDependencies(fileContent: string, fileExtension: string): string[] {
  const cleanedContent = removeComments(fileContent, fileExtension);
  const dependencies = new Set<string>();
  const ext = fileExtension.toLowerCase();

  if (ext === '.py') {
    const lines = cleanedContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('import ')) {
        const importContent = trimmed.substring(7).trim();
        const parts = importContent.split(',');
        for (const part of parts) {
          const name = part.trim().split(/\s+/)[0];
          if (name) dependencies.add(name);
        }
      }

      if (trimmed.startsWith('from ')) {
        const fromMatch = trimmed.match(/^from\s+([a-zA-Z0-9_\.]+)\s+import/);
        if (fromMatch) {
          dependencies.add(fromMatch[1].trim());
        }
      }
    }
  } else {
    const fromRegex = /(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = fromRegex.exec(cleanedContent)) !== null) {
      dependencies.add(match[1]);
    }

    const callRegex = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = callRegex.exec(cleanedContent)) !== null) {
      dependencies.add(match[1]);
    }

    const directImportRegex = /\bimport\s+['"]([^'"]+)['"]/g;
    while ((match = directImportRegex.exec(cleanedContent)) !== null) {
      dependencies.add(match[1]);
    }
  }

  return Array.from(dependencies);
}

function normalizeRelativePath(baseDir: string, relativePath: string): string {
  const baseParts = baseDir ? baseDir.split('/') : [];
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (baseParts.length > 0) baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }

  return baseParts.join('/');
}

function buildPathCandidates(importPath: string, sourceFilePath: string): string[] {
  const normalizedImport = importPath.replace(/\\/g, '/');
  const candidates = new Set<string>();
  candidates.add(normalizedImport);

  if (normalizedImport.startsWith('@/')) {
    candidates.add(`src/${normalizedImport.slice(2)}`);
  }

  if (normalizedImport.startsWith('~/')) {
    candidates.add(normalizedImport.slice(2));
  }

  // Python relative imports such as `.utils` or `..core.helpers`
  if (normalizedImport.startsWith('.') && !normalizedImport.startsWith('./') && !normalizedImport.startsWith('../')) {
    const leadingDots = normalizedImport.match(/^\.+/)?.[0].length || 0;
    const modulePath = normalizedImport.slice(leadingDots).replace(/^\//, '').replace(/\./g, '/');
    const lastSlashIndex = sourceFilePath.lastIndexOf('/');
    const baseDir = lastSlashIndex !== -1 ? sourceFilePath.substring(0, lastSlashIndex) : '';

    let relativeBase = baseDir;
    for (let i = 1; i < leadingDots; i++) {
      const slashIndex = relativeBase.lastIndexOf('/');
      relativeBase = slashIndex !== -1 ? relativeBase.substring(0, slashIndex) : '';
    }

    candidates.add(modulePath ? normalizeRelativePath(relativeBase, modulePath) : relativeBase);
    return Array.from(candidates).filter(Boolean);
  }

  // Python-style dotted imports such as `package.module`
  if (normalizedImport.includes('.') && !normalizedImport.startsWith('./') && !normalizedImport.startsWith('../')) {
    candidates.add(normalizedImport.replace(/\./g, '/'));
  }

  return Array.from(candidates).filter(Boolean);
}

function resolveAgainstProjectFiles(candidate: string, allProjectFiles: string[]): string | undefined {
  const trimmedCandidate = candidate.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmedCandidate) return undefined;

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.d.ts', '.py', '.css', '.json'];
  const roots = new Set([
    trimmedCandidate,
    trimmedCandidate.replace(/\./g, '/')
  ]);

  for (const root of roots) {
    const variants = [root, `${root}/index`, `${root}/__init__`];

    for (const variant of variants) {
      if (allProjectFiles.includes(variant)) {
        return variant;
      }

      for (const ext of extensions) {
        const withExt = `${variant}${ext}`;
        if (allProjectFiles.includes(withExt)) {
          return withExt;
        }
      }
    }

    for (const file of allProjectFiles) {
      if (file === root || file.endsWith(`/${root}`)) {
        return file;
      }

      for (const ext of extensions) {
        if (file === `${root}${ext}` || file.endsWith(`/${root}${ext}`)) {
          return file;
        }
        if (file === `${root}/index${ext}` || file.endsWith(`/${root}/index${ext}`)) {
          return file;
        }
        if (file === `${root}/__init__${ext}` || file.endsWith(`/${root}/__init__${ext}`)) {
          return file;
        }
      }
    }
  }

  return undefined;
}

export function resolveDependencyPath(
  sourceFilePath: string,
  importPath: string,
  allProjectFiles: string[]
): ResolvedDependency {
  const normalizedImport = importPath.replace(/\\/g, '/');
  const isJsRelative = normalizedImport.startsWith('./') || normalizedImport.startsWith('../') || normalizedImport.startsWith('/');
  const isPythonRelative = normalizedImport.startsWith('.') && !isJsRelative;
  const candidatePaths = new Set(buildPathCandidates(normalizedImport, sourceFilePath));

  if (isJsRelative) {
    const lastSlashIndex = sourceFilePath.lastIndexOf('/');
    const baseDir = lastSlashIndex !== -1 ? sourceFilePath.substring(0, lastSlashIndex) : '';
    candidatePaths.add(normalizeRelativePath(baseDir, normalizedImport));
  }

  if (!isJsRelative && !isPythonRelative) {
    for (const candidate of candidatePaths) {
      const resolved = resolveAgainstProjectFiles(candidate, allProjectFiles);
      if (resolved) {
        return {
          importPath,
          resolvedPath: resolved,
          isExternal: false
        };
      }
    }

    return {
      importPath,
      isExternal: true
    };
  }

  for (const candidate of candidatePaths) {
    const resolved = resolveAgainstProjectFiles(candidate, allProjectFiles);
    if (resolved) {
      return {
        importPath,
        resolvedPath: resolved,
        isExternal: false
      };
    }
  }

  return {
    importPath,
    resolvedPath: undefined,
    isExternal: false
  };
}
