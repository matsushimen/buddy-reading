import { ReaderClient } from "@/components/ReaderClient";

type ReaderRouteProps = {
  params: Promise<{
    bookId: string;
  }>;
};

export default async function ReaderRoute({ params }: ReaderRouteProps): Promise<React.ReactElement> {
  const { bookId } = await params;
  return <ReaderClient bookId={bookId} />;
}
