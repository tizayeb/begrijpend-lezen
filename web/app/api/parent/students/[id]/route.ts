export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, canViewStudent } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Unlink a student from the parent. Student data is retained but becomes anonymous on delete request. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireRole("PARENT", "ADMIN");
    if (!user || !(await canViewStudent(user.id, user.role, id)) || user.role !== "PARENT") {
      if (user.role !== "ADMIN") {
        return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
      }
    }
    const link = await prisma.parentStudentRelationship.findFirst({
      where: { parentId: user.id, studentId: id },
    });
    if (link) {
      await prisma.parentStudentRelationship.delete({ where: { id: link.id } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
