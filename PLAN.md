# AI Mock Technical Interviewer — Plan (HackRU '26)

## Context
We're building a web app for practicing coding interviews. The candidate:
- picks a topic and difficulty, **or pastes in their own custom question**
- picks an interviewer voice and tone
- solves a problem in a code editor while a voice interviewer talks with them, asks the occasional probing question and gives hints when asked
- gets a scored review at the end

Optional extras: a session recording, and Presage-based feedback on presence and composure.

**Stack:**
- Next.js (App Router) + TypeScript, Tailwind
- **LLM:** Gemini (`@google/genai`, Gemini Flash for low latency)
- **Voice:** ElevenLabs. TTS for the interviewer, Scribe for the candidate's speech-to-text.
- **Mic capture:** `MediaRecorder` in the browser (click to record, click to stop)
- **Editor:** Monaco

**No code execution.** The code is never run. Gemini reads the code and reasons about its correctness, edge cases and complexity, the way a human interviewer does when the candidate traces through examples.

## User flow
1. **Setup page** (`/`)
   - A toggle picks the question source: **Topic** or **Custom question**.
   - *Topic mode:* topic chips (Two Pointers, Sliding Window, DP, Graphs, Binary Search, Trees, Heap, Backtracking, and "Other" with free text) plus a difficulty of Easy, Medium or Hard.
   - *Custom question mode:* paste your own question, or pick one you saved before from "My questions". See [Custom questions](#custom-questions).
   - Language: Python, JS, Java or C++. This only sets the editor syntax highlighting and the starter code.
   - Interviewer: an ElevenLabs voice picker with a preview button, plus a tone of Friendly, Neutral or Tough (FAANG-style).
   - Pressing "Start" asks for mic permission.
2. **Overview**: the interviewer introduces itself, gives an AI overview of the format ("45 min, one problem, think out loud, ask clarifying questions") and then reads the problem.
3. **Interview room** (`/interview/[id]`)
   - Left: problem statement and examples.
   - Center: Monaco editor with a **"I'm done"** button.
   - Right: live transcript, a **mic button** with a status label (ready / recording / thinking / interviewer speaking), an **"Can I get a hint?"** button and a timer.
   - **Click-to-talk:** the first click on the mic button starts recording, and the second click stops it and sends the turn. The mic is off between turns.
4. **Review page** (`/review/[id]`): scorecard, transcript and final code.

## Voice pipeline (click-to-talk)
```
First click  → start recording
Second click → stop recording
  → /api/stt         → show candidate transcript
  → /api/interviewer → show interviewer reply
  → /api/tts         → play interviewer audio
```
- **First click:** `getUserMedia` (with `echoCancellation`, `noiseSuppression` and `autoGainControl` on) plus `MediaRecorder` start capturing. If the interviewer is mid-sentence, stop TTS playback first (barge-in), so clicking the mic is how the candidate interrupts.
- **Second click:** stop the recorder and POST the audio blob (webm/ogg as recorded; no WAV encoding needed) to `/api/stt` (ElevenLabs Scribe). Append the returned text to the transcript as a candidate turn. Ignore recordings under about 300ms or with empty text, so accidental double-clicks don't create turns.
- **Reply:** the turn goes to the `InterjectionController` as a "candidate spoke" event, which always calls `/api/interviewer` for it (a candidate turn is never throttled). If Gemini returns `speak:true`, append the `message` to the transcript and send it to `/api/tts`. Gemini may still return `speak:false` when the candidate is just thinking out loud.
- The mic is released between turns, so there is no echo guard or VAD tuning to do: the interviewer's audio can't be recorded unless the candidate is recording at the same time.
- The mic button is disabled while a turn is being transcribed or answered ("thinking"), so turns can't overlap.

## Core design: throttled interviewer interjections
The interviewer must not nag. A client-side `InterjectionController` decides *when* to call the LLM, and the LLM decides *what* to say.
- **Trigger events:**
  - the candidate finishes a recorded turn (always sent to the interviewer; Gemini answers or stays quiet)
  - a large code change after 60s or more of stable code
  - the candidate says "done" / "I think that's it", or presses "I'm done"
  - no speech or typing for 3 minutes or more (gentle check-in)
- **Throttles:**
  - minimum **90s cooldown** between unsolicited interjections
  - no unsolicited interjection while the candidate is recording or typing. The mic's recording state plus about 8s of typing debounce cover this.
  - at most around 1 unsolicited interjection per 3–4 minutes on average
  - the cooldown and limits apply only to unsolicited interjections (code change, idle). Candidate turns and hint requests always go to Gemini.
- **LLM decision:** each trigger sends `{problem, code snapshot, recent transcript, elapsed time, hints used, tone}` to `/api/interviewer`. Gemini returns JSON `{ speak: boolean, message, kind: "probe"|"answer"|"hint"|"checkin"|"wrapup" }`.
  - Example probes: "Why did you choose a hashmap?", "Is this optimal?", "Are you sure about that edge case?", "Can you walk me through it with this input?"
  - `speak:false` is an expected outcome that lets the candidate keep thinking.
- **Hints (on request, through the button or by asking out loud):** graduated levels.
  1. A nudge with a concrete test input, e.g. "Try tracing it with `nums1=[1,2,3]`, `nums2=[4,5]`."
  2. A conceptual hint, e.g. "What if both pointers start at the ends?"
  3. A near-approach hint.

  Each hint is logged and lowers the score.

## Problem bank
`data/problems/*.json` holds about 4–6 hand-curated problems per topic and difficulty for the demo. Each one has:
- `id`, `title`, `topic`, `difficulty`, `statement` and `examples`
- `starterCode` per language
- `edgeCases`: inputs the LLM uses to mentally check the code and to ask "what about this case?"
- `optimalComplexity`, `keyInsights`, `referenceSolution` and `hintLadder` (seeds for the LLM)

For "Other" or custom topics, Gemini generates a problem in the same schema (`/api/problem/generate`), validated with zod.

## Custom questions
The candidate can bring their own question, for example one from a company's past interviews, a LeetCode problem they're stuck on, or a question a friend asked.
- **Input form** (on the setup page, in Custom question mode):
  - **Required:** the question text, in one big textarea. Pasting a whole LeetCode-style problem (statement, examples and constraints together) is fine.
  - **Optional:** title, difficulty, topic, and the candidate's own examples or known solution.
- **Completing the question:** the "Format with Gemini" button sends the raw text to `/api/problem/parse`, which calls Gemini in JSON mode with a schema built from zod (`lib/gemini.ts`, prompt in `lib/prompts.ts`). Gemini splits it into the `Problem` schema:
  - Taken from the pasted text: statement, examples and constraints.
  - Inferred by Gemini when missing: title, difficulty and topic.
  - Always generated by Gemini: `starterCode` for all 4 languages, `edgeCases`, `optimalComplexity`, `keyInsights`, `referenceSolution` and `hintLadder`.
  - The result is validated with the same zod `ProblemSchema`, so the interviewer, hints and review work exactly as they do for bank problems.
- **Preview before starting:** show the parsed problem in an editable preview card (title, difficulty, topic, statement, examples and constraints). Edits save to My questions as you type. The candidate can fix anything Gemini got wrong before the interview starts. The generated reference solution and hints stay hidden so they don't spoil the question.
- **My questions library:** parsed custom questions are saved in localStorage under `custom-questions` and listed on the setup page, with reuse, edit and delete. Re-using a question skips the Gemini call.
- **Guardrails:**
  - If the text isn't a coding question, or is too vague to solve, Gemini returns `{ ok: false, reason }` and the form shows the reason.
  - Cap the input at about 8k characters.
  - Problems are tagged `source: "custom"`, and the interview room shows "Custom question".

## Scoring and review
`/api/review` sends the full transcript, the code history snapshots, hints used and elapsed time to Gemini with a rubric. It also sends the problem's `referenceSolution` and `edgeCases`, so Gemini can judge correctness without running the code. It returns structured JSON:
- **Scores (1–5):** Problem Solving, Communication, Code Quality, Correctness (by reasoning, with any bugs or missed edge cases listed), Complexity Analysis, plus an overall Hire / Lean Hire / Lean No / No Hire
- strengths, areas to improve and timestamped key moments
- an optimal solution with an explanation

The review page shows a radar chart, the scores and the transcript with highlighted moments.

## Files and structure
```
app/
  page.tsx                      # setup (topic, difficulty, voice, tone)
  interview/[id]/page.tsx       # interview room
  review/[id]/page.tsx          # scorecard
  api/interviewer/route.ts      # Gemini turn: decide speak + message
  api/hint/route.ts             # graduated hint
  api/review/route.ts           # final scoring
  api/problem/generate/route.ts # custom-topic problem generation
  api/problem/parse/route.ts    # custom question text -> full Problem (Gemini + zod)
  api/tts/route.ts              # ElevenLabs TTS proxy (streams audio, hides key)
  api/stt/route.ts              # ElevenLabs Scribe proxy (recorded audio -> text)
components/  CodeEditor, TranscriptPanel, MicButton, HintButton, Timer, VoicePicker, Scorecard,
             CustomQuestionForm, ProblemPreview, MyQuestionsList
lib/
  gemini.ts                     # client + JSON-mode helper
  prompts.ts                    # interviewer persona/tone, hint, review rubric prompts
  interjection.ts               # InterjectionController (triggers + cooldowns)
  voice.ts                      # click-to-talk MediaRecorder, barge-in, TTS playback queue
  session.ts                    # session state (zustand) + localStorage persistence
  customQuestions.ts            # "My questions" store (zustand persist)
  elevenlabs.ts
data/problems/*.json
```
Session state lives on the client (zustand plus localStorage), so no database is needed for the hackathon MVP. Supabase can be added later if we want accounts and history.

## Build order (hackathon milestones)
1. **Skeleton:** Next.js, Tailwind, the setup page, a Monaco room with a static problem. ✅ Done.
2. **Text interviewer:** the Gemini interviewer route and prompts, a typed debug input feeding the transcript, the hint button with the ladder.
3. **Custom questions:** the Topic / Custom toggle, the paste form, `/api/problem/parse`, the editable preview card and the My questions library. ✅ Built (needs a live Gemini test).
4. **Voice:** ElevenLabs TTS for interviewer replies, a voice and tone picker, then the click-to-talk mic button, Scribe STT and barge-in.
5. **Interjection controller:** triggers, cooldowns and `speak:false` handling.
6. **Review:** the scoring route and the scorecard page.
7. **Polish:** intro overview, problem bank fill-out, custom topic generation.
8. **Optional:**
   - *Recording:* `MediaRecorder` captures the screen, mic and webcam. Keep it as a local blob for download/playback on the review page, synced to transcript timestamps.
   - *Presage:* use the Presage SmartSpectra SDK on the webcam stream for vitals and engagement (heart rate, breathing and stress signals). Summarize them into "composure" notes on the review page and feed them as extra context to the review prompt.

## Team split (4 people)
Steps 1 and 3 are done. The remaining work is split so that nobody blocks anyone else: we agree on the interfaces below first, and everyone codes against mocks until the real pieces land.

| Person | Role | Owns |
| --- | --- | --- |
| **A** | Frontend | Every page and component: `app/page.tsx`, `components/*`, the interview room layout and the review page UI |
| **B** | AI interviewer | `/api/interviewer`, `/api/hint`, `lib/prompts.ts` (persona and tone), `lib/interjection.ts` |
| **C** | Voice | `/api/tts`, `/api/stt`, `lib/voice.ts` (click-to-talk recording, Scribe, barge-in, TTS playback queue) |
| **D** | Content, review and ship | Filling out the problem bank, `/api/problem/generate`, `/api/review`, live testing of custom questions, deploy, demo; the optional extras if there's time |

### Interfaces to agree on first (hour 0–1, all 4 people)
Put these types in `lib/types.ts`, and have each owner add a mock that returns fake data, so A can build against them right away.
- **`POST /api/interviewer`** (B)
  - Request: `{ problem, code, transcript, elapsedMs, hintsUsed, tone, trigger }`
  - Response: `{ speak: boolean, message: string, kind: "probe"|"answer"|"hint"|"checkin"|"wrapup"|"intro" }`
- **`POST /api/hint`** (B)
  - Request: `{ problem, code, transcript, hintLevel }`
  - Response: `{ message }`
- **`useVoice({ voiceId, onUtterance })`** (C), a React hook
  - Returns `{ state: MicState, toggleRecording(), speak(text): Promise<void>, stopSpeaking() }`
  - `MicState = "idle" | "recording" | "thinking" | "interviewer"` (in `components/MicButton.tsx`). `toggleRecording()` is the mic button's click handler: the first call starts recording, the second stops it and transcribes. `onUtterance(text)` fires with each transcribed candidate turn.
- **`InterjectionController`** (B)
  - Inputs, one call per event: `onUtterance(text)`, `onCodeChange(code)`, `onHintRequest()`, `onDone()`, `onSpeakingChange(bool)`
  - Output: an `onInterject(message)` callback. The room passes that message to `voice.speak` and appends it to the transcript.
- **`POST /api/review`** (D)
  - Request: the whole `Session`
  - Response: `Scorecard { scores: { problemSolving, communication, codeQuality, correctness, complexity } (1–5), verdict, strengths[], improvements[], keyMoments[{ atMs, note }], bugs[], optimalSolution, explanation }`

### Who does what
**A: Frontend**
- **Interview room:**
  - a typed debug input feeding the transcript, until voice lands
  - a loading state on the hint button
  - the mic button (`components/MicButton.tsx`, already stubbed): pass `useVoice().toggleRecording()` as `onClick` and `useVoice().state` as `state`; it disables itself while "thinking"
  - a mic permission prompt and an error state for when the mic is blocked
  - an "interviewer is thinking…" indicator
- **Intro / overview screen** before the timer starts, with a "Ready" button. It also gives the browser the click it needs before audio can autoplay.
- **Setup page:** voice preview buttons, wired to C's `/api/tts`.
- **Review page:** scorecard, radar chart (Recharts), verdict badge, a transcript with key moments highlighted, and a list of bugs and missed edge cases.
- **Polish:** responsive layout and empty, error and loading states everywhere.

**B: AI interviewer**
- **`/api/interviewer`:**
  - the system prompt per tone (Friendly, Neutral, Tough)
  - rules for when to stay quiet (`speak:false`)
  - answering direct questions without giving the solution away
  - mentally checking the code against `edgeCases` and `referenceSolution`
- **`/api/hint`:** a 3-level ladder seeded from `problem.hintLadder`, adapted to the candidate's current code.
- **`lib/interjection.ts`:**
  - triggers: utterance ended, a big code change after 60s of stable code, the candidate says they're done, 3 minutes idle
  - throttles: a 90s cooldown, no interjection while the candidate types or talks, and direct questions or hints always answered
- **Intro message:** the format overview plus reading the problem aloud.
- **Testing:** a small script that replays fake transcripts through `/api/interviewer`, to tune tone and how often it speaks up.

**C: Voice**
- **`/api/tts`:** ElevenLabs streaming TTS proxy, `{ text, voiceId }` → audio stream. It also serves A's voice previews.
- **`/api/stt`:** ElevenLabs Scribe proxy, recorded audio blob (multipart) → `{ text }`.
- **`lib/voice.ts` / `useVoice`:**
  - click-to-talk: `toggleRecording()` starts `MediaRecorder` on the first click and stops it on the second, releasing the mic
  - drop recordings under about 300ms or with empty transcripts
  - a TTS playback queue
  - barge-in: stop TTS when recording starts
- **Testing:** check on speakers *and* headphones, and in Chrome and Safari (their `MediaRecorder` formats differ, so confirm Scribe accepts both).
- **Latency:** stream TTS so audio starts within about 1s, and measure end-to-end turn latency (second click → first interviewer audio).

**D: Content, review and ship**
- **Problem bank:**
  - at least 2 problems per topic × difficulty (about 48), drafted with Gemini through the custom-question format and **checked by a human** (examples correct, hints escalate)
  - Graphs, Trees, Heap and Backtracking first, since they have none yet
- **`/api/problem/generate`:** generates a problem from the "Other" topic text, reusing `generateJson` and the format prompt from `lib/prompts.ts`.
- **`/api/review`:**
  - the rubric prompt, judging correctness by reasoning against `referenceSolution` and `edgeCases`
  - a hint penalty
  - returns `Scorecard`
- **Testing:** live tests of custom questions once the Gemini key is in (see Verification).
- **Ship:** Vercel deploy with env vars, the README, a demo script, and the Devpost write-up.
- **Stretch:** recording (`MediaRecorder`) and Presage composure notes.

### Timeline (roughly a 24h hackathon)
| Hours | Milestone |
| --- | --- |
| 0–1 | Everyone: agree on the interfaces, commit the types and mocks, and get API keys (Gemini, ElevenLabs) into `.env.local` |
| 1–8 | Parallel build against mocks. B and C test their routes with curl or a scratch page. |
| 8 | **Integration checkpoint 1:** a text interview works end to end (typed input, Gemini replies, hints) |
| 8–14 | C's voice goes into the room, and B's interjection controller gets hooked up. A builds the review page against the mock `Scorecard`. |
| 14 | **Integration checkpoint 2:** a full voice interview through to a real scorecard |
| 14–20 | Tuning (turn latency, how often the interviewer interjects, prompts), problem bank, polish, deploy |
| 20–24 | Feature freeze, bug fixes, demo rehearsal, Devpost |

### Working agreements
- One branch per person (`frontend`, `ai`, `voice`, `content`), with small PRs into `main` and merges at least every few hours.
- Files have owners: only A edits `components/` and page files; the others hand A a hook or route. B and D both touch `lib/prompts.ts`, so give each person their own section in it. Changes to `lib/types.ts` get posted in the team chat first.
- API keys only go in `.env.local` and are never committed.

## Env vars
`GEMINI_API_KEY`, `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`), `ELEVENLABS_API_KEY`, and `PRESAGE_API_KEY` (optional). Put them in `.env.local`; `.env.example` is the template.

