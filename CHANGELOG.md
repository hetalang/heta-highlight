# Changelog

## 0.1.10 - 2026-08-24

- Replaced the optional color theme with direct high-contrast Heta token decorations.
- Kept Heta Highlight colors active without requiring a separate theme selection.

## 0.1.9 - 2026-08-24

- Renamed the extension to Heta Highlight.
- Added an optional high-contrast Heta Highlight color theme.

## 0.1.8 - 2026-08-24

- Updated extension metadata: author is step-by-step and sponsor is InSysBio.
- Removed the changelog from the packaged extension details.
- Removed editor-specific wording from user-facing metadata and documentation.
- Replaced both SVG and PNG logo assets with the provided files.

## 0.1.7 - 2026-08-24

- Updated the Heta extension logo.

## 0.1.6 - 2026-08-22

- Added syntax error diagnostics and bright-red bold decorations for malformed Heta code.
- Detects mismatched/unclosed brackets, unterminated strings, block comments, note blocks, and malformed `@...` or `#...` tags.

## 0.1.5 - 2026-07-25

- Highlighted all Heta class tags such as `@Species`, `@Reaction`, `@Record`, `@Const`, and `@TimeSwitcher` as one class token including `@`.

## 0.1.4 - 2026-07-25

- Disabled editor bracket pair colorization for Heta so brackets inside comments are not recolored over the comment style.

## 0.1.3 - 2026-07-25

- Left Heta identifiers and class tags such as `@Species`, `@Reaction`, `@Record`, and `@Const` uncolored by the extension.
- Stopped assigning semantic declaration/function/namespace tokens to identifiers.
- Fixed numeric matching so digits inside identifiers such as `EC50_proe` are not highlighted as numbers.

## 0.1.2 - 2026-07-25

- Matched Heta class tags such as `@Const`, `@Species`, and `@Record` to keyword-style tokenization, as in the Zed Tree-sitter highlights.
- Stopped overriding `true`, `false`, `null`, and math constants with semantic keyword tokens so the active editor theme can handle their standard TextMate constant scopes.
- Kept the extension theme-neutral: no bundled color theme and no fixed color bindings.

## 0.1.1 - 2026-07-25

- Added the Heta extension logo.
- Reduced TextMate over-highlighting and moved Heta-specific highlighting to semantic tokens.
- Marked Heta classes such as `@Const` and `@Reaction` as class tokens instead of keyword tokens.

## 0.1.0 - 2026-07-25

- Initial extension for Heta syntax highlighting.
