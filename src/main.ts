import './style.css';
import { toGo, toTypeScript } from './codegen';
import { ConvertError, guessFormat, parse, stringify, type Format } from './convert';
import { infer } from './schema';
import { applyTheme, loadTheme, nextTheme, THEME_LABEL, type ThemeMode } from './theme';

type Target = Format | 'typescript' | 'go';

const SAMPLE = `{
  "name": "miruky",
  "active": true,
  "score": 4.5,
  "tags": ["fiction", "essay"],
  "profile": { "city": "Tokyo", "since": 2019 }
}`;

const BRAND_MARK = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
  <rect x="3" y="7" width="8.4" height="10" rx="2"/>
  <circle cx="18.2" cy="12" r="3.3"/>
  <path d="M11.4 12h3.5" stroke-linecap="round"/>
</svg>`;

const COPY_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
  <rect x="9" y="9" width="11" height="11" rx="2"/>
  <path d="M5 15V5a2 2 0 0 1 2-2h8" stroke-linecap="round"/>
</svg>`;

const THEME_ICON: Record<ThemeMode, string> = {
  light: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
    <circle cx="12" cy="12" r="4.2"/>
    <path d="M12 3v2.4M12 18.6V21M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M3 12h2.4M18.6 12H21M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7"/>
  </svg>`,
  dark: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 14.2A7.5 7.5 0 0 1 9.8 4 7.5 7.5 0 1 0 20 14.2z"/>
  </svg>`,
  auto: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
    <circle cx="12" cy="12" r="8.4"/>
    <path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none"/>
  </svg>`,
};

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つからない');

app.innerHTML = `
  <a class="skip-link" href="#workspace">本文へ移動</a>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="./" aria-label="datashape ホーム">
        <span class="brand-mark">${BRAND_MARK}</span>
        <span class="brand-name">datashape</span>
      </a>
      <button id="theme" class="theme-toggle" type="button"></button>
    </div>
  </header>

  <main class="shell">
    <p class="kicker">data format converter</p>
    <h1 class="title">データ形式の相互変換と型の生成</h1>
    <p class="lede">JSON・YAML・TOML を相互に変換し、入力した構造から TypeScript の型や Go の構造体を起こします。形式は自動で判定し、処理はすべてブラウザ内で完結します。</p>

    <div id="workspace" class="workspace">
      <section class="pane">
        <div class="pane-bar">
          <label>入力
            <span class="select-wrap">
              <select id="from" aria-label="入力形式">
                <option value="auto">自動判定</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="toml">TOML</option>
              </select>
            </span>
          </label>
          <span class="detected" id="detected" aria-live="polite"></span>
        </div>
        <textarea id="input" spellcheck="false" aria-label="入力データ"></textarea>
      </section>
      <section class="pane">
        <div class="pane-bar">
          <label>出力
            <span class="select-wrap">
              <select id="to" aria-label="出力形式">
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="toml">TOML</option>
                <option value="typescript">TypeScript 型</option>
                <option value="go">Go 構造体</option>
              </select>
            </span>
          </label>
          <div class="bar-right">
            <span class="count" id="count"></span>
            <button type="button" id="copy" class="copy" aria-label="出力をコピー">
              ${COPY_ICON}<span id="copy-label">コピー</span>
            </button>
          </div>
        </div>
        <pre class="output" id="output" aria-live="polite"><code></code></pre>
      </section>
    </div>

    <p class="error" id="error" role="alert" hidden></p>
  </main>

  <footer class="site-footer">
    <span>ブラウザ内で完結。データを外部に送信しません。</span>
    <a href="https://github.com/miruky/datashape" rel="noreferrer">ソースコード</a>
  </footer>
`;

const fromSel = app.querySelector<HTMLSelectElement>('#from')!;
const toSel = app.querySelector<HTMLSelectElement>('#to')!;
const input = app.querySelector<HTMLTextAreaElement>('#input')!;
const outputCode = app.querySelector<HTMLElement>('#output code')!;
const errorEl = app.querySelector<HTMLElement>('#error')!;
const detectedEl = app.querySelector<HTMLElement>('#detected')!;
const copyBtn = app.querySelector<HTMLButtonElement>('#copy')!;
const copyLabel = app.querySelector<HTMLSpanElement>('#copy-label')!;
const countEl = app.querySelector<HTMLSpanElement>('#count')!;
const themeBtn = app.querySelector<HTMLButtonElement>('#theme')!;

input.value = SAMPLE;

// ── テーマ切替(自動 → ライト → ダークの循環)──
let theme = loadTheme();
function renderTheme(): void {
  applyTheme(theme);
  const label = THEME_LABEL[theme];
  themeBtn.innerHTML = `${THEME_ICON[theme]}<span>${label}</span>`;
  themeBtn.setAttribute('aria-label', `配色: ${label}(クリックで切り替え)`);
}
themeBtn.addEventListener('click', () => {
  theme = nextTheme(theme);
  renderTheme();
});
renderTheme();

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
    countEl.textContent = '';
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
    const out = produce(target, value);
    outputCode.textContent = out;
    countEl.textContent = out ? `${out.split('\n').length} 行` : '';
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
  countEl.textContent = '';
}

copyBtn.addEventListener('click', async () => {
  const text = outputCode.textContent ?? '';
  if (!text) return;
  let message = 'コピーしました';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    message = 'コピーできません';
  }
  copyLabel.textContent = message;
  copyBtn.classList.add('done');
  window.setTimeout(() => {
    copyLabel.textContent = 'コピー';
    copyBtn.classList.remove('done');
  }, 1400);
});

input.addEventListener('input', render);
fromSel.addEventListener('change', render);
toSel.addEventListener('change', render);
render();
