let vscode = null;
try {
  vscode = require("vscode");
} catch {
  vscode = null;
}

const tokenTypes = [
  "class",
  "property",
  "keyword",
  "string",
  "number",
  "operator",
  "comment",
];

const tokenModifiers = [];
const legend = vscode ? new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers) : null;

const typeIndex = Object.fromEntries(tokenTypes.map((name, index) => [name, index]));
const modifierIndex = Object.fromEntries(tokenModifiers.map((name, index) => [name, index]));

const KEYWORDS = new Set([
  "abstract",
  "begin",
  "block",
  "concrete",
  "end",
  "include",
  "namespace",
  "type",
  "with",
]);

function activate(context) {
  if (!vscode) {
    return;
  }

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "heta" },
      new HetaSemanticTokensProvider(),
      legend,
    ),
    new HetaTokenColorHighlighter(),
    new HetaSyntaxErrorHighlighter(),
  );
}

function deactivate() {}

class HetaSemanticTokensProvider {
  provideDocumentSemanticTokens(document) {
    const builder = new vscode.SemanticTokensBuilder(legend);
    const tokens = collectSemanticTokens(document.getText());

    for (const token of tokens) {
      builder.push(
        token.line,
        token.start,
        token.length,
        typeIndex[token.type],
        token.modifiers.reduce((bits, name) => bits | (1 << modifierIndex[name]), 0),
      );
    }

    return builder.build();
  }
}

class HetaTokenColorHighlighter {
  constructor() {
    this.decorationTypes = new Map(
      Object.entries({
        class: vscode.window.createTextEditorDecorationType({
          color: "#7c3aed",
          fontWeight: "700",
        }),
        property: vscode.window.createTextEditorDecorationType({
          color: "#005fcc",
          fontWeight: "700",
        }),
        keyword: vscode.window.createTextEditorDecorationType({
          color: "#b000b5",
          fontWeight: "700",
        }),
        string: vscode.window.createTextEditorDecorationType({
          color: "#c2185b",
        }),
        number: vscode.window.createTextEditorDecorationType({
          color: "#d35400",
          fontWeight: "700",
        }),
        operator: vscode.window.createTextEditorDecorationType({
          color: "#006dcb",
          fontWeight: "700",
        }),
        comment: vscode.window.createTextEditorDecorationType({
          color: "#697386",
          fontStyle: "italic",
        }),
      }),
    );
    this.disposables = [
      ...this.decorationTypes.values(),
      vscode.window.onDidChangeVisibleTextEditors(() => this.updateVisibleEditors()),
      vscode.workspace.onDidChangeTextDocument((event) => this.updateDocument(event.document)),
    ];

    this.updateVisibleEditors();
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  updateVisibleEditors() {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateEditor(editor);
    }
  }

  updateDocument(document) {
    if (document.languageId !== "heta") {
      return;
    }

    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === document.uri.toString()) {
        this.updateEditor(editor);
      }
    }
  }

  updateEditor(editor) {
    if (editor.document.languageId !== "heta") {
      for (const decorationType of this.decorationTypes.values()) {
        editor.setDecorations(decorationType, []);
      }
      return;
    }

    const rangesByType = Object.fromEntries(tokenTypes.map((type) => [type, []]));
    for (const token of collectSemanticTokens(editor.document.getText())) {
      rangesByType[token.type]?.push(tokenToVsCodeRange(token));
    }

    for (const [type, decorationType] of this.decorationTypes) {
      editor.setDecorations(decorationType, rangesByType[type] ?? []);
    }
  }
}

class HetaSyntaxErrorHighlighter {
  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      color: "#ff0000",
      fontWeight: "bold",
      textDecoration: "underline wavy #ff0000",
      overviewRulerColor: "#ff0000",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
    this.diagnostics = vscode.languages.createDiagnosticCollection("heta");
    this.disposables = [
      this.decorationType,
      this.diagnostics,
      vscode.window.onDidChangeVisibleTextEditors(() => this.updateVisibleEditors()),
      vscode.workspace.onDidChangeTextDocument((event) => this.updateDocument(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.diagnostics.delete(document.uri)),
    ];

    this.updateVisibleEditors();
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  updateVisibleEditors() {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateEditor(editor);
    }
  }

