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

export function stringify(format: Format, value: unknown): string {
  switch (format) {
    case 'json':
      return JSON.stringify(value, null, 2) + '\n';
    case 'yaml':
      return yamlDump(value, { indent: 2, lineWidth: 100, noRefs: true });
    case 'toml':
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new ConvertError('TOMLのトップレベルはオブジェクトである必要があります');
      }
      return tomlStringify(value as Record<string, unknown>);
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
