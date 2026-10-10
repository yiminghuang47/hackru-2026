import { Reveal } from "./Reveal";

/** One numbered step of the setup: big index + title on the left, options on the right. */
export function StepSection({
  id,
  index,
  title,
  hint,
  children,
}: {
  id: string;
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-10 border-t border-zinc-800/80 py-16 sm:py-24">
      <Reveal className="grid gap-8 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-16">
        <header>
          <p className="font-mono text-sm text-accent">{String(index).padStart(2, "0")}</p>
          <h2 className="mt-2 font-display text-5xl leading-none tracking-tight sm:text-6xl">
            {title}
          </h2>
          {hint && <p className="mt-3 max-w-[16rem] text-sm text-zinc-400">{hint}</p>}
        </header>
        <div className="space-y-4">{children}</div>
      </Reveal>
    </section>
  );
}
