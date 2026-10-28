export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, getSessionUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { safeJson } from "@/lib/snapshot";
import { createPassage, validatePassage, type PassagePayload } from "@/lib/passage-create";

/** Public library list (published passages only, with the student's own status). */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || undefined;
    const difficulty = url.searchParams.get("difficulty") || undefined;

    let studentId: string | null = null;
    if (user && user.role === "STUDENT") studentId = user.id;

    const passages = await prisma.readingPassage.findMany({
      where: {
        status: "PUBLISHED",
        ...(topic && topic !== "alles" ? { topic } : {}),
        ...(difficulty && difficulty !== "alles" ? { difficulty } : {}),
      },
      include: { questions: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });

    const myAttempts =
      studentId
        ? await prisma.exerciseAttempt.findMany({
            where: { studentId, passageId: { in: passages.map((p) => p.id) } },
            select: { passageId: true, status: true, scorePct: true },
          })
        : [];

    const items = passages.map((p) => {
      const ats = myAttempts.filter((a) => a.passageId === p.id);
      const submitted = ats.filter((a) => a.status === "SUBMITTED");
      const best = submitted.length ? Math.max(...submitted.map((a) => a.scorePct ?? 0)) : null;
      return {
        id: p.id,
        title: p.title,
        topic: p.topic,
        difficulty: p.difficulty,
        estMinutes: p.estMinutes,
        objectives: safeJson<string[]>(p.objectives) ?? [],
        questionCount: p.questions.length,
        status: submitted.length ? "afgerond" : ats.length ? "in_uitvoering" : "niet_begonnen",
        bestScore: best,
      };
    });

    const topicRows = await prisma.readingPassage.findMany({
      where: { status: "PUBLISHED" },
      select: { topic: true },
      distinct: ["topic"],
    });

    return NextResponse.json({ items, topics: topicRows.map((r) => r.topic) });
  } catch (e) {
    return fail(e);
  }
}

/** Admin: create one passage (also used by the admin form). */
export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const payload = (await req.json()) as PassagePayload;
    const error = validatePassage(payload);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const passage = await createPassage(payload, admin.id);
    return NextResponse.json({ ok: true, id: passage.id });
  } catch (e) {
    return fail(e);
  }
}
