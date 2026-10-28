import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SKILLS = [
  { key: "explicit_information", label: "Letterlijke informatie", description: "Informatie die in de tekst staat, opzoeken." },
  { key: "inference", label: "Infereren", description: "Iets afleiden dat niet letterlijk in de tekst staat." },
  { key: "cause_effect", label: "Oorzaak en gevolg", description: "Verbanden tussen gebeurtenissen begrijpen." },
  { key: "main_idea", label: "Kern en samenvatting", description: "De hoofdboodschap van de tekst of alinea aangeven." },
  { key: "complete_answers", label: "Volledige antwoorden", description: "In hele zinnen en volledig antwoorden." },
  { key: "evidence", label: "Bewijs uit de tekst", description: "Zinnen uit de tekst als onderbouwing gebruiken." },
  { key: "number_of_arguments", label: "Aantal argumenten", description: "Het gevraagde aantal redenen geven." },
  { key: "vocabulary", label: "Woordenschat in context", description: "Moeilijke woorden betekenis geven door de zin." },
  { key: "facts_vs_opinions", label: "Feit versus mening", description: "Onderscheiden wat bekend is en wat iemand vindt." },
];

/* ---------------- Passage 1: De broers Van Gogh ---------------- */

const GOGH_BODY = `## De broers Van Gogh

Wie denkt aan Vincent van Gogh, denkt aan beroemde schilderijen zoals De sterrennacht en Zonnebloemen. Toch is er misschien wel een persoon die net zo belangrijk was voor het parcours van Vincent: zijn jongere broer Theo.

Vincent werd in 1853 geboren in het Brabantse dorpje Zundert. Hij was het oudste kind van een protestantse familie met zes kinderen. Na zijn schooltijd werkte hij eerst bij een kunsthandel, werd later onderwijzer en zelfs hulpprediker in het arme Borinage, een mijnstreek in België. Pas toen hij 27 jaar oud was, besloot Vincent om kunstschilder te worden. Zijn familie vond dat geen verstandig plan: schilders verdienen meestal weinig geld, en Vincent had nog nooit een tekenles gehad.

Maar één iemand geloofde fel in Vincent: zijn broer Theo. Theo werkte in Parijs, bij dezelfde kunsthandel waar Vincent vroeger had gewerkt. Jarenlang stuurde Theo elke maand geld naar Vincent, terwijl Vincent eigenlijk niks terug kon betalen. Samen was het goed voor ongeveer 700 brieven, die ze de hele wereld over stuurden. In die brieven spraken ze niet alleen over geld, maar ook over kunst, over kleur en over de zware periode van Vincent in de Arles, toen hijzelf zich angstig en ziek voelde.

Vincent heeft het niet makkelijk gehad. In tien jaar schilderde hij ruim 850 schilderijen, maar hij verkocht er waarschijnlijk maar één: De rode wijngaard. Op 37-jarige leeftijd stierf Vincent in 1890, twee dagen nadat hij zichzelf een verwonding had toegebracht. Na de dood van Vincent raakte Theo diep in de put. Hij overleed slechts zes maanden later.

Of Vincent zonder Theo ooit beroemd was geworden, is iets waar historici tot op de dag van vandaag over discussiëren. Zeker is wel dat Theo na de dood van Vincent hard heeft gewerkt om de schilderijen van zijn broer bekend te maken bij het publiek. Zonder die inspanning had de wereld misschien nooit kennisgemaakt met De sterrennacht.`;

