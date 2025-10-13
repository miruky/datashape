import { describe, expect, it } from 'vitest';
import { infer, merge, type Schema } from './schema';

describe('infer 基本型', () => {
  it('プリミティブ', () => {
    expect(infer(null)).toEqual({ kind: 'null' });
    expect(infer(true)).toEqual({ kind: 'boolean' });
    expect(infer(3)).toEqual({ kind: 'integer' });
    expect(infer(3.5)).toEqual({ kind: 'number' });
    expect(infer('x')).toEqual({ kind: 'string' });
  });

  it('オブジェクト', () => {
    expect(infer({ a: 1, b: 'x' })).toEqual({
      kind: 'object',
      fields: [
        { key: 'a', schema: { kind: 'integer' }, optional: false },
        { key: 'b', schema: { kind: 'string' }, optional: false },
      ],
    });
  });

  it('空配列は要素any', () => {
    expect(infer([])).toEqual({ kind: 'array', element: { kind: 'any' } });
  });

  it('整数と実数の混在配列はnumber', () => {
    expect(infer([1, 2.5])).toEqual({ kind: 'array', element: { kind: 'number' } });
  });
});

describe('merge', () => {
  it('anyは相手を採用する', () => {
    expect(merge({ kind: 'any' }, { kind: 'string' })).toEqual({ kind: 'string' });
  });

  it('整数+実数はnumber', () => {
    expect(merge({ kind: 'integer' }, { kind: 'number' })).toEqual({ kind: 'number' });
  });

  it('null+型はnullを含むunion', () => {
    const merged = merge({ kind: 'null' }, { kind: 'string' }) as Extract<
      Schema,
      { kind: 'union' }
    >;
    expect(merged.kind).toBe('union');
    expect(merged.options.map((o) => o.kind).sort()).toEqual(['null', 'string']);
  });

  it('異なる型はunion', () => {
    const merged = merge({ kind: 'string' }, { kind: 'boolean' }) as Extract<
      Schema,
      { kind: 'union' }
    >;
    expect(merged.kind).toBe('union');
  });
});

describe('オブジェクト配列のマージ', () => {
  it('片方にしかないキーは任意になる', () => {
    const schema = infer([{ a: 1, b: 2 }, { a: 1 }]) as Extract<Schema, { kind: 'array' }>;
    const obj = schema.element as Extract<Schema, { kind: 'object' }>;
    const a = obj.fields.find((f) => f.key === 'a')!;
    const b = obj.fields.find((f) => f.key === 'b')!;
    expect(a.optional).toBe(false);
    expect(b.optional).toBe(true);
  });

  it('同じキーの型はマージされる', () => {
    const schema = infer([{ x: 1 }, { x: 1.5 }]) as Extract<Schema, { kind: 'array' }>;
    const obj = schema.element as Extract<Schema, { kind: 'object' }>;
    expect(obj.fields[0]!.schema).toEqual({ kind: 'number' });
  });
});
