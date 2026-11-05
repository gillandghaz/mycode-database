// Profile photo helpers (client side).
//
// The photo is cropped to a square, shrunk to 256x256 and stored as a small
// JPEG data URL in avatars/{uid} (a few tens of KB). No Firebase Storage is
// needed. firestore.rules re-check the prefix and the size.

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const AVATAR_SIZE = 256;
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // what the user may pick
const MAX_DATA_URL_CHARS = 100_000; // rules allow 120,000
const PREFIX = "data:image/jpeg;base64,";

// Anything shown in an <img> must pass this first, so a bad document can
// never put an unexpected URL into the page.
export function isValidAvatar(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX) && value.length <= 120_000 && /^[A-Za-z0-9+/=]+$/.test(value.slice(PREFIX.length));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // Older browsers: fall back to an <img> element.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
    } catch {
      throw new Error("avatar-unreadable");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("avatar-type");
  if (file.size > MAX_INPUT_BYTES) throw new Error("avatar-too-big");

  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new Error("avatar-unreadable");
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("avatar-unreadable");
    ctx.fillStyle = "#ffffff"; // PNG/WebP transparency becomes white in a JPEG
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    for (const quality of [0.86, 0.72, 0.58]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.startsWith(PREFIX) && url.length <= MAX_DATA_URL_CHARS) return url;
    }
    throw new Error("avatar-too-big");
  } finally {
    img.close();
  }
}

export function avatarErrorMessage(err: unknown): string {
  switch ((err as Error)?.message) {
    case "avatar-type":
      return "Please choose a JPG, PNG or WebP image.";
    case "avatar-too-big":
      return "That image is too large. Pick one under 8 MB.";
    case "avatar-unreadable":
      return "Couldn't read that image. Try another one.";
    default:
      return "Couldn't save your photo. Try again.";
  }
}

// Add or replace the signed-in user's photo. (There is deliberately no remove.)
export async function saveAvatar(uid: string, dataUrl: string): Promise<void> {
  await setDoc(doc(db, "avatars", uid), { dataUrl, updatedAt: serverTimestamp() });
}
