// パース済みのJS値から構造(スキーマ)を推論する。配列要素やキーの
// 揺れはマージで畳み込み、欠けるキーは任意フィールドとして扱う。

export type Schema =
  | { kind: 'null' }
  | { kind: 'string' }
  | { kind: 'integer' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'any' }
  | { kind: 'array'; element: Schema }
  | { kind: 'object'; fields: Field[] }
  | { kind: 'union'; options: Schema[] };

export interface Field {
  key: string;
  schema: Schema;
  optional: boolean;
}

export function infer(value: unknown): Schema {
  if (value === null || value === undefined) return { kind: 'null' };
  if (typeof value === 'boolean') return { kind: 'boolean' };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { kind: 'integer' } : { kind: 'number' };
  }
  if (typeof value === 'string') return { kind: 'string' };
  if (Array.isArray(value)) {
    let element: Schema = { kind: 'any' };
    let first = true;
    for (const item of value) {
      element = first ? infer(item) : merge(element, infer(item));
      first = false;
    }
    return { kind: 'array', element };
  }
  if (typeof value === 'object') {
    const fields: Field[] = Object.entries(value as Record<string, unknown>).map(([key, v]) => ({
      key,
      schema: infer(v),
      optional: false,
    }));
    return { kind: 'object', fields };
  }
  return { kind: 'any' };
}

// 2つのスキーマを1つに畳み込む。数値の整数/実数や、オブジェクトのキーの
// 過不足を吸収し、両立しない型は union にする。
export function merge(a: Schema, b: Schema): Schema {
  if (a.kind === 'any') return b;
  if (b.kind === 'any') return a;
  if (a.kind === 'null') return b.kind === 'null' ? a : addNull(b);
  if (b.kind === 'null') return addNull(a);

  if (a.kind === 'integer' && b.kind === 'number') return { kind: 'number' };
  if (a.kind === 'number' && b.kind === 'integer') return { kind: 'number' };

  if (a.kind === 'array' && b.kind === 'array') {
    return { kind: 'array', element: merge(a.element, b.element) };
  }
  if (a.kind === 'object' && b.kind === 'object') {
    return mergeObjects(a, b);
  }
  if (a.kind === b.kind) return a;
  return unite(a, b);
}

function mergeObjects(
  a: Extract<Schema, { kind: 'object' }>,
  b: Extract<Schema, { kind: 'object' }>,
): Schema {
  const byKey = new Map<string, Field>();
  for (const f of a.fields) byKey.set(f.key, { ...f });
  const bKeys = new Set(b.fields.map((f) => f.key));

  for (const f of b.fields) {
    const existing = byKey.get(f.key);
    if (existing) {
      existing.schema = merge(existing.schema, f.schema);
      existing.optional = existing.optional || f.optional;
    } else {
      byKey.set(f.key, { ...f, optional: true });
    }
  }
  // aにあってbにないキーは任意になる
  for (const f of a.fields) {
    if (!bKeys.has(f.key)) byKey.get(f.key)!.optional = true;
  }
  return { kind: 'object', fields: [...byKey.values()] };
}

// null許容を union(null を含む)で表す。
function addNull(s: Schema): Schema {
  return unite({ kind: 'null' }, s);
}

function unite(a: Schema, b: Schema): Schema {
  const options: Schema[] = [];
  const push = (s: Schema) => {
    if (s.kind === 'union') for (const o of s.options) addUnique(options, o);
    else addUnique(options, s);
  };
  push(a);
  push(b);
  return options.length === 1 ? options[0]! : { kind: 'union', options };
}

function addUnique(options: Schema[], s: Schema): void {
  if (!options.some((o) => sameKind(o, s))) options.push(s);
}

function sameKind(a: Schema, b: Schema): boolean {
  return a.kind === b.kind;
}
