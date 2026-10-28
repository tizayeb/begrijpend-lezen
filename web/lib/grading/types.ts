export interface RubricData {
  keywordGroups: string[][]; // each group: synonyms that all express one required point
  minChars: number;
  fullCreditRule?: string | null; // regex alternation; match => full credit
}

export interface QuestionData {
  id: string;
  type: "MC" | "OPEN";
  prompt: string;
  skillKey: string;
  mcAnswerKey?: number | null;
  modelAnswer?: string | null;
  requireTwoArguments: boolean;
  requireEvidence: boolean;
  requireCompleteSentences: boolean;
  rubric?: RubricData | null;
  options?: { id: string; order: number; text: string }[];
}

export interface StudentAnswerInput {
  questionId: string;
  mcChoiceId?: string | null;
  text?: string | null;
}

export interface EvalResult {
  status: "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED";
  scorePct: number;
  explanation: string;
  didWell: string;
  needsImprovement: string;
  exampleAnswer: string;
}

export interface GradingContext {
  passageText: string;
  question: QuestionData;
  answer: StudentAnswerInput;
}

/** Contract for grading implementations; swap the deterministic provider for an AI one. */
export interface GradingProvider {
  gradeAnswer(ctx: GradingContext): Promise<EvalResult>;
}
