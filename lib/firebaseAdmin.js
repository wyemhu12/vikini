import admin from "firebase-admin";

let app;

// Fix escaped private key
function fixKey(key) {
  return key?.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
  }

  let json = JSON.parse(raw);

  // IMPORTANT: Firebase Admin SDK requires projectId, NOT project_id
  const projectId = json.project_id;
  const clientEmail = json.client_email;
  const privateKey = fixKey(json.private_key);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Invalid service account JSON");
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,           // ← MUST USE THIS EXACT KEY
      clientEmail,
      privateKey,
    }),
  });
} else {
  app = admin.app();
}

export const db = admin.firestore(app);
