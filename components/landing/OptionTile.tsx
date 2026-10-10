/** A big selectable choice: topic, difficulty, language, voice or tone. */
export function OptionTile({
  selected,
  onClick,
  title,
  description,
  trailing,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex items-start justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-zinc-800 bg-zinc-950/85 text-zinc-100 hover:-translate-y-0.5 hover:border-zinc-600"
      } ${className}`}
    >
      <span>
        <span className="block text-lg font-medium tracking-tight">{title}</span>
        {description && (
          <span
            className={`mt-0.5 block text-sm ${selected ? "text-accent/70" : "text-zinc-400"}`}
          >
            {description}
          </span>
        )}
      </span>
      {trailing ?? (
        <span
          aria-hidden
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border transition-colors ${
            selected ? "border-accent bg-accent" : "border-zinc-600"
          }`}
        />
      )}
    </button>
  );
}
