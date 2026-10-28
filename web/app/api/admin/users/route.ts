export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";

/** List all users (admin only), newest first. */
export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: { select: { groep: true } },
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    return fail(e);
  }
}
