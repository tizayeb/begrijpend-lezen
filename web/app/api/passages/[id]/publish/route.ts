export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";

const ALLOWED = ["PUBLISHED", "DRAFT", "ARCHIVED"] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const { status } = await req.json();
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Ongeldige status." }, { status: 400 });
    }
    if (status === "PUBLISHED") {
      const qCount = await prisma.question.count({ where: { passageId: id } });
      if (qCount < 3) {
        return NextResponse.json(
          { error: "Minimaal 3 vragen nodig voordat publiceren mogelijk is." },
          { status: 400 }
        );
      }
      // Basic content sanity check before publication
      const openNoRubric = await prisma.question.count({
        where: { passageId: id, type: "OPEN", rubric: null, mcAnswerKey: null },
      });
      if (openNoRubric > 0) {
        return NextResponse.json(
          { error: "Open vragen hebben een beoordelingsrubriek nodig." },
          { status: 400 }
        );
      }
    }
    const passage = await prisma.readingPassage.findUnique({ where: { id } });
    if (!passage) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
    await prisma.readingPassage.update({
      where: { id },
      data: {
        status,
        version: status === "PUBLISHED" ? passage.version + 1 : passage.version,
      },
    });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return fail(e);
  }
}
