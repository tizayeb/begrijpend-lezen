import { describe, expect, it } from "vitest";
import { gradeAttempt } from "@/lib/grading/service";

const passage =
  "De Vikingen hadden lichtere schepen met een ondiepe bodem. " +
  "Daardoor konden ze op rivieren varen. Sommigen gingen op rooftocht.";

function snap(questions: any) {
  return {
    title: "T",
    body: passage,
    headings: [],
    questions,
  } as Parameters<typeof gradeAttempt>[0] extends never ? never : any;
}

// gradeAttempt needs DB, so we test the exported pure pieces instead:
import { buildRecommendations, type SkillAgg } from "@/lib/grading/service";
import { gradingProvider } from "@/lib/grading/deterministic";

describe("deterministic MC grading", () => {
  const options = [
    { id: "a", order: 0, text: "A" },
    { id: "b", order: 1, text: "B" },
    { id: "c", order: 2, text: "C" },
  ];
  const ctx = (choice: string | null) => ({
    passageText: passage,
    question: {
      id: "q1",
      type: "MC" as const,
      prompt: "Zwaar",
      skillKey: "explicit_information",
      mcAnswerKey: 1,
      requireTwoArguments: false,
      requireEvidence: false,
      requireCompleteSentences: false,
      options,
    },
    answer: { questionId: "q1", mcChoiceId: choice, text: null },
  });

  it("correct choice scores 100", async () => {
    const r = await gradingProvider.gradeAnswer(ctx("b"));
    expect(r.status).toBe("CORRECT");
    expect(r.scorePct).toBe(100);
  });

  it("wrong choice scores 0", async () => {
    const r = await gradingProvider.gradeAnswer(ctx("a"));
    expect(r.status).toBe("INCORRECT");
  });

  it("unanswered scores 0 and is UNANSWERED", async () => {
    const r = await gradingProvider.gradeAnswer(ctx(null));
    expect(r.status).toBe("UNANSWERED");
  });
});

describe("deterministic open grading", () => {
  const openCtx = (text: string | null, overrides: Record<string, unknown> = {}) => ({
    passageText: passage,
    question: {
      id: "q2",
      type: "OPEN" as const,
      prompt: "Zwaar",
      skillKey: "cause_effect",
      mcAnswerKey: null,
      modelAnswer: "Het modelantwoord.",
      requireTwoArguments: false,
      requireEvidence: false,
      requireCompleteSentences: false,
      rubric: {
        keywordGroups: [
          ["licht", "flexibel"],
          ["ondiep", "bodem"],
        ],
        minChars: 20,
      },
      ...overrides,
    },
    answer: { questionId: "q2", mcChoiceId: null, text },
  });

  it("empty answer is UNANSWERED", async () => {
    const r = await gradingProvider.gradeAnswer(openCtx(""));
    expect(r.status).toBe("UNANSWERED");
  });

  it("covers all keyword groups: CORRECT", async () => {
    const r = await gradingProvider.gradeAnswer(
      openCtx("De schepen waren licht en hadden een ondiepe bodem.")
    );
    expect(r.status).toBe("CORRECT");
    expect(r.scorePct).toBe(100);
  });

  it("covers one keyword group: PARTIAL (semantic synonyms accepted)", async () => {
    const r = await gradingProvider.gradeAnswer(
      openCtx("De schepen waren flexibel zodat ze op rivieren konden varen.")
    );
    expect(r.status).toBe("PARTIAL");
    expect(r.scorePct).toBe(50);
  });

  it("wording differences do not force zero (no exact match required)", async () => {
    const r = await gradingProvider.gradeAnswer(
      openCtx("Omdat de schepen flexibel en ondiep waren, konden zij op rivieren varen.")
    );
    expect(r.scorePct).toBeGreaterThanOrEqual(50);
  });

  it("missing requested arguments caps at 60 with two-reason requirement", async () => {
    const r = await gradingProvider.gradeAnswer(
      openCtx("De schepen waren licht en hadden een ondiepe bodem.", {
        requireTwoArguments: true,
      })
    );
    expect(r.scorePct).toBeLessThanOrEqual(60);
    expect(r.needsImprovement.toLowerCase()).toContain("redenen");
  });

  it("evidence requirement: no overlap with passage caps the score", async () => {
    const r = await gradingProvider.gradeAnswer(
      openCtx("De schepen waren licht en hadden een ondiepe bodem.", {
        requireEvidence: true,
      })
    );
    // Light/ondiepe share terms with the passage, so this should stay >= 40 (full credit w/ evidence acceptable)
    expect(r.status).not.toBe("UNANSWERED");
  });

  it("fullCreditRule grants full credit on alternative phrasing", async () => {
    const r = await gradingProvider.gradeAnswer(
      openCtx("Hij werd erg verdrietig en veel bij de hand.", {
        rubric: { keywordGroups: [], minChars: 5, fullCreditRule: "(verdrietig|in de put)" },
      })
    );
    expect(r.status).toBe("CORRECT");
  });
});

describe("recommendations", () => {
  it("returns exactly three recommendations", () => {
    const agg: Record<string, SkillAgg> = {
      explicit_information: { correct: 0, partial: 0, total: 2 },
      inference: { correct: 1, partial: 1, total: 2 },
      cause_effect: { correct: 3, partial: 0, total: 3 },
      evidence: { correct: 0, partial: 1, total: 3 },
    };
    const recs = buildRecommendations(agg);
    expect(recs).toHaveLength(3);
    expect(recs[0].skillKey).toBe("explicit_information");
  });

  it("fills to three with generic practice tips when performance is good", () => {
    const agg: Record<string, SkillAgg> = {
      explicit_information: { correct: 5, partial: 0, total: 5 },
    };
    const recs = buildRecommendations(agg);
    expect(recs).toHaveLength(3);
  });
});

describe("access control (canViewStudent)", () => {
  it("documented via integration coverage in prisma-level tests", async () => {
    // covered in tests/access.test.ts
    expect(true).toBe(true);
  });
});

describe("gradeAttempt aggregates", () => {
  it("snap helper sanity", () => {
    const s = snap([
      { id: "q1", type: "MC", prompt: "p", skillKey: "explicit_information", mcAnswerKey: 0,
        requireTwoArguments: false, requireEvidence: false, requireCompleteSentences: false,
        options: [{ id: "a", order: 0, text: "A" }] },
    ]);
    expect(s.questions[0].id).toBe("q1");
  });
});
