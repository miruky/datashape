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

// ── JSON Schema(draft 2020-12)──

export function toJSONSchema(schema: Schema, rootName = 'Root'): string {
  const doc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: rootName,
    ...jsonSchemaNode(schema),
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

function jsonSchemaNode(schema: Schema): Record<string, unknown> {
  switch (schema.kind) {
    case 'null':
      return { type: 'null' };
    case 'string':
      return { type: 'string' };
    case 'integer':
      return { type: 'integer' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'any':
      return {};
    case 'array':
      return { type: 'array', items: jsonSchemaNode(schema.element) };
    case 'object': {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const f of schema.fields) {
        properties[f.key] = jsonSchemaNode(f.schema);
        if (!f.optional) required.push(f.key);
      }
      const node: Record<string, unknown> = { type: 'object', properties };
      if (required.length > 0) node.required = required;
      return node;
    }
    case 'union':
      return { anyOf: schema.options.map(jsonSchemaNode) };
  }
}

// ── Python(dataclass)──
// ネストしたオブジェクトには名前を付けた dataclass を起こす。利用より前に
// 定義されるよう、依存(ネスト)を先に積んでから自分を積む。

interface PyContext {
  classes: string[];
  names: Set<string>;
  usesAny: boolean;
}

export function toPython(schema: Schema, rootName = 'Root'): string {
  const ctx: PyContext = { classes: [], names: new Set(), usesAny: false };
  const rootType = pyRef(schema, rootName, ctx);

  const head: string[] = ['from __future__ import annotations'];
  const imports: string[] = [];
  if (ctx.classes.length > 0) imports.push('from dataclasses import dataclass');
  if (ctx.usesAny) imports.push('from typing import Any');

  const blocks: string[] = [...ctx.classes];
  if (schema.kind !== 'object') blocks.push(`${rootName} = ${rootType}`);

  return (
    [...head, '', ...imports, imports.length ? '' : null, blocks.join('\n\n')]
      .filter((line) => line !== null)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

function pyRef(schema: Schema, suggested: string, ctx: PyContext): string {
  switch (schema.kind) {
    case 'null':
      return 'None';
    case 'string':
      return 'str';
    case 'integer':
      return 'int';
    case 'number':
      return 'float';
    case 'boolean':
      return 'bool';
    case 'any':
      ctx.usesAny = true;
      return 'Any';
    case 'array':
      return `list[${pyRef(schema.element, pySingular(suggested), ctx)}]`;
    case 'union':
      return schema.options.map((o) => pyRef(o, suggested, ctx)).join(' | ');
    case 'object': {
      if (schema.fields.length === 0) {
        ctx.usesAny = true;
        return 'dict[str, Any]';
      }
      const name = pyClassName(suggested, ctx.names);
      const required: string[] = [];
      const optional: string[] = [];
      for (const f of schema.fields) {
        const type = pyRef(f.schema, f.key, ctx);
        if (f.optional) optional.push(`    ${pyField(f.key)}: ${type} | None = None`);
        else required.push(`    ${pyField(f.key)}: ${type}`);
      }
      // dataclassは既定値なしのフィールドを先に並べる必要がある
      const body = [...required, ...optional].join('\n');
      ctx.classes.push(`@dataclass\nclass ${name}:\n${body}`);
      return name;
    }
  }
}

function pascal(text: string): string {
  return text
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function pyClassName(base: string, names: Set<string>): string {
  let name = pascal(base) || 'Type';
  if (/^[0-9]/.test(name)) name = `T${name}`;
  let candidate = name;
  let n = 2;
  while (names.has(candidate)) candidate = `${name}${n++}`;
  names.add(candidate);
  return candidate;
}

// 配列要素のクラス名のために素朴に単数化する。末尾sを落とし、無ければItemを足す。
function pySingular(name: string): string {
  return /s$/i.test(name) ? name.slice(0, -1) : `${name}Item`;
}

// Pythonの識別子に直す。先頭が数字なら接頭辞、英数字以外は下線へ。
export function pyField(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (cleaned === '') return 'field_';
  return /^[0-9]/.test(cleaned) ? `f_${cleaned}` : cleaned;
}
