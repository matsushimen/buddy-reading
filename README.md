# Buddy Reading (バディ・リーディング)

AI-powered PDF/EPUB reading assistant that provides context-aware LLM annotations, definitions, and summaries.
PDFやEPUBを読みながら、LLMを活用した用語・概念解説、キャラクターの整理、文脈要約をインタラクティブに行える読書支援Webアプリケーションです。

---

## 🚀 主な機能 (Key Features)

### 1. マルチフォーマット対応の読書エンジン
- **PDF 表示**: PDF.jsによる高速レンダリング、レスポンシブなサイズ追従。
- **EPUB 表示**: EPUB.jsによるリキッドレイアウト表示、グローバルページネーションの自動計測、進捗位置同期（EPUB CFI）。
- **モバイルファースト設計**: 片手での操作性に優れた画面下部の読書ナビゲーションバー（ページ送り、目次遷移、位置表示）、全画面表示モード。

### 2. コンテキスト志向の AI 注釈・解説 (AI Annotations)
- **スマート解説**: 読んでいるページ全体や、選択した一部分のテキストをコンテキストとして抽出し、AIが構造化された注釈（用語解説、歴史的背景、重要度、関連トピックなど）を生成。
- **スキル・プロンプト切り替え**: `skills/` ディレクトリにMarkdown形式で定義されたプロンプトテンプレート（例: 専門用語解説、語学学習、プログラミング学習など）をサーバー側で切り替えて実行可能。

### 3. エージェントによるコンテキスト管理 (Memory & Book Context)
- **ユーザー個人メモリ (`MEMORY.md`)**: ユーザーの関心事や読書スタイルを記録するパーソナライズメモリ。読書内容に基づきAIが更新案を提案し、ユーザーの承認（Approve）によって更新。
- **書籍専用コンテキスト (`BOOK_CONTEXT.md`)**: 登場人物の相関図や前提知識などを記録する書籍専用のコンテキスト。読書内容に基づきAIが追記案を提案・更新。

### 4. 書籍全体のベクトル検索 (RAG)
- **ローカルセグメンテーション**: 書籍ロード時にバックグラウンドで自動的にテキストを抽出・チャンク化。
- **ベクトル埋め込みのバッチ生成**: 安全なサーバーサイド API (`/api/embeddings`) を通じて埋め込み表現をバッチ生成し、IndexedDB (`db.bookChunks`) にキャッシュ。
- **クライアントサイド類似度計算**: チャット入力時にブラウザ上のコサイン類似度計算で適合する文章セグメントを高速抽出。
- **セキュアなコンテキスト注入**: 抽出されたセグメントを `[BOOK_SOURCE_n]` 境界で囲み、LLMプロンプトに安全に注入して書籍全体に基づく追質問に回答。

### 5. プライバシー & オフラインフレンドリー
- 取り込んだ書籍データ、読書進捗、AIによって生成された過去の注釈は、すべてブラウザのローカルデータベース（IndexedDB/Dexie）にのみ保存されます。
- APIキー等の機密情報はブラウザ側に保存せず、サーバーサイドのみで管理されます。

---

## 🛠️ アーキテクチャ (Architecture)

本アプリケーションは、信頼できない書籍テキストから安全に情報を抽出するために、以下のクローズドなフローを採用しています。

```
[ Reader (Browser) ]
       │  (1) 表示テキスト / 選択テキストを抽出
       ▼
[ Annotation Agent (Next.js Server) ]
       │  (2) リクエスト検証
       │  (3) 設定された Skill & MEMORY / BOOK_CONTEXT のロード
       │  (4) プロンプトの組み立て (書籍テキストの境界を厳密に区切り注入)
       ▼
[ LLM Provider (OpenAI Compatible) ]
       │  (5) 構造化JSON形式での応答
       ▼
[ Annotation Agent (Next.js Server) ]
       │  (6) Zodによる厳格なJSONスキーマ検証 & 自動修復
       ▼
[ Reader (Browser) ]
          (7) 安全に構造化された注釈をUIに描画
```

---

## 🏁 クイックスタート (Getting Started)

### 動作要件 (Prerequisites)
- Node.js v18 以上 (推奨 v20 以上)
- OpenAI 互換の API キー (OpenAI, Ollama, DeepSeek, LocalAI など)

### インストール (Installation)

1. リポジトリをクローンまたはダウンロードします。
```bash
git clone https://github.com/your-username/buddy-reading.git
cd buddy-reading
```

2. 依存関係をインストールします。
```bash
npm install
```

3. 環境設定ファイルを作成します。 `.env.example` をコピーして `.env.local` を作成します。
```bash
cp .env.example .env.local
```

4. `.env.local` をエディタで開き、お使いのLLMプロバイダの接続情報を設定します。
```bash
OPENAI_COMPAT_BASE_URL=https://api.openai.com/v1
OPENAI_COMPAT_API_KEY=your_actual_api_key_here
OPENAI_COMPAT_MODEL=gpt-4o-mini
OPENAI_COMPAT_TIMEOUT_MS=60000
OPENAI_COMPAT_TEMPERATURE=0.2
OPENAI_COMPAT_RESPONSE_FORMAT=true
AGENT_MOCK_MODE=false
```

5. 開発用ローカルサーバーを起動します。
```bash
npm run dev
```
ブラウザで `http://localhost:3000` にアクセスしてください。

---

## ⚙️ スキル・プロンプトの追加 (Custom Skills)

AIの注釈アプローチを変更する「スキル」は、`skills/` ディレクトリ配下にMarkdownファイルとして配置することで、プログラムの再ビルドなしで動的に追加・編集することができます。

### スキルファイルの例 (`skills/my-custom-skill.md`)
```markdown
---
name: "my-custom-skill"
description: "プログラミング用語とコード解説に特化したスキル"
---

# あなたの役割
あなたはプログラミングの学習を支援する優秀なAIバディです。

# 指示
提示された書籍テキストから、初心者にとって難解と思われる「プログラミング用語」「デザインパターン」「API/ライブラリ」を抽出し、以下のフォーマットで解説してください。
...
```

---

## 🧪 テスト・品質検証 (Testing & Quality)

コードの品質を担保するため、静的チェックとテストコードが整備されています。

```bash
# リンターの実行 (ESLint)
npm run lint

# 型チェック (TypeScript compile test)
npx tsc --noEmit

# ユニットテスト・統合テストの実行 (Vitest)
npm run test

# 本番ビルドの動作検証
npm run build
```

---

## 📄 ライセンス (License)

このプロジェクトは [MIT License](LICENSE) のもとでオープンソースとして公開されています。
