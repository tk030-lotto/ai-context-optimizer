# AI Pipeline - Test Report

- **Scan Timestamp**: 2026-07-02T12:38:46.373Z
- **Total Tests Run**: 7
- **Status**: 🟢 ALL PASSED

## Test Execution Summary

| Test File | Status | Duration |
| :--- | :--- | :--- |
| `src/lib/parser/__tests__/verify-compression.ts` | 🟢 PASS | - |
| `src/lib/formatters/__tests__/verify-audit.ts` | 🟢 PASS | - |
| `src/lib/formatters/__tests__/verify-deep-audit.ts` | 🟢 PASS | - |
| `src/lib/formatters/__tests__/verify-doc.ts` | 🟢 PASS | - |
| `src/lib/formatters/__tests__/verify-handover.ts` | 🟢 PASS | - |
| `src/lib/formatters/__tests__/verify-phase-summary.ts` | 🟢 PASS | - |
| `src/lib/formatters/__tests__/verify-transfer.ts` | 🟢 PASS | - |

## Console Outputs / Logs

### verify-compression.ts

```plaintext
=== START KNOWLEDGE COMPRESSION ENGINE TESTING ===

[1/3] Testing dependency.ts...
TS dependencies extracted: [ '../config/constants', 'fs', './file-reader' ]
Python dependencies extracted: [ 'os', 'sys', 'math', 'datetime', '.utils' ]
Resolve ../config/constants: {
  importPath: '../config/constants',
  resolvedPath: 'src/lib/config/constants.ts',
  isExternal: false
}
Resolve ./file-reader: {
  importPath: './file-reader',
  resolvedPath: 'src/lib/parser/file-reader.ts',
  isExternal: false
}
Resolve fs: { importPath: 'fs', isExternal: true }
-> dependency.ts passed.

[2/3] Testing module-analyzer.ts...
TS Analysis result:
Classes: [
  {
    "name": "FileTreeParser",
    "extends": "BaseParser",
    "description": "プロジェクトツリーの生成とトラバースを管理するクラスです。\n複数行のJSDocコメントテスト。",
    "methods": [
      {
        "name": "scanDirectory",
        "arguments": [
          "handle"
        ],
        "returnType": "Promise<any[]>",
        "description": "ディレクトリをスキャンしてノードを返します。"
      },
      {
        "name": "formatNode",
        "arguments": [
          "node"
        ],
        "returnType": "string"
      }
    ],
    "isExported": true
  }
]
Functions: [
  {
    "name": "localHelper",
    "arguments": [
      "value"
    ],
    "returnType": "string",
    "description": "通常の関数定義のテスト",
    "isExported": false
  },
  {
    "name": "runParser",
    "arguments": [
      "config"
    ],
    "returnType": "Promise<boolean>",
    "description": "簡易的なアロー関数のエクスポートテスト",
    "isExported": true
  }
]
Exports: [ 'FileTreeParser', 'runParser' ]
Python Analysis result:
Classes: [
  {
    "name": "DocumentProcessor",
    "extends": "BaseProcessor",
    "description": "ドキュメントの解析とテキスト抽出を行うクラス。\nPythonのトリプルクォートDocstringテスト。",
    "methods": [
      {
        "name": "__init__",
        "arguments": [
          "doc_path"
        ]
      },
      {
        "name": "process",
        "arguments": [
          "mode"
        ],
        "returnType": "bool",
        "description": "ファイルを処理します。"
      }
    ],
    "isExported": true
  }
]
Functions: [
  {
    "name": "global_run",
    "arguments": [],
    "description": "グローバル関数のテスト",
    "isExported": true
  }
]
-> module-analyzer.ts passed.

[3/3] Testing token-estimator.ts...
English text tokens: 16 (Chars: 59)
Japanese text tokens: 26 (Chars: 20)
Mixed text tokens: 42 (Chars: 80)
Read time result: {
  aiTimeSeconds: 0.01,
  humanTimeMinutes: 0.1,
  aiTimeFormatted: '0.1秒未満',
  humanTimeFormatted: '6秒'
}
-> token-estimator.ts passed.

================================================
🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

### verify-audit.ts

```plaintext
=== START AUDIT PACK GENERATION TESTING ===