const GOGH_QUESTIONS = [
  {
    type: "MC" as const,
    prompt: "Waarom vond Vincents familie het geen verstandig plan dat hij kunstschilder wilde worden?",
    skill: "explicit_information",
    mcAnswerKey: 2,
    options: [
      "Omdat Vincent te jong was om te schilderen.",
      "Omdat de familie hem wilde laten werken in de kunsthandel.",
      "Omdat schilders weinig geld verdienen en Vincent geen tekenles had gehad.",
      "Omdat Vincent wilde verhuizen naar België.",
    ],
    modelAnswer: "Schilders verdienen meestal weinig geld en Vincent had nog nooit een tekenles gehad.",
    rubric: null,
  },
  {
    type: "MC" as const,
    prompt: "Wat betekent 'diep in de put raken' in deze tekst?",
    skill: "vocabulary",
    mcAnswerKey: 1,
    options: [
      "Dat Theo in een diepe put viel.",
      "Dat Theo zo verdrietig was dat het heel lang duurde om beter te worden.",
      "Dat Theo geld moest opnemen van de bank.",
      "Dat Theo het schilderswerk weer opvatte.",
    ],
    modelAnswer: "Het betekent dat Theo heel somber en verdrietig werd.",
    rubric: null,
  },
  {
    type: "OPEN" as const,
    prompt: "Wat was de rol van Theo in het leven van Vincent? Geef twee redenen waarom Theo belangrijk was voor Vincent. Antwoord in hele zinnen.",
    skill: "number_of_arguments",
    mcAnswerKey: null,
    requireTwoArguments: true,
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Theo gaf elke maand geld aan Vincent, terwijl Vincent bijna niks verkocht. Daarnaast geloofde Theo in het talent van Vincent en maakte hij na de dood van Vincent de schilderijen beroemd.",
    rubric: {
      keywordGroups: [
        ["geld", "financieel", "support", "month"],
        ["geloofde", "vertrouwen", "beroemd", "kennisgemaakt", "bekend"],
      ],
      minChars: 30,
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Van hoe oud tot hoe oud heeft Vincent geschilderd? Leg uit hoe je dat uit de tekst haalt.",
    skill: "inference",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Vincent begon op 27-jarige leeftijd met schilderen en stierf op 37-jarige leeftijd in 1890. Dus hij schilderde ongeveer tien jaar, van 27 tot 37.",
    rubric: {
      keywordGroups: [["27"], ["37", "tien jaar", "10 jaar"]],
      minChars: 20,
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Volgens de tekst is het niet zeker of Vincent zonder Theo beroemd was geworden. Wat vind jij? Geef jouw mening en gebruik twee argumenten, waarvan er minimaal één uit de tekst moet komen.",
    skill: "facts_vs_opinions",
    requireTwoArguments: true,
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Ik denk dat Vincent zonder Theo misschien wel beroemd was geworden, want hij schilderde heel bijzondere dingen. Maar het was mogelijk niet zo snel gegaan, omdat Theo hem financieel hielp en na zijn dood zijn werk bekend maakte.",
    rubric: {
      keywordGroups: [["omdat", "want", "daarom"], []],
      minChars: 40,
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Welk gevolg had de dood van Vincent voor Theo? Antwoord in een volledige zin met 'hierdoor' of 'waardoor'.",
    skill: "cause_effect",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Door de dood van Vincent raakte Theo diep in de put; hij overleed slechts zes maanden later.",
    rubric: {
      keywordGroups: [["in de put", "verdrietig", "somber", "gedeprimeerd", "overleed"]],
      minChars: 20,
      fullCreditRule: "(verdrietige|in de put|overleed|somber)",
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Beschrijf in eigen woorden wat de briefwisseling tussen Vincent en Theo heeft gedaan voor Vincent. Noem ook één detail uit de tekst.",
    skill: "main_idea",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "De brieven (in totaal ongeveer 700) gaven steun en advies over kunst en kleur, zelfs toen Vincent zich ziek en angstig voelde in Arles.",
    rubric: {
      keywordGroups: [["700", "brieven"], ["kunst", "kleur", "geld", "steun"]],
      minChars: 30,
    },
  },
  {
    type: "MC" as const,
    prompt: "Hoeveel schilderijen verkocht Vincent naar alle waarschijnlijkheid tijdens zijn leven?",
    skill: "explicit_information",
    mcAnswerKey: 1,
    options: [
      "850 schilderijen.",
      "Waarschijnlijk maar één: De rode wijngaard.",
      "Zevenhonderd.",
      "De tekst zegt dit niet precies.",
    ],
    modelAnswer: "Waarschijnlijk maar één schilderij, De rode wijngaard.",
    rubric: null,
  },
  {
    type: "OPEN" as const,
    prompt: "Waarom staat er 'waarschijnlijk maar één' in de tekst? Wat vertelt dat woord ons over het uitzicht van de schrijvers?",
    skill: "facts_vs_opinions",
    requireCompleteSentences: true,
    modelAnswer:
      "Het woord 'waarschijnlijk' toont dat het niet 100% zeker is dat er echt maar één schilderij werd verkocht.",
    rubric: {
      keywordGroups: [["waarschijnlijk", "niet zeker", "onbekend", "aanname"]],
      minChars: 15,
    },
  },
  {
    type: "OPEN" as const,
    prompt:
      "Leg uit waarom Theo en Vincent elkaar brieven stuurden terwijl Theo in Parijs werkte. Gebruik minstens één woord uit de tekst.",
    skill: "evidence",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Theo woonde in Parijs en Vincent reisde door Nederland, België en Frankrijk. De brieven waren voor contact, steun, geld en adviezen over kunst.",
    rubric: {
      keywordGroups: [["parijs"], ["steun", "geld", "advies", "contact"]],
      minChars: 25,
    },
  },
];

/* ---------------- Passage 2: De Vikings: mythe en werkelijkheid ---------------- */

const VIKING_BODY = `## De Vikingen: mythe en werkelijkheid

Als je aan Vikingen denkt, zie je misschien wilde mannen met helmen en zwaarden op jacht naar buit. Dat beeld komt vooral uit films en strips. Maar hoeveel klopt daar eigenlijk van?

Vikingen waren Noorse, Zweedse en Deense zeelieden die tussen ongeveer 800 en 1050 op reis gingen. Sommigen gingen op rooftocht. Anderen waren handelaars, boeren of ontdekkingsreizigers. Archeologen hebben in Scandinavië boerderijen en dorpen gevonden waar duidelijk gewone families woonden. Die gemengde groep die op reis ging, kwam aan wal met schepen die twintig tot dertig roeiers vervoerden. Eén ding is zeker: Vikingen droegen géén gehoornde helmen, zoals de films vaak laten zien. Die helmen kwamen pas honderd jaar later op het toneel, in operapakken en op schilderijen.

Vikingen waren ook goede scheepsbouwers. Hun langschepen waren licht, flexibel en ze hadden een ondiepe bodem. Daardoor konden ze op grote zeeën varen én op ondiepe rivieren. Dat is een van de redenen dat Scandinavische handelaars tot in alltals verre landen zoals Byzantium en Bagdad kwamen, vaak reizen maanden of zelfs jaren duurden.

Er zijn ook verhalen over Vikingen die we niet kunnen bewijzen, zoals dat ze elkaar in feestzalen lieten wegdraaien van drank. Dergelijke verhalen komen uit gedichten die lang na de tijd van de Vikingen opgeschreven zijn. Historici noemen ze daarom geen feiten, maar mythes: verhalen die iets vertellen over hoe mensen zich Vikingen voorstelden, maar niet over wat Vikingen echt deden.`;

const VIKING_QUESTIONS = [
  {
    type: "MC" as const,
    prompt: "Waar kwamen de gehoornde helmen vandaan die nu vaak met Vikingen verbonden worden?",
    skill: "explicit_information",
    mcAnswerKey: 2,
    options: [
      "Van echte Vikinghelmen die aan wal gevonden zijn.",
      "Van gedichten die lang na de Vikingtijd werden opgeschreven.",
      "Van operapakken en schilderijen van honderd jaar na de Vikingtijd.",
      "Van engelse archeologen.",
    ],
    modelAnswer: "Operapakken en schilderijen van lang na de Vikingtijd.",
    rubric: null,
  },
  {
    type: "OPEN" as const,
    prompt: "Leg uit waarom Vikingen tot in verre landen zoals Byzantium en Bagdad konden komen. Antwoord in hele zinnen.",
    skill: "cause_effect",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Hun langschepen waren licht, flexibel en hadden een ondiepe bodem. Daardoor konden ze op zee én op rivieren varen.",
    rubric: {
      keywordGroups: [["licht", "flexibel", "ondiepe bodem", "ondiep"], ["zee", "rivier"]],
      minChars: 30,
    },
  },
  {
    type: "OPEN" as const,
    prompt:
      "Waarom zijn verhalen over Vikingen die dronken in feestzalen wegdraaien geen feiten volgens de tekst? Geef één reden uit de tekst.",
    skill: "facts_vs_opinions",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Die verhalen komen uit gedichten die lang na de tijd van de Vikingen zijn opgeschreven, dus ze zijn geen zeker bewijs.",
    rubric: {
      keywordGroups: [["gedichten", "lang na", "na opgeschreven", "niet bewijzen", "mythes"]],
      minChars: 25,
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Zet de volgende drie groepen Vikingen op de juiste plek: rooftochtrijder, handelaar, boer. Wat elke groep deed, leg je uit in één regel per soort.",
    skill: "main_idea",
    requireCompleteSentences: true,
    modelAnswer:
      "Sommigen gingen op rooftocht, anderen handelden (Byzantium, Bagdad) en weer anderen werkten als boeren in Scandinavische dorpen.",
    rubric: {
      keywordGroups: [["rooftocht"], ["handel", "handelaar"], ["boer", "boerderij", "dorpen"]],
      minChars: 40,
    },
  },
  {
    type: "MC" as const,
    prompt: "Hoeveel roeiers konden de langschepen vervoeren?",
    skill: "explicit_information",
    mcAnswerKey: 1,
    options: [
      "Precies twintig roeiers.",
      "Tachtig tot vijfenveertig roeiers.",
      "Twintig tot dertig roeiers.",
      "De tekst noemt dit niet.",
    ],
    modelAnswer: "Twintig tot dertig roeiers.",
    rubric: null,
  },
  {
    type: "OPEN" as const,
    prompt: "Welke klus deden Vikingen als ze niet op reis waren? Geef twee voorbeelden uit de tekst.",
    skill: "explicit_information",
    requireTwoArguments: true,
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Ze waren handelslieden en boeren; er zijn boerderijen en dorpen in Scandinavië gevonden waar gewone families woonden.",
    rubric: {
      keywordGroups: [["handelaar", "handel"], ["boer", "boerderij", "dorpen"]],
      minChars: 30,
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Leg in eigen woorden uit wat 'mythes' in deze tekst betekent.",
    skill: "vocabulary",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Mythes zijn verhalen die iets vertellen over hoe mensen zich Vikingen voorstelden, maar niet over wat Vikingen echt deden.",
    rubric: {
      keywordGroups: [["verhalen", "gedichten"], ["voorstellen", "dachten", "beelden", "niet echt"]],
      minChars: 25,
    },
  },
  {
    type: "OPEN" as const,
    prompt: "Zie jij iets in de tekst dat niet letterlijk bewezen is? Noem het en beschrijf wat het wél vertelt.",
    skill: "inference",
    requireEvidence: true,
    requireCompleteSentences: true,
    modelAnswer:
      "Feestzaalverhalen zijn niet bewezen; wat ze wel vertellen is hoe mensen zich voorstelden wat Vikingen deden.",
    rubric: {
      keywordGroups: [["niet bewezen", "niet zeker", "mythes", "niet kunnen bewijzen"]],
      minChars: 30,
    },
  },
];

/* ---------------------------------------------------------------- */

async function main() {
  // skills
  for (const s of SKILLS) {
    await prisma.learningSkill.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  const pw = await bcrypt.hash("welkom123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.nl" },
    update: {},
    create: { email: "admin@demo.nl", name: "Beheerder", passwordHash: pw, role: "ADMIN" },
  });
  const parent = await prisma.user.upsert({
    where: { email: "ouder@demo.nl" },
    update: {},
    create: { email: "ouder@demo.nl", name: "Opa van Salima", passwordHash: pw, role: "PARENT" },
  });
  const student = await prisma.user.upsert({
    where: { email: "leerling@demo.nl" },
    update: {},
    create: { email: "leerling@demo.nl", name: "Salima", passwordHash: pw, role: "STUDENT" },
  });
  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: { userId: student.id, groep: 8, defaultDifficulty: "gemiddeld" },
  });
  const already = await prisma.parentStudentRelationship.findFirst({
    where: { parentId: parent.id, studentId: student.id },
  });
  if (!already) {
    await prisma.parentStudentRelationship.create({
      data: { parentId: parent.id, studentId: student.id },
    });
  }

  await seedPassage(
    "De broers Van Gogh",
    "geschiedenis",
    "gemiddeld",
    8,
    GOGH_BODY,
    ["De broers Van Gogh"],
    ["Nederlandse kunsthistorie", "Mensen begrijpen dat beroemdheid hulp nodig heeft"],
    GOGH_QUESTIONS,
    admin.id
  );

  await seedPassage(
    "De Vikingen: mythe en werkelijkheid",
    "geschiedenis",
    "gemiddeld",
    6,
    VIKING_BODY,
    ["De Vikingen: mythe en werkelijkheid"],
    ["Onderscheid tussen mythe en feit"],
    VIKING_QUESTIONS,
    admin.id
  );

  const passage2 = await prisma.readingPassage.findFirst({
    where: { topic: "geschiedenis" },
  });
  if (!passage2) {
    throw new Error("Vikingen-passage ontbreekt na seed");
  }

  console.log("Seed ready. Demo accounts: admin@demo.nl, ouder@demo.nl, leerling@demo.nl (wachtwoord: welkom123)");
}

async function seedPassage(
  title: string,
  topic: string,
  difficulty: string,
  estMinutes: number,
  body: string,
  headings: string[],
  objectives: string[],
  questions: any[],
  authorId: string
) {
  const exists = await prisma.readingPassage.findFirst({ where: { title } });
  if (exists) return;
  const skillMap: Record<string, string> = {};
  for (const s of SKILLS) {
    const row = await prisma.learningSkill.findUnique({ where: { key: s.key } });
    if (row) skillMap[s.key] = row.id;
  }
  await prisma.readingPassage.create({
    data: {
      title,
      topic,
      difficulty,
      estMinutes,
      body,
      headings: JSON.stringify(headings),
      objectives: JSON.stringify(objectives),
      status: "PUBLISHED",
      version: 1,
      authorId,
      questions: {
        create: questions.map((q, i) => ({
          order: i,
          type: q.type,
          prompt: q.prompt,
          skillId: skillMap[q.skill],
          mcAnswerKey: q.mcAnswerKey ?? null,
          modelAnswer: q.modelAnswer ?? null,
          requireTwoArguments: q.requireTwoArguments ?? false,
          requireEvidence: q.requireEvidence ?? false,
          requireCompleteSentences: q.requireCompleteSentences ?? false,
          options: q.options
            ? {
                create: q.options.map((text: string, j: number) => ({ order: j, text })),
              }
            : undefined,
          rubric: q.rubric
            ? {
                create: {
                  keywordGroups: JSON.stringify(q.rubric.keywordGroups),
                  minChars: q.rubric.minChars ?? 20,
                  fullCreditRule: q.rubric.fullCreditRule ?? null,
                },
              }
            : undefined,
        })),
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
