import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fail } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
