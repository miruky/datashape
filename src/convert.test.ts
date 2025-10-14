import { describe, expect, it } from 'vitest';
import { convert, ConvertError, extToFormat, guessFormat, parse, stringify } from './convert';

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

describe('stringify オプション', () => {
  it('インデント幅を変えられる', () => {
    expect(stringify('json', { a: 1 }, { indent: 4 })).toBe('{\n    "a": 1\n}\n');
  });

  it('JSONを最小化できる', () => {
    expect(stringify('json', { a: 1, b: [2, 3] }, { minify: true })).toBe('{"a":1,"b":[2,3]}\n');
  });

  it('キーを再帰的に並べ替える', () => {
    const out = stringify('json', { b: 1, a: { d: 2, c: 3 } }, { sortKeys: true });
    expect(out).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');
  });

  it('並べ替えても配列の順序は保つ', () => {
    expect(stringify('json', { x: [3, 1, 2] }, { sortKeys: true })).toBe(
      '{\n  "x": [\n    3,\n    1,\n    2\n  ]\n}\n',
    );
  });

  it('YAMLのインデントにも効く', () => {
    expect(stringify('yaml', { a: { b: 1 } }, { indent: 4 })).toBe('a:\n    b: 1\n');
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

describe('extToFormat', () => {
  it('拡張子から形式を判定する', () => {
    expect(extToFormat('config.json')).toBe('json');
    expect(extToFormat('data.yaml')).toBe('yaml');
    expect(extToFormat('data.yml')).toBe('yaml');
    expect(extToFormat('Cargo.toml')).toBe('toml');
  });
  it('大文字や複数ドットでも判定する', () => {
    expect(extToFormat('A.B.JSON')).toBe('json');
  });
  it('未知の拡張子はnull', () => {
    expect(extToFormat('notes.txt')).toBeNull();
    expect(extToFormat('noext')).toBeNull();
  });
});