## Verification
- `npm run dev`, then go from the setup page into an Easy Two Pointers interview and grant mic permission.
- Confirm the interviewer reads the overview and problem aloud and that the voice and tone change with the selection.
- Click the mic button, ask a clarifying question, click again, and confirm:
  - the button shows "recording" after the first click and "thinking" after the second
  - your words show up in the transcript, then the interviewer's reply, then the reply is played aloud
  - a quick double-click doesn't create an empty turn
- Click the mic while the interviewer is speaking and confirm TTS stops (barge-in).
- Talk through a wrong approach and confirm a probe arrives, with no more than one probe per about 90s while typing continuously.
- Ask "can I get a hint?" out loud and press the Hint button. Confirm the hints escalate, starting with a concrete example input.
- Submit buggy code with "I'm done" and confirm the review flags the bug or missed edge case and shows scores, a hint penalty and key moments.
- Test with "Other: bit manipulation" to verify a generated problem passes zod validation.
- Custom questions:
  - Paste a full LeetCode-style problem. Confirm the preview shows the right title, examples and difficulty, and that you can edit them.
  - Start the interview and confirm the hints and the review use the generated reference solution and edge cases.
  - Confirm the question appears under My questions, and that re-using it starts instantly without a Gemini call.
  - Paste non-question text (e.g. a recipe) and confirm the form shows the rejection reason.
