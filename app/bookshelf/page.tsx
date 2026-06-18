import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookshelfClient } from "@/components/BookshelfClient";

export default function BookshelfPage(): React.ReactElement {
  return (
    <main className="min-h-dvh bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            ホーム
          </Link>
        </nav>
        <BookshelfClient />
      </div>
    </main>
  );
}
