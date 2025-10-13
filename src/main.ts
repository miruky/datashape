import './style.css';
import { toGo, toTypeScript } from './codegen';
import { ConvertError, guessFormat, parse, stringify, type Format } from './convert';
import { infer } from './schema';

type Target = Format | 'typescript' | 'go';

const SAMPLE = `{
  "name": "miruky",
  "active": true,
  "score": 4.5,
  "tags": ["fiction", "essay"],
  "profile": { "city": "Tokyo", "since": 2019 }
}`;

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つからない');

app.innerHTML = `
  <main class="wrap">
    <header class="head">
      <h1>datashape</h1>
      <p class="sub">JSON・YAML・TOML を相互変換し、スキーマから型定義を起こす</p>
    </header>
    <div class="panes">
      <section class="pane">
        <div class="pane-bar">
          <label>入力
            <select id="from">
              <option value="auto">自動判定</option>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
              <option value="toml">TOML</option>
            </select>
          </label>
          <span class="detected" id="detected"></span>
        </div>
        <textarea id="input" spellcheck="false" aria-label="入力"></textarea>
      </section>
      <section class="pane">
        <div class="pane-bar">
          <label>出力
            <select id="to">
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
              <option value="toml">TOML</option>
              <option value="typescript">TypeScript 型</option>
              <option value="go">Go 構造体</option>
            </select>
          </label>
          <button type="button" id="copy" class="copy">コピー</button>
        </div>
        <pre class="output" id="output" aria-live="polite"><code></code></pre>
      </section>
    </div>
    <p class="error" id="error" role="alert" hidden></p>
  </main>
`;

const fromSel = app.querySelector<HTMLSelectElement>('#from')!;
const toSel = app.querySelector<HTMLSelectElement>('#to')!;
const input = app.querySelector<HTMLTextAreaElement>('#input')!;
const outputCode = app.querySelector<HTMLElement>('#output code')!;
const errorEl = app.querySelector<HTMLElement>('#error')!;
const detectedEl = app.querySelector<HTMLElement>('#detected')!;
const copyBtn = app.querySelector<HTMLButtonElement>('#copy')!;

input.value = SAMPLE;

function resolveFrom(): Format | null {
  const choice = fromSel.value;
  if (choice === 'auto') {
    const guess = guessFormat(input.value);
    detectedEl.textContent = guess ? `判定: ${guess.toUpperCase()}` : '判定できません';
    return guess;
  }
  detectedEl.textContent = '';
  return choice as Format;
}

function render(): void {
  const from = resolveFrom();
  if (input.value.trim() === '') {
    outputCode.textContent = '';
    errorEl.hidden = true;
    return;
  }
  if (!from) {
    showError('入力の形式を判定できませんでした。左上で形式を選んでください。');
    return;
  }
  let value: unknown;
  try {
    value = parse(from, input.value);
  } catch (error) {
    showError(error instanceof ConvertError ? error.message : String(error));
    return;
  }

  const target = toSel.value as Target;
  try {
    outputCode.textContent = produce(target, value);
    errorEl.hidden = true;
  } catch (error) {
    showError(error instanceof ConvertError ? error.message : String(error));
  }
}

function produce(target: Target, value: unknown): string {
  switch (target) {
    case 'json':
    case 'yaml':
    case 'toml':
      return stringify(target, value);
    case 'typescript':
      return toTypeScript(infer(value));
    case 'go':
      return toGo(infer(value));
  }
}

function showError(message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
  outputCode.textContent = '';
}

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(outputCode.textContent ?? '');
  copyBtn.textContent = 'コピーしました';
  window.setTimeout(() => (copyBtn.textContent = 'コピー'), 1200);
});

input.addEventListener('input', render);
fromSel.addEventListener('change', render);
toSel.addEventListener('change', render);
render();
