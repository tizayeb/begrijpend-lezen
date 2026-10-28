export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";
import { safeJson } from "@/lib/snapshot";

/** Admin: list all passages including drafts. */
export async function GET() {
  try {
    await requireRole("ADMIN");
    const passages = await prisma.readingPassage.findMany({
      include: { questions: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      items: passages.map((p) => ({
        id: p.id,
        title: p.title,
        topic: p.topic,
        difficulty: p.difficulty,
        estMinutes: p.estMinutes,
        status: p.status,
        version: p.version,
        questionCount: p.questions.length,
        objectives: safeJson<string[]>(p.objectives) ?? [],
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
