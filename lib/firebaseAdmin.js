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

  const json = JSON.parse(raw);

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: fixKey(json.private_key),
    }),
  });
}

// !!! IMPORTANT: Use REST TRANSPORT instead of gRPC (fix UNAUTHENTICATED on Vercel)
const firestore = admin.firestore();
firestore.settings({ preferRest: true });

export const db = firestore;
