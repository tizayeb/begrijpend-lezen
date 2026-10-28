import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";
import bcrypt from "bcryptjs";

/** Link a student account by email; creates the account if absent (default password set to email). */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PARENT", "ADMIN");
    const { email, studentName, studentPassword } = await req.json();
    if (!email) return NextResponse.json({ error: "E-mailadres ontbreekt." }, { status: 400 });

    let student = await prisma.user.findUnique({ where: { email } });
    if (!student) {
      if (!studentName) {
        return NextResponse.json(
          { error: "Leerling bestaat niet. Vul ook een naam en wachtwoord in om aan te maken." },
          { status: 404 }
        );
      }
      student = await prisma.user.create({
        data: {
          email,
          name: studentName,
          passwordHash: await bcrypt.hash(studentPassword || "welkom123", 10),
          role: "STUDENT",
          profile: { create: { groep: 8 } },
        },
      });
    } else if (student.role !== "STUDENT") {
      return NextResponse.json({ error: "Dit account is geen leerling." }, { status: 400 });
    }

      const exists = await prisma.parentStudentRelationship.findFirst({
        where: { parentId: user.id, studentId: student.id },
      });
      if (!exists) {
        await prisma.parentStudentRelationship.create({
          data: { parentId: user.id, studentId: student.id },
        });
      }
      return NextResponse.json({ ok: true, studentId: student.id, name: student.name });
  } catch (e) {
    return fail(e);
  }
}

/** List the linked students of the logged-in parent. */
export async function GET() {
  try {
    const user = await requireRole("PARENT", "ADMIN");
    const links = await prisma.parentStudentRelationship.findMany({
      where: { parentId: user.id },
      include: { student: { select: { id: true, name: true, email: true, profile: true } } },
    });
    return NextResponse.json({
      students: links.map((l) => ({
        id: l.student.id,
        name: l.student.name,
        email: l.student.email,
        groep: l.student.profile?.groep ?? null,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
