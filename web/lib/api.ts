import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";

export function fail(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Er ging iets mis. Probeer het opnieuw." }, { status: 500 });
}
