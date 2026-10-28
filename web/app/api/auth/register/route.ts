export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { fail } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { email, name, password, role, groep } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: "Vul alle velden in." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Wachtwoord: minimaal 8 tekens." }, { status: 400 });
    }
    if (!["STUDENT", "PARENT"].includes(role)) {
      return NextResponse.json({ error: "Ongeldige rol." }, { status: 400 });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Dit e-mailadres is al in gebruik." }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        role,
        profile: role === "STUDENT" ? { create: { groep: groep || 8 } } : undefined,
      },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true, role: user.role, redirect: role === "STUDENT" ? "/bibliotheek" : "/ouder" });
  } catch (e) {
    return fail(e);
  }
}
