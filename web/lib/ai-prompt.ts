import type { AttemptSnapshot } from "@/lib/snapshot";

export interface StudentAnswerLite {
  questionId: string;
  mcChoiceId: string | null;
  text: string | null;
}

/**
 * Builds a copy-paste prompt for any external AI: passage + questions + the
 * student's answers + a strict JSON output contract that the app can import
 * back via POST /api/attempts/[id]/ai-evaluations.
 */
export function buildAssessmentPrompt(
  snapshot: AttemptSnapshot,
  answers: StudentAnswerLite[]
): string {
  const mcKey = (q: (typeof snapshot.questions)[number]) =>
    typeof q.mcAnswerKey === "number"
      ? q.options.find((o) => o.order === q.mcAnswerKey)?.text ?? ""
      : "";

  const qa = snapshot.questions
    .map((q, i) => {
      const a = answers.find((x) => x.questionId === q.id);
      const given = q.type === "MC"
        ? q.options.find((o) => o.id === a?.mcChoiceId)?.text ?? "(geen keuze gemaakt)"
        : (a?.text?.trim() || "(geen antwoord gegeven)");
      return [
        `### Vraag ${i + 1}`,
        `questionId: ${q.id}`,
        `type: ${q.type}`,
        `vaardigheid: ${q.skillKey}`,
        `vraag: ${q.prompt}`,
        q.type === "MC" ? `antwoordopties: ${q.options.map((o) => o.text).join(" | ")}` : "",
        q.type === "MC" ? `juiste antwoord (intern, niet aan leerling tonen): ${mcKey(q)}` : "",
        q.type === "OPEN" ? `voorbeeldantwoord van de maker: ${q.modelAnswer ?? "(geen)"}` : "",
        q.type === "OPEN" ? `eisen: ${[
          q.requireCompleteSentences ? "hele zinnen" : null,
          q.requireTwoArguments ? "twee redenen" : null,
          q.requireEvidence ? "bewijs uit de tekst" : null,
        ].filter(Boolean).join(", ") || "geen specifieke eisen"}` : "",
        `antwoord leerling: ${given}`,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  return `Je bent een ervaren Nederlands-docent die begrijpend-lezen-toetsen nakijkt voor groep 7/8 (10-12 jaar).

Beoordeel hieronder ELKE vraag van de leerling. Regels:
- Antwoorden die semantisch kloppen maar anders geformuleerd zijn, zijn GOED. Vergelijk nooit letterlijk met het voorbeeldantwoord.
- Geef deelfouten erkenning (status PARTIAL met een passend percentage).
- Als een omweg of alternatieve interpretatie door de tekst wordt ondersteund, accepteer die.
- Schrijf uitleg in begrijpelijk Nederlands voor een kind van 11 jaar, kort en concreet.
- Oordeel bij meningsvragen alleen over de kwaliteit en onderbouwing van het argument, niet over de meningsinhoud.
- Verzin geen informatie die niet in de tekst staat. Wees bij twijfel mild en vermeld de onduidelijkheid in "explanation".

Geef uitsluitend JSON terug (geen andere tekst), volgens exact dit schema:
[
  {
    "questionId": "<kopieer de questionId exact>",
    "status": "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED",
    "scorePct": <heel getal 0-100>,
    "explanation": "<korte uitleg voor de leerling>",
    "didWell": "<wat de leerling goed deed, kort of '-'>",
    "needsImprovement": "<wat er moet verbeteren, kort of '-'>",
    "exampleAnswer": "<een sterk voorbeeldantwoord>"
  }
]

Regels voor output: elke vraag exact één keer; statuses uitsluitend uit de vier toegestane waarden; scorePct consistent met status (CORRECT >= 95, PARTIAL 40-94, INCORRECT 1-39 of 0, UNANSWERED 0).

=== TEKST VAN DE OEFENING ===
Titel: ${snapshot.title}

${snapshot.body}

=== VRAGEN EN ANTWOORDEN VAN DE LEERLING ===

${qa}`;
}
