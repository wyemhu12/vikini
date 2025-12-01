import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let app;

/**
 * Fix multiline private keys coming from .env
 * - Env thường lưu private key với \n thay vì xuống dòng thật.
 */
function cleanPrivateKey(key) {
  if (!key) return undefined;
  return key.replace(/\\n/g, "\n");
}

function createFirebaseApp() {
  // ✅ Option A: dùng 3 biến riêng
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  // Nếu thiếu 1 trong 3 biến → thử fallback sang FIREBASE_SERVICE_ACCOUNT_KEY (optional)
  if (!projectId || !clientEmail || !privateKey) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
      throw new Error(
        "Firebase Admin init failed. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_KEY)."
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.");
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON.");
    }

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY must contain project_id, client_email and private_key."
      );
    }

    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: cleanPrivateKey(parsed.private_key),
      }),
    });
  }

  // ✅ Trường hợp chuẩn: dùng 3 env riêng
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// ✅ Serverless-safe: chỉ init 1 lần mỗi server instance
if (!getApps().length) {
  app = createFirebaseApp();
} else {
  app = getApp();
}

export const db = getFirestore(app);
