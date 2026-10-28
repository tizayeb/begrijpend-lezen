export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Activate/deactivate a user or set a new password (admin only). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await req.json();
    const wantsStatus = body && typeof body.isActive === "boolean";
    const wantsPassword = body && typeof body.password === "string" && body.password.length > 0;
    if (!wantsStatus && !wantsPassword) {
      return NextResponse.json(
        { error: "Geef isActive (true/false) of een nieuw wachtwoord mee." },
        { status: 400 }
      );
    }
    if (wantsPassword && (body.password as string).length < 8) {
      return NextResponse.json(
        { error: "Wachtwoord moet minimaal 8 tekens zijn." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Gebruiker niet gevonden." }, { status: 404 });

    if (wantsStatus && body.isActive === false && target.id === admin.id) {
      return NextResponse.json(
        { error: "Je kunt je eigen account niet deactiveren." },
        { status: 400 }
      );
    }

    const data: { isActive?: boolean; passwordHash?: string } = {};
    if (wantsStatus) data.isActive = body.isActive as boolean;
    if (wantsPassword) data.passwordHash = await hashPassword(body.password as string);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return fail(e);
  }
}