  updateDocument(document) {
    if (document.languageId !== "heta") {
      return;
    }

    const errors = collectSyntaxErrors(document.getText());
    this.setDiagnostics(document, errors);

    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === document.uri.toString()) {
        this.setDecorations(editor, errors);
      }
    }
  }

  updateEditor(editor) {
    if (editor.document.languageId !== "heta") {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const errors = collectSyntaxErrors(editor.document.getText());
    this.setDiagnostics(editor.document, errors);
    this.setDecorations(editor, errors);
  }

  setDiagnostics(document, errors) {
    const diagnostics = errors.map((error) => {
      const diagnostic = new vscode.Diagnostic(
        toVsCodeRange(error),
        error.message,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = "Heta";
      return diagnostic;
    });
    this.diagnostics.set(document.uri, diagnostics);
  }

  setDecorations(editor, errors) {
    editor.setDecorations(
      this.decorationType,
      errors.map((error) => ({
        range: toVsCodeRange(error),
        hoverMessage: error.message,
      })),
    );
  }
}

function toVsCodeRange(error) {
  return new vscode.Range(
    new vscode.Position(error.line, error.start),
    new vscode.Position(error.endLine ?? error.line, error.end),
  );
}

function tokenToVsCodeRange(token) {
  return new vscode.Range(
    new vscode.Position(token.line, token.start),
    new vscode.Position(token.line, token.start + token.length),
  );
}

function collectSyntaxErrors(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const errors = [];
  const stack = [];
  let blockCommentStart = null;
  let noteStart = null;

  lines.forEach((lineText, line) => {
    let index = 0;

    while (index < lineText.length) {
      if (blockCommentStart) {
        const end = lineText.indexOf("*/", index);
        if (end === -1) {
          break;
        }
        blockCommentStart = null;
        index = end + 2;
        continue;
      }

      if (noteStart) {
        const end = lineText.indexOf("'''", index);
        if (end === -1) {
          break;
        }
        noteStart = null;
        index = end + 3;
        continue;
      }

      if (lineText.startsWith("//", index)) {
        break;
      }

      if (lineText.startsWith("/*", index)) {
        blockCommentStart = { line, start: index };
        index += 2;
        continue;
      }

      if (lineText.startsWith("'''", index)) {
        noteStart = { line, start: index };
        index += 3;
        continue;
      }

      const char = lineText[index];

      if (char === "\"" || char === "'") {
        const quoted = scanQuotedWithStatus(lineText, index, char);
        if (!quoted.closed) {
          addSyntaxError(
            errors,
            line,
            index,
            Math.max(index + 1, lineText.length),
            `Unterminated ${char === "\"" ? "double" : "single"} quoted string`,
          );
          break;
        }
        index = quoted.stop;
        continue;
      }

      if (char === "@" && !isIdentifierStart(lineText[index + 1])) {
        addSyntaxError(errors, line, index, index + 1, "Expected Heta class name after @");
        index += 1;
        continue;
      }

      if (char === "#" && !isIdentifierStart(lineText[index + 1])) {
        addSyntaxError(errors, line, index, index + 1, "Expected Heta action name after #");
        index += 1;
        continue;
      }

      if (OPEN_TO_CLOSE[char]) {
        stack.push({ char, line, start: index });
        index += 1;
        continue;
      }

      if (CLOSE_TO_OPEN[char]) {
        if (stack.length === 0) {
          addSyntaxError(errors, line, index, index + 1, `Unexpected closing ${char}`);
          index += 1;
          continue;
        }

        const top = stack[stack.length - 1];
        const expected = OPEN_TO_CLOSE[top.char];
        if (expected === char) {
          stack.pop();
        } else {
          addSyntaxError(errors, line, index, index + 1, `Expected ${expected}, got ${char}`);
          recoverDelimiterStack(stack, char);
        }
        index += 1;
        continue;
      }

      index += 1;
    }
  });

  if (blockCommentStart) {
    addSyntaxError(
      errors,
      blockCommentStart.line,
      blockCommentStart.start,
      blockCommentStart.start + 2,
      "Unterminated block comment",
    );
  }

  if (noteStart) {
    addSyntaxError(errors, noteStart.line, noteStart.start, noteStart.start + 3, "Unterminated note block");
  }

  for (const opener of stack) {
    addSyntaxError(
      errors,
      opener.line,
      opener.start,
      opener.start + 1,
      `Unclosed ${opener.char}; expected ${OPEN_TO_CLOSE[opener.char]}`,
    );
  }

  return errors.sort((a, b) => a.line - b.line || a.start - b.start);
}

const OPEN_TO_CLOSE = {
  "(": ")",
  "[": "]",
  "{": "}",
};

const CLOSE_TO_OPEN = {
  ")": "(",
  "]": "[",
  "}": "{",
};

function recoverDelimiterStack(stack, closingChar) {
  const matchingIndex = stack.findLastIndex((item) => OPEN_TO_CLOSE[item.char] === closingChar);
  if (matchingIndex === -1) {
    return;
  }
  stack.splice(matchingIndex);
}

function collectSemanticTokens(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const tokens = [];
  let inBlockComment = false;
  let inNote = false;

  lines.forEach((lineText, line) => {
    const protectedRanges = [];
    let index = 0;

    while (index < lineText.length) {
      if (inBlockComment) {
        const end = lineText.indexOf("*/", index);
        const stop = end === -1 ? lineText.length : end + 2;
        addToken(tokens, line, index, stop - index, "comment");
        protectedRanges.push([index, stop]);
        inBlockComment = end === -1;
        index = stop;
        continue;
      }

      if (inNote) {
        const end = lineText.indexOf("'''", index);
        const stop = end === -1 ? lineText.length : end + 3;
        addToken(tokens, line, index, stop - index, "string");
        protectedRanges.push([index, stop]);
        inNote = end === -1;
        index = stop;
        continue;
      }

      if (lineText.startsWith("/*", index)) {
        const end = lineText.indexOf("*/", index + 2);
        const stop = end === -1 ? lineText.length : end + 2;
        addToken(tokens, line, index, stop - index, "comment");
        protectedRanges.push([index, stop]);
        inBlockComment = end === -1;
        index = stop;
        continue;
      }

      if (lineText.startsWith("'''", index)) {
        const end = lineText.indexOf("'''", index + 3);
        const stop = end === -1 ? lineText.length : end + 3;
        addToken(tokens, line, index, stop - index, "string");
        protectedRanges.push([index, stop]);
        inNote = end === -1;
        index = stop;
        continue;
      }

      if (lineText.startsWith("//", index)) {
        addToken(tokens, line, index, lineText.length - index, "comment");
        protectedRanges.push([index, lineText.length]);
        break;
      }

      if (lineText[index] === "\"") {
        const stop = scanQuoted(lineText, index, "\"");
        addToken(tokens, line, index, stop - index, "string");
        protectedRanges.push([index, stop]);
        index = stop;
        continue;
      }

      if (lineText[index] === "'") {
        const stop = scanQuoted(lineText, index, "'");
        addToken(tokens, line, index, stop - index, "string");
        protectedRanges.push([index, stop]);
        index = stop;
        continue;
      }

      index += 1;
    }

    collectLineTokens(lineText, line, protectedRanges, tokens);
  });

  return normalizeTokens(tokens);
}

function collectLineTokens(lineText, line, protectedRanges, tokens) {
  const unitRanges = [];

  for (const match of matchAll(lineText, /\bunits\b\s*:\s*([^,}]*)/g)) {
    const keyStart = match.index;
    const valueStartRaw = keyStart + match[0].indexOf(match[1]);
    const valueEndRaw = valueStartRaw + match[1].length;
    const valueStart = skipWhitespace(lineText, valueStartRaw, valueEndRaw);
    const valueEnd = trimEndWhitespace(lineText, valueStart, valueEndRaw);

    addIfFree(tokens, protectedRanges, line, keyStart, "units".length, "property");
    if (valueEnd > valueStart) {
      addToken(tokens, line, valueStart, valueEnd - valueStart, "string");
      unitRanges.push([valueStart, valueEnd]);
    }
  }

  for (const match of matchAll(lineText, /#[A-Za-z_][A-Za-z0-9_]*/g)) {
    addIfFree(tokens, protectedRanges, line, match.index, match[0].length, "keyword");
  }

  for (const match of matchAll(lineText, /@[A-Za-z_][A-Za-z0-9_]*/g)) {
    addIfFree(tokens, protectedRanges, line, match.index, match[0].length, "class");
  }

  for (const match of matchAll(lineText, /\b([A-Za-z_][A-Za-z0-9_]*)\b(?=\s*:(?![=]))/g)) {
    addIfFree(tokens, protectedRanges, line, match.index, match[1].length, "property");
  }

  for (const match of matchAll(lineText, /\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
    const word = match[0];
    if (KEYWORDS.has(word)) {
      addIfFree(tokens, protectedRanges, line, match.index, word.length, "keyword");
    }
  }

  for (const match of matchAll(lineText, /(?<![A-Za-z0-9_])(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?(?![A-Za-z0-9_])/g)) {
    if (!rangeIntersects(match.index, match.index + match[0].length, unitRanges)) {
      addIfFree(tokens, protectedRanges, line, match.index, match[0].length, "number");
    }
  }

  for (const match of matchAll(lineText, /\[[A-Za-z_][A-Za-z0-9_]*\]=|<=>|=>|:=|\.=|`=|==|!=|<=|>=|&&|\|\||\b(?:and|or)\b|[+\-*/^%<>=!]/g)) {
    if (!rangeIntersects(match.index, match.index + match[0].length, unitRanges)) {
      addIfFree(tokens, protectedRanges, line, match.index, match[0].length, "operator");
    }
  }
}

function scanQuoted(lineText, start, quote) {
  let index = start + 1;
  while (index < lineText.length) {
    if (lineText[index] === "\\") {
      index += 2;
      continue;
    }
    if (lineText[index] === quote) {
      return index + 1;
    }
    index += 1;
  }
  return lineText.length;
}

function scanQuotedWithStatus(lineText, start, quote) {
  let index = start + 1;
  while (index < lineText.length) {
    if (lineText[index] === "\\") {
      index += 2;
      continue;
    }
    if (lineText[index] === quote) {
      return { stop: index + 1, closed: true };
    }
    index += 1;
  }
  return { stop: lineText.length, closed: false };
}

function isIdentifierStart(value) {
  return typeof value === "string" && /^[A-Za-z_]$/.test(value);
}

function addSyntaxError(errors, line, start, end, message) {
  errors.push({
    line,
    start,
    endLine: line,
    end: Math.max(end, start + 1),
    message,
  });
}

function matchAll(text, regex) {
  return Array.from(text.matchAll(regex));
}

function skipWhitespace(text, start, end) {
  let index = start;
  while (index < end && /\s/.test(text[index])) {
    index += 1;
  }
  return index;
}

function trimEndWhitespace(text, start, end) {
  let index = end;
  while (index > start && /\s/.test(text[index - 1])) {
    index -= 1;
  }
  return index;
}

function addToken(tokens, line, start, length, type, modifiers = []) {
  if (length > 0) {
    tokens.push({ line, start, length, type, modifiers });
  }
}

function addIfFree(tokens, protectedRanges, line, start, length, type, modifiers = []) {
  if (length <= 0 || rangeIntersects(start, start + length, protectedRanges)) {
    return;
  }
  addToken(tokens, line, start, length, type, modifiers);
}

function rangeIntersects(start, end, ranges) {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}

function normalizeTokens(tokens) {
  const sorted = [...tokens].sort((a, b) => a.line - b.line || a.start - b.start || b.length - a.length);
  const result = [];
  let lastLine = -1;
  let lastEnd = -1;

  for (const token of sorted) {
    if (token.line !== lastLine) {
      lastLine = token.line;
      lastEnd = -1;
    }
    if (token.start < lastEnd) {
      continue;
    }
    result.push(token);
    lastEnd = token.start + token.length;
  }

  return result;
}

module.exports = {
  activate,
  deactivate,
  _test: {
    collectSemanticTokens,
    collectSyntaxErrors,
    tokenTypes,
    tokenModifiers,
  },
};
