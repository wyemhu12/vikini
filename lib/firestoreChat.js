import { db } from "./firebaseAdmin";

const USERS_COLLECTION = "users";
const CONVERSATIONS_SUBCOLLECTION = "conversations";

function userDoc(userId) {
  return db.collection(USERS_COLLECTION).doc(userId);
}

/**
 * Sanitizes Firestore objects for JSON serialization.
 * Removes undefined, converts Timestamp, prevents NextResponse.json crash.
 */
function sanitize(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const clean = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue; // remove undefined

    if (value?.toDate) {
      clean[key] = value.toDate().getTime(); // Timestamp → ms
      continue;
    }

    if (Array.isArray(value)) {
      clean[key] = value
        .filter(Boolean)
        .map((v) => sanitize(v));
      continue;
    }

    if (value && typeof value === "object") {
      clean[key] = sanitize(value);
      continue;
    }

    clean[key] = value;
  }

  return clean;
}

/**
 * Load all conversations for a user, newest first.
 */
export async function getUserConversations(userId) {
  const snapshot = await userDoc(userId)
    .collection(CONVERSATIONS_SUBCOLLECTION)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return sanitize({ id: doc.id, ...data });
  });
}

/**
 * Create or update a conversation.
 */
export async function saveConversation(userId, conversation) {
  const now = Date.now();

  const baseData = sanitize({
    title: conversation.title || "New chat",
    messages: Array.isArray(conversation.messages)
      ? conversation.messages
      : [],
    autoTitled: !!conversation.autoTitled,
    renamed: !!conversation.renamed,
    createdAt: conversation.createdAt || now,
    updatedAt: now,
  });

  const colRef = userDoc(userId).collection(CONVERSATIONS_SUBCOLLECTION);

  if (conversation.id) {
    const ref = colRef.doc(conversation.id);
    await ref.set(baseData, { merge: true });
    const snap = await ref.get();
    return sanitize({ id: ref.id, ...snap.data() });
  } else {
    const ref = await colRef.add(baseData);
    const snap = await ref.get();
    return sanitize({ id: ref.id, ...snap.data() });
  }
}

/**
 * Delete conversation
 */
export async function deleteConversation(userId, chatId) {
  const ref = userDoc(userId)
    .collection(CONVERSATIONS_SUBCOLLECTION)
    .doc(chatId);

  await ref.delete();
}
