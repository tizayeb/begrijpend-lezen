export type SkillKey =
  | "explicit_information"
  | "inference"
  | "cause_effect"
  | "main_idea"
  | "complete_answers"
  | "evidence"
  | "number_of_arguments"
  | "vocabulary"
  | "facts_vs_opinions";

export const SKILL_SEED: { key: SkillKey; label: string; description: string }[] = [
  { key: "explicit_information", label: "Letterlijke informatie", description: "Informatie die in de tekst staat, opzoeken." },
  { key: "inference", label: "Infereren", description: "Iets afleiden dat niet letterlijk in de tekst staat." },
  { key: "cause_effect", label: "Oorzaak en gevolg", description: "Verbanden tussen gebeurtenissen begrijpen." },
  { key: "main_idea", label: "Kern en samenvatting", description: "De hoofdboodschap van elke alinea vat je samen." },
  { key: "complete_answers", label: "Volledige antwoorden", description: "In hele zinnen en volledig antwoorden." },
  { key: "evidence", label: "Bewijs uit de tekst", description: "Zinnen uit de tekst als onderbouwing gebruiken." },
  { key: "number_of_arguments", label: "Aantal argumenten", description: "Het gevraagde aantal redenen leveren." },
  { key: "vocabulary", label: "Woordenschat in context", description: "Moeilijke woorden betekenis geven uit de zin." },
  { key: "facts_vs_opinions", label: "Feit versus mening", description: "Onderscheiden wat waar is en wat iemand vindt." },
];

export const RECOMMENDATION_MAP: Record<SkillKey, string> = {
  main_idea:
    "Oefen met samenvatten: zeg na elke alinea in één zin wat het belangrijkste is dat er staat.",
  evidence:
    "Onderbouw je antwoorden met de tekst: noem de woorden of de zin uit de tekst die laten zien dat je antwoord klopt.",
  complete_answers:
    "Schrijf je antwoorden in hele zinnen en gebruik 'omdat' en 'daarom' om je antwoord uit te leggen.",
  inference:
    "Oefen met afleiden: als iets niet letterlijk in de tekst staat, noem dan welke hint in de tekst je aan je antwoord helpt.",
  cause_effect:
    "Oefen met oorzaak en gevolg: zoek eerst de oorzaak en voltooi je zin met 'omdat' of 'daardoor'.",
  facts_vs_opinions:
    "Oefen met feiten en meningen: controleer of een bewering in de tekst staat (feit) of dat het de mening van iemand is.",
  vocabulary:
    "Oefen met moeilijke woorden: bedenk de betekenis door goed naar de rest van de zin te lezen.",
  explicit_information:
    "Oefen met letterlijk lezen: zoek exact de informatie in de tekst die de vraag noemt.",
  number_of_arguments:
    "Tel vooraf hoeveel redenen de vraag vraagt en controleer vóór het inleveren of ze er allebei staan.",
};

export const SKILL_KEY_BY_ID = new Map<string, SkillKey>(SKILL_SEED.map((s) => [s.key, s.key]));
