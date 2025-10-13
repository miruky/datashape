import type { Field, Schema } from './schema';

// スキーマから型定義を生成する。ネストしたオブジェクトは名前を作らず
// インラインで展開し、命名衝突や単数化の難しさを避ける。

const INDENT = '  ';

export function toTypeScript(schema: Schema, rootName = 'Root'): string {
  if (schema.kind === 'object') {
    return `interface ${rootName} ${tsObject(schema.fields, 0)}\n`;
  }
  return `type ${rootName} = ${tsType(schema, 0)};\n`;
}

function tsType(schema: Schema, depth: number): string {
  switch (schema.kind) {
    case 'null':
      return 'null';
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'any':
      return 'unknown';
    case 'array': {
      const inner = tsType(schema.element, depth);
      return schema.element.kind === 'union' ? `(${inner})[]` : `${inner}[]`;
    }
    case 'object':
      return tsObject(schema.fields, depth);
    case 'union':
      return schema.options.map((o) => tsType(o, depth)).join(' | ');
  }
}

function tsObject(fields: Field[], depth: number): string {
  if (fields.length === 0) return 'Record<string, unknown>';
  const pad = INDENT.repeat(depth + 1);
  const close = INDENT.repeat(depth);
  const lines = fields.map(
    (f) => `${pad}${tsKey(f.key)}${f.optional ? '?' : ''}: ${tsType(f.schema, depth + 1)};`,
  );
  return `{\n${lines.join('\n')}\n${close}}`;
}

function tsKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

export function toGo(schema: Schema, rootName = 'Root'): string {
  if (schema.kind === 'object') {
    return `type ${rootName} ${goStruct(schema.fields, 0)}\n`;
  }
  return `type ${rootName} ${goType(schema, 0)}\n`;
}

function goType(schema: Schema, depth: number): string {
  switch (schema.kind) {
    case 'null':
    case 'any':
    case 'union':
      return 'interface{}';
    case 'string':
      return 'string';
    case 'integer':
      return 'int64';
    case 'number':
      return 'float64';
    case 'boolean':
      return 'bool';
    case 'array':
      return `[]${goType(schema.element, depth)}`;
    case 'object':
      return goStruct(schema.fields, depth);
  }
}

function goStruct(fields: Field[], depth: number): string {
  if (fields.length === 0) return 'map[string]interface{}';
  const pad = INDENT.repeat(depth + 1);
  const close = INDENT.repeat(depth);
  const lines = fields.map((f) => {
    const tag = f.optional ? `\`json:"${f.key},omitempty"\`` : `\`json:"${f.key}"\``;
    return `${pad}${goField(f.key)} ${goType(f.schema, depth + 1)} ${tag}`;
  });
  return `struct {\n${lines.join('\n')}\n${close}}`;
}

// json:"key" は元のキーを保つので、フィールド名は素直なPascalCaseにする。
export function goField(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(name) || name === '' ? `Field_${name}` : name;
}
