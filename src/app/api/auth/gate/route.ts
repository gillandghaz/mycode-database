import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireUser, isRegistrationOpenServer, errorResponse, HttpError } from "@/lib/server-auth";

// Sign-up gate, enforced on the SERVER. The client calls it right before it
// creates the profile of a NEW account (email/password or Google; a first
// Google sign-in creates the Firebase Auth account automatically).
//
//  - account already has a profile        -> ok (normal sign-in, unaffected)
//  - no profile and sign-ups are CLOSED   -> the fresh Auth account is deleted
//                                            here and the request is refused (403)
//  - no profile and sign-ups are OPEN     -> ok; the client creates the profile
//                                            (firestore.rules checks again)
export async function POST(request: Request) {
  try {
    const decoded = await requireUser(request, { requireProfile: false });

    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    if (snap.exists) return NextResponse.json({ ok: true, hasProfile: true });

    if (!(await isRegistrationOpenServer())) {
      try {
        await adminAuth().deleteUser(decoded.uid);
      } catch (e) {
        console.error("auth gate: couldn't delete the profile-less Auth account:", e);
      }
      throw new HttpError(403, "Sign-ups are currently closed.", "registration-closed");
    }
    return NextResponse.json({ ok: true, hasProfile: false });
  } catch (err) {
    return errorResponse(err, "auth gate");
  }
}
