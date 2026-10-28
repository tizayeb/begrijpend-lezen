export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";
import { createPassage, validatePassage, type PassagePayload } from "@/lib/passage-create";

/**
 * Admin bulk import: accepts a JSON body that is either
 *  - an array of passage payloads, or
 *  - { items: [...] }.
 * Titles that already exist are skipped. Drafts only — review before publishing.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const parsed = await req.json();
    const items: PassagePayload[] = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Verwacht een JSON-array of {"items": [...]} met oefeningen.' },
        { status: 400 }
      );
    }

    const created: string[] = [];
    const skipped: { title: string; reason: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const validationError = validatePassage(item);
      if (validationError) {
        skipped.push({ title: item.title ?? `item ${i + 1}`, reason: validationError });
        continue;
      }
      const dup = await prisma.readingPassage.findFirst({
        where: { title: item.title.trim() },
      });
      if (dup) {
        skipped.push({ title: item.title, reason: "Oefening met deze titel bestaat al (overgeslagen)." });
        continue;
      }
      const passage = await createPassage(item, admin.id);
      created.push(passage.title);
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (e) {
    return fail(e);
  }
}
