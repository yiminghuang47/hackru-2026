import { Suspense } from "react";
import { InterviewRoom } from "@/components/InterviewRoom";

// Sessions live in localStorage, so the room renders entirely on the client.
export default function InterviewPage({ params }: PageProps<"/interview/[id]">) {
  return (
    <Suspense fallback={null}>
      <InterviewRoom params={params} />
    </Suspense>
  );
}
