import admin from "firebase-admin";

let app;

// Hàm xử lý private key để khôi phục ký tự xuống dòng
function fixKey(key) {
  return key?.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:", err);
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON.");
  }

  const { project_id, client_email, private_key } = parsed;

  if (!project_id || !client_email || !private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY must contain project_id, client_email, private_key."
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: project_id,
      clientEmail: client_email,
      privateKey: fixKey(private_key),
    }),
  });
} else {
  app = admin.app();
}

export const db = admin.firestore(app);
