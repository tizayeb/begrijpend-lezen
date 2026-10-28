export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { fail } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Vul e-mail en wachtwoord in." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "E-mail of wachtwoord klopt niet." }, { status: 401 });
    }
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Je account is nog niet geactiveerd. Neem contact op met de beheerder." },
        { status: 403 }
      );
    }
    await createSession(user.id);
    const redirect =
      user.role === "STUDENT" ? "/bibliotheek" : user.role === "PARENT" ? "/ouder" : "/admin";
    return NextResponse.json({ ok: true, role: user.role, redirect });
  } catch (e) {
    return fail(e);
  }
}
