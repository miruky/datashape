import { describe, expect, it } from 'vitest';
import { convert, ConvertError, guessFormat, parse, stringify } from './convert';

const SAMPLE = { name: 'miruky', count: 3, tags: ['a', 'b'], nested: { ok: true } };

describe('parse と stringify の往復', () => {
  it('JSON', () => {
    expect(parse('json', stringify('json', SAMPLE))).toEqual(SAMPLE);
  });
  it('YAML', () => {
    expect(parse('yaml', stringify('yaml', SAMPLE))).toEqual(SAMPLE);
  });
  it('TOML', () => {
    expect(parse('toml', stringify('toml', SAMPLE))).toEqual(SAMPLE);
  });
});

describe('convert は形式をまたいで内容を保つ', () => {
  it('JSON → YAML → JSON', () => {
    const json = JSON.stringify(SAMPLE);
    const yaml = convert('json', 'yaml', json);
    expect(parse('json', convert('yaml', 'json', yaml))).toEqual(SAMPLE);
  });

  it('JSON → TOML → JSON', () => {
    const json = JSON.stringify(SAMPLE);
    const toml = convert('json', 'toml', json);
    expect(parse('json', convert('toml', 'json', toml))).toEqual(SAMPLE);
  });
});

describe('異常系', () => {
  it('壊れたJSONはConvertError', () => {
    expect(() => parse('json', '{ bad')).toThrow(ConvertError);
  });

  it('TOMLのトップレベルが配列なら拒否', () => {
    expect(() => stringify('toml', [1, 2, 3])).toThrow(ConvertError);
  });
});

describe('guessFormat', () => {
  it('JSON', () => {
    expect(guessFormat('{"a":1}')).toBe('json');
    expect(guessFormat('[1,2]')).toBe('json');
  });
  it('TOML', () => {
    expect(guessFormat('title = "x"')).toBe('toml');
  });
  it('YAML', () => {
    expect(guessFormat('name: miruky')).toBe('yaml');
    expect(guessFormat('- one\n- two')).toBe('yaml');
  });
  it('空はnull', () => {
    expect(guessFormat('   ')).toBeNull();
  });
});
