import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/server-auth";

// Lightweight session check called periodically by the client. If the account
// was disabled or the token revoked, the answer is 401 and the client signs out.
export async function POST(request: Request) {
  try {
    await requireUser(request, { requireProfile: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "auth session");
  }
}
