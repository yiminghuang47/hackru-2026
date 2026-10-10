"use client";

import { useMemo, useState } from "react";
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
import { OptionTile } from "./OptionTile";
import { ScrollRail, type RailSection } from "./ScrollRail";
import { StepSection } from "./StepSection";
import { SummaryBar } from "./SummaryBar";

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

const SOURCES: { value: Source; label: string; description: string }[] = [
  { value: "topic", label: "Pick a topic", description: "We choose the problem" },
  { value: "custom", label: "Custom question", description: "Bring your own" },
];

export function SetupForm() {
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

  // Step numbers and the scroll rail follow whichever steps are on screen.
  const steps = useMemo(
    () => [
      { id: "source", label: "Mode" },
      ...(source === "topic"
        ? [
            { id: "topic", label: "Topic" },
            { id: "difficulty", label: "Level" },
          ]
        : [{ id: "question", label: "Question" }]),
      { id: "language", label: "Language" },
      { id: "voice", label: "Voice" },
      { id: "tone", label: "Tone" },
    ],
    [source],
  );
  const railSections: RailSection[] = [{ id: "top", label: "Intro" }, ...steps];
  const n = (id: string) => steps.findIndex((s) => s.id === id) + 1;

  const summary =
    source === "custom"
      ? [selectedQuestion?.title ?? "No question yet"]
      : [isOther ? customTopic.trim() || "Other" : topic, difficulty];
  summary.push(
    LANGUAGE_LABELS[language],
    VOICES.find((v) => v.id === voiceId)?.name ?? "",
    tone,
  );

  return (
    <div id="setup" className="scroll-mt-4">
      <ScrollRail sections={railSections} />

      <StepSection id="source" index={n("source")} title="Mode" hint="Where should the problem come from?">
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <OptionTile
              key={s.value}
              selected={source === s.value}
              onClick={() => setSource(s.value)}
              title={s.label}
              description={s.description}
            />
          ))}
        </div>
      </StepSection>

      {source === "topic" ? (
        <>
          <StepSection id="topic" index={n("topic")} title="Topic" hint="What do you want to drill?">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {[...TOPICS, "Other"].map((t) => (
                <OptionTile key={t} selected={topic === t} onClick={() => setTopic(t)} title={t} />
              ))}
            </div>
            {isOther && (
              <input
                autoFocus
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. bit manipulation, tries, intervals"
                aria-label="Custom topic"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-accent"
              />
            )}
          </StepSection>

          <StepSection id="difficulty" index={n("difficulty")} title="Level" hint="How hard should it push?">
            <div className="grid gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map((d) => (
                <OptionTile
                  key={d}
                  selected={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  title={d}
                />
              ))}
            </div>
          </StepSection>
        </>
      ) : (
        <StepSection id="question" index={n("question")} title="Question" hint="Paste one, or reuse a saved one.">
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
              className="w-full rounded-xl border border-dashed border-zinc-700 py-4 text-zinc-300 transition-colors hover:border-accent hover:text-accent"
            >
              + Add a new question
            </button>
          )}

          {customQuestions.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                My questions
              </h3>
              <MyQuestionsList
                questions={customQuestions}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={(id) => {
                  removeQuestion(id);
                  if (id === selectedId) setSelectedId(null);
                }}
              />
            </div>
          )}

          {selectedQuestion && (
            <div className="space-y-3 pt-4">
              <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                Preview and edit
              </h3>
              <ProblemPreview problem={selectedQuestion} onChange={saveQuestion} />
            </div>
          )}
        </StepSection>
      )}

      <StepSection id="language" index={n("language")} title="Language" hint="Sets the editor and starter code.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LANGUAGES.map((l) => (
            <OptionTile
              key={l}
              selected={language === l}
              onClick={() => setLanguage(l)}
              title={LANGUAGE_LABELS[l]}
            />
          ))}
        </div>
      </StepSection>

      <StepSection id="voice" index={n("voice")} title="Voice" hint="Who&apos;s sitting across from you?">
        <div className="grid gap-3 sm:grid-cols-2">
          {VOICES.map((v) => (
            <OptionTile
              key={v.id}
              selected={voiceId === v.id}
              onClick={() => setVoiceId(v.id)}
              title={v.name}
              description={v.description}
              // Voice preview is wired up with ElevenLabs in milestone 3.
              trailing={
                <span className="mt-1 text-xs opacity-60" title="Preview coming soon">
                  ▶
                </span>
              }
            />
          ))}
        </div>
      </StepSection>

      <StepSection id="tone" index={n("tone")} title="Tone" hint="How they treat you.">
        <div className="grid gap-3 sm:grid-cols-3">
          {TONES.map((t) => (
            <OptionTile
              key={t}
              selected={tone === t}
              onClick={() => setTone(t)}
              title={t}
              description={TONE_DESCRIPTIONS[t]}
            />
          ))}
        </div>
      </StepSection>

      {/* Room for the floating bar below the last step. */}
      <div className="h-32" />
      <SummaryBar items={summary} canStart={canStart} onStart={start} />
    </div>
  );
}
