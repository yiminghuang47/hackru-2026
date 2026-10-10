import { TOPICS } from "./types";

export const FORMAT_QUESTION_SYSTEM = `You turn a candidate's rough coding interview question into a complete, well-formatted problem for a mock technical interview.

Decide first whether the text is a solvable coding / algorithms question.
- If it is not (e.g. a recipe, a chat message, a system-design-only prompt) or it is too vague to solve, set ok=false, explain why in "reason" in one friendly sentence, and omit "problem".
- Otherwise set ok=true, reason="", and fill in "problem".

Rules for "problem":
- statement: keep the candidate's meaning and wording where possible. Clean up grammar and formatting, but do not change what is being asked. Do not include examples or constraints in the statement.
- title: short, Title Case. Use the candidate's title if given.
- difficulty: Easy, Medium or Hard. Use the candidate's choice if given, otherwise judge it by typical interview standards.
- topic: the main technique. Prefer one of: ${TOPICS.join(", ")}. Use another short label only if none fit. Use the candidate's topic if given.
- examples: keep any examples from the text, verbatim in meaning. If there are fewer than 2, add your own until there are 2-3. Every output must be correct. Use the format 'nums = [1,2,3], target = 4' for inputs.
- constraints: keep any given; otherwise add sensible ones (input sizes, value ranges).
- starterCode: an empty function or class stub for each language (python, javascript, java, cpp) with the same name and parameters, typed where the language allows. Bodies are empty (python uses "pass"). No solution code.
- edgeCases: 3-6 short, specific inputs that commonly break solutions, each with a few words on why.
- optimalComplexity: the best known time and space complexity.
- keyInsights: 2-3 short bullets with the core ideas behind the optimal solution.
- referenceSolution: a correct, optimal Python solution. If the candidate supplied a solution, base it on theirs and fix any bugs.
- hintLadder: exactly 3 hints that escalate without giving the full answer away:
  1. a nudge built on a concrete input to trace, e.g. "Try tracing your approach on nums = [2,1,1,2]."
  2. a conceptual hint about the key idea.
  3. a near-approach hint that outlines the algorithm in one or two sentences.`;

export function formatQuestionPrompt(input: {
  text: string;
  title?: string;
  difficulty?: string;
  topic?: string;
}) {
  const extras = [
    input.title && `Title: ${input.title}`,
    input.difficulty && `Difficulty: ${input.difficulty}`,
    input.topic && `Topic: ${input.topic}`,
  ].filter(Boolean);

  return [
    extras.length ? `The candidate specified:\n${extras.join("\n")}\n` : "",
    "Question text from the candidate:",
    "<question>",
    input.text,
    "</question>",
  ].join("\n");
}
