import type { EvalResult, GradingContext, GradingProvider } from "./types";

const ARGUMENT_CONNECTIVES = ["omdat", "daarom", "want", "door dat", "doordat", "hierdoor"];

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-zà-ÿ\s'-]/gi, " ").replace(/\s+/g, " ").trim();
}

function countArguments(text: string): number {
  const lowered = norm(text);
  let connectives = 0;
  for (const c of ARGUMENT_CONNECTIVES) {
    connectives += (lowered.match(new RegExp(`\\b${c}\\b`, "g")) || []).length;
  }
  // Argument units = explicit connectives, min one if the answer is substantial.
  const sentences = text.split(/[.!?]\s/).filter((s) => s.trim().length > 15).length;
  return Math.max(connectives, text.trim().length > 60 ? 1 : 0) === 0
    ? (sentences >= 2 ? 2 : Math.min(sentences, 1))
    : Math.min(Math.max(connectives, sentences), 2);
}

function hasEvidence(text: string, passageText: string): boolean {
  // Loose proxy: shares a distinctive multiword phrase or a key term with the passage.
  const normAns = norm(text);
  const normPass = norm(passageText);
  if (normAns.length < 8) return false;
  const words = normAns.split(" ").filter((w) => w.length > 4);
  const distinct = words.filter((w) => normPass.includes(w));
  return distinct.length >= 2;
}

function evalStatus(scorePct: number): EvalResult["status"] {
  if (scorePct >= 95) return "CORRECT";
  if (scorePct >= 40) return "PARTIAL";
  return "INCORRECT";
}

function openEnded(ctx: GradingContext): EvalResult {
  const { question, answer, passageText } = ctx;
  const text = (answer.text || "").trim();
  const rubric = question.rubric;
  if (!text) {
    return {
      status: "UNANSWERED",
      scorePct: 0,
      explanation: "Je hebt deze vraag overgeslagen.",
      didWell: "-",
      needsImprovement: "Probeer elke vraag te beantwoorden, ook als je twijfelt.",
      exampleAnswer: question.modelAnswer || "",
    };
  }
  if (text.length < (rubric?.minChars ?? 10)) {
    return {
      status: "INCORRECT",
      scorePct: 10,
      explanation:
        "Je antwoord is erg kort. Schrijf in hele zinnen wat je bedoelt, met de vraag als leidraad.",
      didWell: "Je hebt de vraag geprobeerd.",
      needsImprovement: "Antwoord vollediger in meerdere zinnen.",
      exampleAnswer: question.modelAnswer || "",
    };
  }

  const groups = rubric?.keywordGroups ?? [];
  const covered = groups.map((syn) => syn.some((k) => norm(text).includes(norm(k))));
  const matched = covered.filter(Boolean).length;

  // Full credit rule overrides keyword scoring (used for fact-style questions).
  if (rubric?.fullCreditRule) {
    try {
      if (new RegExp(rubric.fullCreditRule, "i").test(norm(text))) {
        return finish(text, question, 100, [], passageText, covered);
      }
    } catch {
      // invalid admin regex: ignore and fall through to keyword scoring
    }
  }

  let base = groups.length === 0 ? (text.length >= 80 ? 70 : 40) : (matched / groups.length) * 100;

  const issues: string[] = [];
  if (question.requireTwoArguments && countArguments(text) < 2) {
    base = Math.min(base, 60);
    issues.push("Je moest twee redenen geven; er staan er te weinig.");
  }
  if (question.requireEvidence && !hasEvidence(text, passageText)) {
    base = Math.min(base, 60);
    issues.push("Gebruik woorden en voorbeelden uit de tekst om je antwoord te onderbouwen.");
  }
  if (!covered.every(Boolean) && groups.length > 0) {
    const missedIdx = covered.findIndex((c) => !c);
    if (missedIdx >= 0) {
      issues.push(`Belangrijk geef je niet: iets als '${groups[missedIdx][0]}'.`);
    }
  }

  // Ambiguity guard: mid-range scores get a review-style explanation, not silent failure.
  return finish(text, question, Math.round(base), issues, passageText, covered);
}

function finish(
  text: string,
  question: GradingContext["question"],
  scorePct: number,
  issues: string[],
  passageText: string,
  covered: boolean[]
): EvalResult {
  const status = evalStatus(scorePct);
  const parts = Math.max(covered.filter(Boolean).length, question.requireTwoArguments ? 2 : 1);
  const didWell =
    scorePct >= 95
      ? "Je antwoord dekt alle belangrijke punten."
      : covered.filter(Boolean).length > 0
        ? `Je noemt ${Math.min(covered.filter(Boolean).length, parts)} van de ${parts} kernpunt(en).`
        : "Je hebt een eigen antwoord geschreven.";
  let explanation;
  if (status === "CORRECT") explanation = "Goed antwoord. ";
  else if (status === "PARTIAL") explanation = "Je antwoord is deels goed. ";
  else explanation = "Dit antwoord slaat nog niet op de kern van de vraag. ";
  explanation += issues.join(" ");
  const needsImprovement = issues.length
    ? issues.join(" ")
    : "Zorg dat je antwoord alles dekt wat de vraag vraagt.";
  const sentenceTip =
    question.requireCompleteSentences && !/^[A-ZÀ-Þ]/.test(text.trim())
      ? " Begin je antwoord met een grote letter."
      : "";
  return {
    status,
    scorePct,
    explanation: explanation + sentenceTip,
    didWell,
    needsImprovement,
    exampleAnswer: question.modelAnswer || `Zoek een bewijs in de tekst: ${passageText.slice(0, 80)}...`,
  };
}

class DeterministicProvider implements GradingProvider {
  async gradeAnswer(ctx: GradingContext): Promise<EvalResult> {
    const { question, answer } = ctx;
    if (question.type === "MC") {
      if (!answer.mcChoiceId) {
        return {
          status: "UNANSWERED",
          scorePct: 0,
          explanation: "Je hebt geen keuze gemaakt.",
          didWell: "-",
          needsImprovement: "Lees de vraag zorgvuldig en kies het beste antwoord.",
          exampleAnswer: "",
        };
      }
      const options = ctx.question.options ?? [];
      const chosen = options.find((o) => o.id === answer.mcChoiceId);
      const chosenIdx = chosen ? chosen.order : -1;
      if (chosenIdx === question.mcAnswerKey) {
        return {
          status: "CORRECT",
          scorePct: 100,
          explanation: "Dit is de juiste keuze.",
          didWell: "Je hebt de tekst goed begrepen.",
          needsImprovement: "-",
          exampleAnswer: "",
        };
      }
      return {
        status: "INCORRECT",
        scorePct: 0,
        explanation: "Dit was niet de juiste keuze.",
        didWell: "-",
        needsImprovement: "Kijk in de tekst terug tussen de vraag en het juiste antwoord.",
        exampleAnswer: `Het juiste antwoord was optie ${options.find((o) => o.order === question.mcAnswerKey)?.text ?? "-"}.`,
      };
    }

    const r = openEnded(ctx);
    if (r.status !== "UNANSWERED") {
      // QuestionData as MC has options field; add middle ground: expose chosen/MC text in example for OPEN questions.
      if (question.modelAnswer) r.exampleAnswer = question.modelAnswer;
    }
    return r;
  }
}

export const gradingProvider: GradingProvider = new DeterministicProvider();
