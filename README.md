# AI Reading Assistant - Codex Build Brief

目的: PDF/EPUBを読む画面に、LLMによる注釈・固有名詞解説・概念解説を表示する汎用読書支援アプリを作る。

想定形態:
- Web/PWAを第一ターゲットにする
- 将来、CapacitorでiOS/Androidネイティブラッパー化できる構成にする
- OpenAI互換APIエンドポイントを利用する
- サーバー側にエージェント層を持たせ、skillを読み、v0.1では既存のMEMORY.md / BOOK_CONTEXT.mdをread-onlyで参照する

v0.1 MVPの定義:
1. PDFをアップロードまたはローカル選択できる
2. PDF本文を表示できる
3. 現在表示中のページ・選択テキストをサーバーへ送信できる
4. サーバーがOpenAI互換APIを呼び、注釈候補をJSONで返す
5. タブレット/PCではサイドバー、スマホではBottom Sheet/吹き出しで表示する
6. 読書位置・注釈結果をローカル保存する

v0.2以降:
- EPUBアップロード、表示、章/Spineナビゲーション、EPUB CFI進捗管理

非目標 v0.1:
- 本全体RAG
- EPUB対応
- 複数ユーザー同期
- DRM付き電子書籍対応
- App Store/Google Play配布
- 自動OCR

## Phase1実装

Phase1ではNext.js App Router、TypeScript strict、Tailwind CSS、PWA manifest/service worker、PDF.js、EPUB.jsを使う。

実装済み:
- ホーム画面
- 本棚画面
- PDF/EPUBのローカル取り込み
- PDF表示
- EPUB表示
- AIサイドバーUI
- `/api/annotations` のモックAgent API
- 構造化JSONレスポンスのZod検証

未実装:
- OpenAI API接続
- MEMORY機能
- RAG
- DRM付き電子書籍

## 開発コマンド

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

## Phase2実装

Phase2ではPhase1監査で見つかった拡張前の負債を解消する。

実装済み:
- Agent APIを `route -> annotation-agent -> prompt-builder -> mock-llm` に分離
- プロンプト境界を明示し、本文/選択テキストを未信頼ソースとして扱う
- IndexedDBの読書位置をPDFページ/EPUB CFIで復元
- 設定由来の `userId` / `skillId` / language / detailLevel をAgent requestへ渡す
- PDF表示をResizeObserverでリサイズ追従
- EPUB iframe内の選択テキスト取得
- PWA manifest metadataの補強

引き続き未実装:
- OpenAI API接続
- MEMORY.md更新/表示
- RAG
- マルチユーザー認証

## Phase3実装

Phase3ではモックAgentから実AI接続可能なAgentへ進める。

実装済み:
- OpenAI互換Chat Completions APIへのserver-side接続
- `.env.local` によるAPI設定
- APIキー未設定時のモックfallback
- `skills/{skillId}.md` のread-only読み込み
- prompt builderの本番化
- LLM応答の構造化JSON検証
- JSON抽出fallback、ローカルLLM向けの応答正規化、安全なfallback注釈
- 注釈結果のIndexedDB保存
- 保存済み注釈の自動表示
- 注釈の再生成
- 長い本文の送信量制限

`.env.local` 例:

```bash
OPENAI_COMPAT_BASE_URL=https://api.openai.com/v1
OPENAI_COMPAT_API_KEY=your_api_key_here
OPENAI_COMPAT_MODEL=gpt-4o-mini
OPENAI_COMPAT_TIMEOUT_MS=60000
OPENAI_COMPAT_TEMPERATURE=0.2
OPENAI_COMPAT_RESPONSE_FORMAT=true
AGENT_MOCK_MODE=false
```

Ollamaなど一部のOpenAI互換APIで `response_format` が不安定な場合は、`OPENAI_COMPAT_RESPONSE_FORMAT=false` にする。
APIキーはブラウザに保存しない。UIは `/api/annotations` のみを呼び、LLM providerはserver-side Agentから呼ぶ。

## Phase4以降の実装・予定

### 実装済み
- **読書ナビゲーションUIの改善**:
  - `EpubViewer` および `PdfViewer` のページ送り・目次遷移・進捗表示等の操作コントロールを画面下部（フッター）に集約し、片手での操作性を向上。
  - モバイル表示時における「AI注釈を開く/要約する」フローティングボタンの位置を `bottom-20` へ調整し、下部ナビゲーションバーとの重なりを防止。
- **MEMORY.mdの更新**: 読み取り・提案・承認保存のフローを実装済み。
- **BOOK_CONTEXT.mdの更新**: 読み取り・提案・承認保存のフローを実装済み。

### 今後の予定
- 本文中の単語クリック/タップによる説明表示
- サイドバー占有を減らしたpopover/bottom sheet型の注釈UI（吹き出しやシート形式）
- 追質問によるLLM対話の拡張
- RAG
- マルチユーザー認証

