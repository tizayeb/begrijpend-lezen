export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Start a new attempt (students only). Freezes a content snapshot. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Alleen leerlingen mogen oefenen." }, { status: 403 });
    }
    const { passageId } = await req.json();
    const passage = await prisma.readingPassage.findUnique({
      where: { id: passageId },
      include: { questions: true },
    });
    if (!passage || passage.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Oefening niet gevonden." }, { status: 404 });
    }
    if (!passage.questions.length) {
      return NextResponse.json({ error: "Deze oefening heeft nog geen vragen." }, { status: 400 });
    }

    // Resume an unfinished attempt if one exists for this passage.
    const open = await prisma.exerciseAttempt.findFirst({
      where: { studentId: user.id, passageId, status: "IN_PROGRESS" },
    });
    if (open) return NextResponse.json({ attemptId: open.id, resumed: true });

    const { buildSnapshot } = await import("@/lib/snapshot");
    const snapshot = await buildSnapshot(passageId);
    const attempt = await prisma.exerciseAttempt.create({
      data: {
        studentId: user.id,
        passageId,
        snapshot: JSON.stringify(snapshot),
      },
    });
    return NextResponse.json({ attemptId: attempt.id });
  } catch (e) {
    return fail(e);
  }
}
