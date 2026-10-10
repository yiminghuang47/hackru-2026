"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DIFFICULTIES,
  LANGUAGE_LABELS,
  LANGUAGES,
  TONES,
  TOPICS,
  type Difficulty,
  type Language,
  type Tone,
} from "@/lib/types";
import type { Problem } from "@/lib/types";
import { VOICES } from "@/lib/voices";
import { useSessionStore } from "@/lib/session";
import { useCustomQuestions } from "@/lib/customQuestions";
import { CustomQuestionForm } from "@/components/CustomQuestionForm";
import { ProblemPreview } from "@/components/ProblemPreview";
import { MyQuestionsList } from "@/components/MyQuestionsList";

type Source = "topic" | "custom";

/** Drops blank rows left over from editing in the preview. */
function cleanProblem(p: Problem): Problem {
  return {
    ...p,
    constraints: p.constraints.map((c) => c.trim()).filter(Boolean),
    examples: p.examples.filter((ex) => ex.input.trim() || ex.output.trim()),
  };
}

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  Friendly: "Encouraging and patient",
  Neutral: "Professional, keeps it moving",
  Tough: "FAANG-style, pushes back hard",
};

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        selected
          ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
          : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const createSession = useSessionStore((s) => s.createSession);
  const customQuestions = useCustomQuestions((s) => s.questions);
  const saveQuestion = useCustomQuestions((s) => s.save);
  const removeQuestion = useCustomQuestions((s) => s.remove);

  const [source, setSource] = useState<Source>("topic");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [language, setLanguage] = useState<Language>("python");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [tone, setTone] = useState<Tone>("Neutral");

  const isOther = topic === "Other";
  const selectedQuestion = customQuestions.find((q) => q.id === selectedId) ?? null;
  const formOpen = showForm || customQuestions.length === 0;
  const canStart =
    source === "custom" ? selectedQuestion !== null : !isOther || customTopic.trim().length > 0;

  function start() {
    if (source === "custom") {
      if (!selectedQuestion) return;
      const problem = cleanProblem(selectedQuestion);
      saveQuestion(problem);
      const id = createSession(
        { topic: problem.topic, difficulty: problem.difficulty, language, voiceId, tone },
        problem,
      );
      router.push(`/interview/${id}`);
      return;
    }
    const id = createSession({
      topic: isOther ? customTopic.trim() : topic,
      difficulty,
      language,
      voiceId,
      tone,
    });
    router.push(`/interview/${id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Mock Technical Interview</h1>
        <p className="mt-2 text-zinc-400">
          Pick a topic and an interviewer. You&apos;ll solve one problem out loud while the
          interviewer listens, asks questions and gives hints when you need them.
        </p>
      </header>

      <div className="space-y-8">
        <div className="inline-flex rounded-lg border border-zinc-800 p-1">
          {(
            [
              ["topic", "Pick a topic"],
              ["custom", "Custom question"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                source === value ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {source === "custom" && (
          <>
            <Section title="Your question">
              {formOpen ? (
                <CustomQuestionForm
                  onFormatted={(problem) => {
                    saveQuestion(problem);
                    setSelectedId(problem.id);
                    setShowForm(false);
                  }}
                  onCancel={customQuestions.length > 0 ? () => setShowForm(false) : undefined}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="w-full rounded-lg border border-dashed border-zinc-700 py-3 text-sm text-zinc-300 hover:border-zinc-500"
                >
                  + Add a new question
                </button>
              )}
            </Section>

            {customQuestions.length > 0 && (
              <Section title="My questions">
                <MyQuestionsList
                  questions={customQuestions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onDelete={(id) => {
                    removeQuestion(id);
                    if (id === selectedId) setSelectedId(null);
                  }}
                />
              </Section>
            )}

            {selectedQuestion && (
              <Section title="Preview and edit">
                <ProblemPreview problem={selectedQuestion} onChange={saveQuestion} />
              </Section>
            )}
          </>
        )}

        {source === "topic" && (
          <>
            <Section title="Topic">
              <div className="flex flex-wrap gap-2">
                {[...TOPICS, "Other"].map((t) => (
                  <Chip key={t} selected={topic === t} onClick={() => setTopic(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
              {isOther && (
                <input
                  autoFocus
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g. bit manipulation, tries, intervals"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              )}
            </Section>

            <Section title="Difficulty">
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Chip key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </Section>
          </>
        )}

        <Section title="Language">
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <Chip key={l} selected={language === l} onClick={() => setLanguage(l)}>
                {LANGUAGE_LABELS[l]}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Interviewer voice">
          <div className="grid gap-2 sm:grid-cols-2">
            {VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoiceId(v.id)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  voiceId === v.id
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <span>
                  <span className="block font-medium">{v.name}</span>
                  <span className="block text-sm text-zinc-400">{v.description}</span>
                </span>
                {/* Voice preview is wired up with ElevenLabs in milestone 3. */}
                <span className="text-xs text-zinc-500" title="Preview coming soon">
                  ▶
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Tone">
          <div className="grid gap-2 sm:grid-cols-3">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  tone === t
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <span className="block font-medium">{t}</span>
                <span className="block text-sm text-zinc-400">{TONE_DESCRIPTIONS[t]}</span>
              </button>
            ))}
          </div>
        </Section>

        <button
          type="button"
          onClick={start}
          disabled={!canStart}
          className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start interview
        </button>
      </div>
    </main>
  );
}
