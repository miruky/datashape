import { describe, expect, it } from 'vitest';
import { goField, toGo, toTypeScript } from './codegen';
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
