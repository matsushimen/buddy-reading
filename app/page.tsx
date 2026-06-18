import Link from "next/link";
import { BookOpen, Library, Sparkles } from "lucide-react";
import { BookImportButton } from "@/components/BookImportButton";

export default function HomePage(): React.ReactElement {
  return (
    <main className="min-h-dvh bg-paper">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-ink">
            <BookOpen className="h-5 w-5" aria-hidden />
            Buddy Reading
          </Link>
          <Link
            href="/bookshelf"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm"
          >
            <Library className="h-4 w-4" aria-hidden />
            本棚
          </Link>
        </nav>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_420px]">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm text-slate-600">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden />
              Phase1: mock Agent API
            </p>
            <h1 className="text-4xl font-semibold tracking-normal text-ink sm:text-5xl">PDF/EPUBを読みながら注釈を確認する</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              ローカルに取り込んだ本を表示し、ReaderからAgent APIを経由して構造化JSONのモック注釈を表示します。
              OpenAI API、MEMORY、RAGはまだ接続していません。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <BookImportButton />
              <Link
                href="/bookshelf"
                className="inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm"
              >
                本棚を開く
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
            <div className="aspect-[4/5] rounded-md border border-line bg-[linear-gradient(180deg,#ffffff,#f4f7ff)] p-5">
              <div className="mb-4 h-3 w-24 rounded-full bg-blue-200" />
              <div className="space-y-3">
                <div className="h-4 rounded bg-slate-200" />
                <div className="h-4 w-11/12 rounded bg-slate-200" />
                <div className="h-4 w-10/12 rounded bg-slate-200" />
              </div>
              <div className="mt-8 rounded-md border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 h-3 w-28 rounded bg-blue-300" />
                <div className="space-y-2">
                  <div className="h-3 rounded bg-blue-100" />
                  <div className="h-3 w-4/5 rounded bg-blue-100" />
                  <div className="h-3 w-2/3 rounded bg-blue-100" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
