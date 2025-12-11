import admin from "firebase-admin";

let app;

// Fix multiline private key
function fixKey(key) {
  if (!key) return undefined;
  return key.replace(/\\n/g, "\n");
}

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");

  const json = JSON.parse(raw);

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: fixKey(json.private_key),
    }),
    projectId: json.project_id,
    databaseURL: `https://${json.project_id}.firebaseio.com`,
  });
}

const firestore = admin.firestore();

// Force REST mode (no gRPC)
firestore.settings({
  preferRest: true,
});

export const db = firestore;
