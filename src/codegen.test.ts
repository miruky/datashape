import { describe, expect, it } from 'vitest';
import { goField, pyField, toGo, toJSONSchema, toPython, toTypeScript } from './codegen';
import { infer } from './schema';

describe('toTypeScript', () => {
  it('オブジェクトをinterfaceにする', () => {
    const ts = toTypeScript(infer({ name: 'x', count: 2 }));
    expect(ts).toContain('interface Root {');
    expect(ts).toContain('name: string;');
    expect(ts).toContain('count: number;');
  });

  it('配列とネストを展開する', () => {
    const ts = toTypeScript(infer({ tags: ['a'], nested: { ok: true } }));
    expect(ts).toContain('tags: string[];');
    expect(ts).toContain('nested: {');
    expect(ts).toContain('ok: boolean;');
  });

  it('任意フィールドは?をつける', () => {
    const ts = toTypeScript(infer({ items: [{ a: 1, b: 2 }, { a: 1 }] }));
    expect(ts).toContain('b?: number;');
  });

  it('不正なキーは引用する', () => {
    const ts = toTypeScript(infer({ 'a-b': 1 }));
    expect(ts).toContain('"a-b"');
  });
});

describe('toGo', () => {
  it('structとjsonタグを生成する', () => {
    const go = toGo(infer({ userName: 'x', count: 2 }));
    expect(go).toContain('type Root struct {');
    expect(go).toContain('UserName string `json:"userName"`');
    expect(go).toContain('Count int64 `json:"count"`');
  });

  it('任意フィールドはomitempty', () => {
    const go = toGo(infer({ items: [{ a: 1, b: 2 }, { a: 1 }] }));
    expect(go).toContain('omitempty');
  });
});

describe('goField', () => {
  it('PascalCaseにする', () => {
    expect(goField('user_name')).toBe('UserName');
    expect(goField('id')).toBe('Id');
    expect(goField('created-at')).toBe('CreatedAt');
  });
});

describe('toJSONSchema', () => {
  it('オブジェクトのproperties/requiredとtypeを出す', () => {
    const out = JSON.parse(toJSONSchema(infer({ name: 'x', count: 2, ok: true })));
    expect(out.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(out.type).toBe('object');
    expect(out.properties.name).toEqual({ type: 'string' });
    expect(out.properties.count).toEqual({ type: 'integer' });
    expect(out.properties.ok).toEqual({ type: 'boolean' });
    expect(out.required).toEqual(['name', 'count', 'ok']);
  });

  it('任意フィールドはrequiredから外れる', () => {
    const out = JSON.parse(toJSONSchema(infer([{ a: 1, b: 2 }, { a: 1 }])));
    expect(out.type).toBe('array');
    expect(out.items.required).toEqual(['a']);
  });

  it('配列とネストを表す', () => {
    const out = JSON.parse(toJSONSchema(infer({ tags: ['a'], nested: { ok: true } })));
    expect(out.properties.tags).toEqual({ type: 'array', items: { type: 'string' } });
    expect(out.properties.nested.type).toBe('object');
  });
});

describe('toPython', () => {
  it('dataclassとフィールド型を生成する', () => {
    const py = toPython(infer({ name: 'x', score: 4.5, ok: true }));
    expect(py).toContain('from dataclasses import dataclass');
    expect(py).toContain('@dataclass');
    expect(py).toContain('class Root:');
    expect(py).toContain('    name: str');
    expect(py).toContain('    score: float');
    expect(py).toContain('    ok: bool');
  });

  it('ネストしたオブジェクトを利用前に定義する', () => {
    const py = toPython(infer({ profile: { city: 'Tokyo' } }));
    expect(py.indexOf('class Profile:')).toBeLessThan(py.indexOf('class Root:'));
    expect(py).toContain('    profile: Profile');
  });

  it('任意フィールドは末尾でNone既定にする', () => {
    const py = toPython(infer([{ a: 1, b: 2 }, { a: 1 }]));
    expect(py).toContain('    a: int');
    expect(py).toContain('    b: int | None = None');
    expect(py).toContain('Root = list[');
  });

  it('Anyを使うときだけtypingを読み込む', () => {
    expect(toPython(infer({ a: 1 }))).not.toContain('from typing import Any');
    expect(toPython(infer({ a: [] }))).toContain('from typing import Any');
  });
});

describe('pyField', () => {
  it('Pythonの識別子に直す', () => {
    expect(pyField('user-name')).toBe('user_name');
    expect(pyField('created.at')).toBe('created_at');
    expect(pyField('2fa')).toBe('f_2fa');
  });
});
