export interface FunctionInfo {
  name: string;
  arguments: string[];
  returnType?: string;
  description?: string;
  isExported?: boolean;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  description?: string;
  methods: FunctionInfo[];
  isExported?: boolean;
}

export interface ModuleAnalysisResult {
  classes: ClassInfo[];
  functions: FunctionInfo[];
  exports: string[];
}

function getJsDocDescription(content: string, index: number): string | undefined {
  const beforeText = content.substring(0, index);
  const trimmed = beforeText.trimEnd();

  if (!trimmed.endsWith('*/')) {
    return undefined;
  }

  const lastDocStart = trimmed.lastIndexOf('/**');
  if (lastDocStart === -1) {
    return undefined;
  }

  const docComment = trimmed.substring(lastDocStart);
  if (docComment.includes('}') || docComment.includes(';')) {
    const lines = docComment.split('\n');
    const isClean = lines.every((line, idx) => {
      const l = line.trim();
      return idx === 0 ? l.startsWith('/**') : (l.startsWith('*') || l.startsWith('*/'));
    });
    if (!isClean) return undefined;
  }

  return docComment
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map(line => line.trim().replace(/^\*\s*/, ''))
    .filter(line => line.length > 0 && !line.startsWith('@'))
    .join('\n')
    .trim();
}

function getPythonDocstring(lines: string[], startLineIndex: number): string | undefined {
  let currentIdx = startLineIndex + 1;
  while (currentIdx < lines.length && lines[currentIdx].trim() === '') {
    currentIdx++;
  }

  if (currentIdx >= lines.length) return undefined;

  const line = lines[currentIdx].trim();
  let quoteChar = '';
  if (line.startsWith('"""')) quoteChar = '"""';
  else if (line.startsWith("'''")) quoteChar = "'''";

  if (!quoteChar) return undefined;

  if (line.endsWith(quoteChar) && line.length > quoteChar.length * 2) {
    return line.substring(quoteChar.length, line.length - quoteChar.length).trim();
  }

  const docLines: string[] = [];
  const firstLineContent = line.substring(quoteChar.length).trim();
  if (firstLineContent) docLines.push(firstLineContent);

  currentIdx++;
  while (currentIdx < lines.length) {
    const l = lines[currentIdx];
    if (l.trim().endsWith(quoteChar)) {
      const lastLineContent = l.trim().substring(0, l.trim().length - quoteChar.length).trim();
      if (lastLineContent) docLines.push(lastLineContent);
      break;
    }
    docLines.push(l.trim());
    currentIdx++;
  }

  return docLines.join('\n').trim();
}

function extractJsClassBody(content: string, classIndex: number): { body: string; endIndex: number } | null {
  const classStartIndex = content.indexOf('{', classIndex);
  if (classStartIndex === -1) return null;

  let braceCount = 1;
  let idx = classStartIndex + 1;

  while (idx < content.length && braceCount > 0) {
    const char = content[idx];
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
    }
    idx++;
  }

  if (braceCount === 0) {
    return {
      body: content.substring(classStartIndex + 1, idx - 1),
      endIndex: idx
    };
  }

  return null;
}

function splitParameters(paramText: string): string[] {
  if (!paramText.trim()) return [];
  return paramText
    .split(',')
    .map(a => a.trim().split(':')[0].trim())
    .filter(Boolean);
}

