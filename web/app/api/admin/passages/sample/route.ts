export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";
import { readFileSync } from "fs";
import path from "path";

/** Download the sample bulk-import template. Admins only. */
export async function GET() {
  try {
    await requireRole("ADMIN");
    const file = path.join(process.cwd(), "samples", "bulk-import-sample.json");
    const json = readFileSync(file, "utf8");
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bulk-import-voorbeeld.json"',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
