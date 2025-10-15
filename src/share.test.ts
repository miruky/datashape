import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from './share';

describe('encodeState / decodeState', () => {
  it('オブジェクトを往復できる', () => {
    const state = { input: '{"a":1}', from: 'json', to: 'yaml', indent: '2' };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('日本語や記号を含む入力も壊れない', () => {
    const state = { input: 'タイトル: 日本語のテスト 🎏 = "ok"' };
    expect(decodeState<typeof state>(encodeState(state))).toEqual(state);
  });

  it('URLに使える文字だけになる(base64)', () => {
    const encoded = encodeState({ input: 'hello world' });
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