function analyzeJsTsModule(content: string): ModuleAnalysisResult {
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];
  const exports: string[] = [];

  const namedExportsRegex = /export\s+\{\s*([a-zA-Z0-9_,\s]+)\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = namedExportsRegex.exec(content)) !== null) {
    const symbols = match[1].split(',').map(s => s.trim());
    for (const sym of symbols) {
      if (sym) exports.push(sym);
    }
  }

  const classRegex = /(?:export\s+(?:default\s+)?)?class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_<>\.,\s]+))?/g;
  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const extendsClass = match[2]?.trim();
    const isExported = match[0].startsWith('export');
    const classIndex = match.index;

    if (isExported) {
      exports.push(className);
    }

    const jsdoc = getJsDocDescription(content, classIndex);
    const bodyInfo = extractJsClassBody(content, classIndex);

    const methods: FunctionInfo[] = [];
    const seenMethods = new Set<string>();

    if (bodyInfo) {
      const methodRegex = /(?:^|\n)\s*(?:(?:public|private|protected|static|readonly|abstract|override|async)\s+)*(?:(get|set)\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:\:\s*([^{=]+))?\s*\{/g;
      let methodMatch: RegExpExecArray | null;
      while ((methodMatch = methodRegex.exec(bodyInfo.body)) !== null) {
        const methodName = methodMatch[2];
        if (methodName === 'constructor' || seenMethods.has(methodName)) continue;
        seenMethods.add(methodName);

        methods.push({
          name: methodName,
          arguments: splitParameters(methodMatch[3]),
          returnType: methodMatch[4]?.trim(),
          description: getJsDocDescription(bodyInfo.body, methodMatch.index)
        });
      }

      const fieldArrowRegex = /(?:^|\n)\s*(?:(?:public|private|protected|static|readonly|override)\s+)*([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?:\:\s*([^=;{]+))?\s*=>/g;
      let fieldMatch: RegExpExecArray | null;
      while ((fieldMatch = fieldArrowRegex.exec(bodyInfo.body)) !== null) {
        const methodName = fieldMatch[1];
        if (seenMethods.has(methodName)) continue;
        seenMethods.add(methodName);

        methods.push({
          name: methodName,
          arguments: splitParameters(fieldMatch[2]),
          returnType: fieldMatch[3]?.trim(),
          description: getJsDocDescription(bodyInfo.body, fieldMatch.index)
        });
      }
    }

    classes.push({
      name: className,
      extends: extendsClass,
      description: jsdoc,
      methods,
      isExported
    });
  }

  const funcRegex = /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1];
    const isExported = match[0].startsWith('export');
    const args = splitParameters(match[2]);
    const retType = match[3]?.trim();
    const jsdoc = getJsDocDescription(content, match.index);

    if (isExported) {
      exports.push(funcName);
    }

    functions.push({
      name: funcName,
      arguments: args,
      returnType: retType,
      description: jsdoc,
      isExported
    });
  }

  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*(?::\s*[^=]+)?=\s*(?:async\s*)?\(([^)]*)\)\s*(?:\:\s*([^=]+))?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const funcName = match[1];
    const isExported = match[0].startsWith('export');
    const args = splitParameters(match[2]);
    const retType = match[3]?.trim();
    const jsdoc = getJsDocDescription(content, match.index);

    if (isExported) {
      exports.push(funcName);
    }

    functions.push({
      name: funcName,
      arguments: args,
      returnType: retType,
      description: jsdoc,
      isExported
    });
  }

  return {
    classes,
    functions,
    exports: Array.from(new Set(exports))
  };
}

function analyzePythonModule(content: string): ModuleAnalysisResult {
  const classes: ClassInfo[] = [];
  const functions: FunctionInfo[] = [];
  const exports: string[] = [];

  const lines = content.split('\n');

  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('class ')) {
      const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?:/);
      if (classMatch) {
        const className = classMatch[1];
        const baseClass = classMatch[2]?.trim();
        const docstring = getPythonDocstring(lines, i);
        const classIndent = getIndent(line);

        exports.push(className);

        const methods: FunctionInfo[] = [];
        let j = i + 1;

        while (j < lines.length) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed === '') {
            j++;
            continue;
          }

          if (getIndent(nextLine) <= classIndent) {
            break;
          }

          if (nextTrimmed.startsWith('def ')) {
            const methodMatch = nextTrimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
            if (methodMatch) {
              const methodName = methodMatch[1];
              const args = splitParameters(methodMatch[2]).filter(a => a !== 'self' && a !== 'cls');
              const retType = methodMatch[3]?.trim();
              const methodDoc = getPythonDocstring(lines, j);

              methods.push({
                name: methodName,
                arguments: args,
                returnType: retType,
                description: methodDoc
              });
            }
          }

          j++;
        }

        classes.push({
          name: className,
          extends: baseClass,
          description: docstring,
          methods,
          isExported: true
        });

        i = j - 1;
      }
    } else if (trimmed.startsWith('def ')) {
      const funcMatch = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const args = splitParameters(funcMatch[2]);
        const retType = funcMatch[3]?.trim();
        const docstring = getPythonDocstring(lines, i);

        exports.push(funcName);

        functions.push({
          name: funcName,
          arguments: args,
          returnType: retType,
          description: docstring,
          isExported: true
        });
      }
    }
  }

  return {
    classes,
    functions,
    exports
  };
}

export function analyzeModule(fileContent: string, fileExtension: string): ModuleAnalysisResult {
  const ext = fileExtension.toLowerCase();

  if (ext === '.py') {
    return analyzePythonModule(fileContent);
  }

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return analyzeJsTsModule(fileContent);
  }

  return {
    classes: [],
    functions: [],
    exports: []
  };
}
