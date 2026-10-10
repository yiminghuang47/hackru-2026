import { Suspense } from "react";
import { ReviewView } from "@/components/ReviewView";

// Sessions live in localStorage, so the review renders entirely on the client.
export default function ReviewPage({ params }: PageProps<"/review/[id]">) {
  return (
    <Suspense fallback={null}>
      <ReviewView params={params} />
    </Suspense>
  );
}