Mock Project Stats: Files=15, Bytes=75000
Test 1: Generates full pack (Level 0)
Estimated Tokens: 2779, Fallback Level: 0
Test 2: Generates optimized pack (JSDoc omitted - Level 1/2)
Estimated Tokens: 1755, Fallback Level: 2
Test 3: Generates compact pack (Tests/configs omitted - Level 3)
Estimated Tokens: 1237, Fallback Level: 3
Test 4: Generates minimal pack (Module map completely omitted - Level 4)
Estimated Tokens: 316, Fallback Level: 4
Test 5: Check boundary handling (Level 5)
Estimated Tokens: 243, Fallback Level: 5

================================================
🎉 AUDIT PACK TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

### verify-deep-audit.ts

```plaintext
=== START DEEP AUDIT PACK GENERATION TESTING ===

Token sizes at each fallback level:
- Level 0: 538
- Level 1: 426
- Level 2: 360
- Level 3: 288
- Level 4: 272
- Level 5: 234
Test 1: Generates full deep pack (Level 0)
Estimated Tokens: 538, Fallback Level: 0
Test 2: Generates clean code pack (Level 1)
Estimated Tokens: 426, Fallback Level: 1
Test 3: Generates skeleton code pack (Level 2)
Estimated Tokens: 360, Fallback Level: 2
Test 4: Generates minimized pack (Level 3)
Estimated Tokens: 288, Fallback Level: 3
Test 5: Generates signature-only pack (Level 4)
Estimated Tokens: 272, Fallback Level: 4
Test 6: Check boundary handling (Level 5)
Estimated Tokens: 234, Fallback Level: 5

================================================
🎉 DEEP AUDIT PACK TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

### verify-doc.ts

```plaintext
=== START DOCUMENTATION PACK GENERATION TESTING ===

Token sizes at each fallback level:
- Level 0: 993
- Level 1: 961
- Level 2: 945
- Level 3: 890
- Level 4: 886
- Level 5: 647
Test 1: Generates full documentation (Level 0)
Test 2: Technical highlights limited (Level 1)
Test 3: Main Features simplified (Level 2)
Test 4: Overview & Background truncated to 200 chars (Level 3)
Test 5: Future Plans section limited or omitted (Level 4)
Test 6: Minimum fallback documentation (Level 5)

================================================
🎉 DOCUMENTATION PACK TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

### verify-handover.ts

```plaintext
=== START HANDOVER PACK GENERATION TESTING ===

Token sizes at each fallback level:
- Level 0: 407
- Level 1: 363
- Level 2: 279
- Level 3: 267
- Level 4: 220
- Level 5: 134
Test 1: Generates full handover summary (Level 0)
Test 2: Completed tasks limited to 10 items (Level 1)
Test 3: Completed tasks omitted with summary count (Level 2)
Test 4: Next tasks and constraints limited (Level 3)
Test 5: Known issues section omitted (Level 4)
Test 6: Minimum fallback summary (Level 5)

================================================
🎉 HANDOVER PACK TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

### verify-phase-summary.ts

```plaintext
=== START PHASE SUMMARY PACK GENERATION TESTING ===

Token sizes at each fallback level:
- Level 0: 356
- Level 1: 339
- Level 2: 259
- Level 3: 257
- Level 4: 243
- Level 5: 191
Test 1: Generates full summary (Level 0)
Test 2: Completed tasks limited (Level 1)
Test 3: Module analysis detail omitted in current status (Level 2)
Test 4: Pending tasks limited (Level 3)
Test 5: File list simplified to major only (Level 4)
Test 6: Minimum fallback summary (Level 5)

================================================
🎉 PHASE SUMMARY PACK TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

### verify-transfer.ts

```plaintext
=== START TRANSFER PACK GENERATION TESTING ===

Token sizes at each fallback level:
- Level 0: 534
- Level 1: 501
- Level 2: 416
- Level 3: 390
- Level 4: 287
- Level 5: 257
Test 1: Generates full transfer summary (Level 0)
Test 2: Completed features limited to 10 items (Level 1)
Test 3: Completed features omitted & Decisions limited (Level 2)
Test 4: Feature List simplified & Next actions/constraints limited (Level 3)
Test 5: Design Decisions section omitted (Level 4)
Test 6: Minimum fallback summary (Level 5)

================================================
🎉 TRANSFER PACK TESTS PASSED SUCCESSFULLY! 🎉
================================================
```

