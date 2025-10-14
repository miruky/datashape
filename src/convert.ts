import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml';

export type Format = 'json' | 'yaml' | 'toml';

export const FORMATS: Format[] = ['json', 'yaml', 'toml'];

export class ConvertError extends Error {}

export function parse(format: Format, text: string): unknown {
  try {
    switch (format) {
      case 'json':
        return JSON.parse(text);
      case 'yaml':
        return yamlLoad(text) ?? null;
      case 'toml':
        return tomlParse(text);
    }
  } catch (error) {
    throw new ConvertError(`${format.toUpperCase()}として読めません: ${(error as Error).message}`);
  }
}

export interface StringifyOptions {
  indent?: number; // JSON・YAMLのインデント幅(既定2)
  sortKeys?: boolean; // オブジェクトのキーを再帰的に昇順へ
  minify?: boolean; // JSONを1行に詰める(indentより優先)
}

// オブジェクトのキーを再帰的に並べ替えた新しい値を返す。配列は順序を保つ。
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}

export function stringify(format: Format, value: unknown, options: StringifyOptions = {}): string {
  const v = options.sortKeys ? sortDeep(value) : value;
  const indent = options.indent ?? 2;
  switch (format) {
    case 'json':
      return (options.minify ? JSON.stringify(v) : JSON.stringify(v, null, indent)) + '\n';
    case 'yaml':
      return yamlDump(v, { indent, lineWidth: 100, noRefs: true });
    case 'toml':
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        throw new ConvertError('TOMLのトップレベルはオブジェクトである必要があります');
      }
      return tomlStringify(v as Record<string, unknown>);
  }
}

// 入力の見た目から形式を推測する。確証が持てないときはnull。
export function guessFormat(text: string): Format | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (/^\s*\[[^\]]+\]\s*$/m.test(trimmed) || /^[\w.-]+\s*=\s*/m.test(trimmed)) return 'toml';
  if (/^[\w.-]+\s*:\s/m.test(trimmed) || /^\s*-\s/m.test(trimmed)) return 'yaml';
  return null;
}

export function convert(from: Format, to: Format, text: string): string {
  return stringify(to, parse(from, text));
}
