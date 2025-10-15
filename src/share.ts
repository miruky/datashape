// 状態をURLのハッシュに載せて共有するための、UTF-8安全なbase64エンコード。
// JSONを直にURLへ置くと記号が嵩むので、バイト列をbase64へ畳む。

export function encodeState(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeState<T>(text: string): T {
  const binary = atob(text);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
