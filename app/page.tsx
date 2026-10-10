import { Cursor } from "@/components/landing/Cursor";
import { Hero } from "@/components/landing/Hero";
import { SetupForm } from "@/components/landing/SetupForm";

export default function SetupPage() {
  return (
    <>
      <Cursor />
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 sm:px-10">
        <Hero />
        <SetupForm />
      </main>
    </>
  );
}
