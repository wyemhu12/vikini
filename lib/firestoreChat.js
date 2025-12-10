// lib/firestoreChat.js
import { db } from "./firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";

function conversationsCol() {
  return db.collection(CONVERSATIONS_COLLECTION);
}
function conversationDoc(id) {
  return conversationsCol().doc(id);
}

// Convert Firestore data -> plain JS (timestamp -> number, bỏ undefined)
function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) return obj.map((v) => sanitize(v));

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;

    // Firestore Timestamp
    if (v && typeof v.toDate === "function") {
      clean[k] = v.toDate().getTime();
      continue;
    }
    if (v && typeof v === "object") {
      clean[k] = sanitize(v);
      continue;
    }
    clean[k] = v;
  }
  return clean;
}

// ---------------------- GET LIST (projection tối ưu) ----------------------
export async function getUserConversations(userId) {
  const snap = await conversationsCol()
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc")
    .select("title", "updatedAt", "lastMessagePreview") // chỉ lấy field cần
    .get();

  return snap.docs.map((d) =>
    sanitize({
      id: d.id,
      ...(d.data() || {}),
    })
  );
}

// ---------------------- SAVE CONVERSATION ----------------------
export async function saveConversation(userId, data = {}) {
  const now = Timestamp.now();

  const base = {
    userId,
    title: data.title || "New Chat",
    createdAt: data.createdAt
      ? new Timestamp(
          Math.floor(data.createdAt / 1000),
          (data.createdAt % 1000) * 1_000_000
        )
      : now,
    updatedAt: now,
  };

  if (data.id) {
    const ref = conversationDoc(data.id);
    await ref.set(base, { merge: true });
    const snap = await ref.get();
    return sanitize({ id: snap.id, ...(snap.data() || {}) });
  } else {
    const ref = await conversationsCol().add(base);
    const snap = await ref.get();
    return sanitize({ id: snap.id, ...(snap.data() || {}) });
  }
}

// ---------------------- GET ONE CONVERSATION ----------------------
export async function getConversation(id) {
  const snap = await conversationDoc(id).get();
  if (!snap.exists) return null;
  return sanitize({ id: snap.id, ...(snap.data() || {}) });
}

// ---------------------- UPDATE TITLE (rename) ----------------------
export async function updateConversationTitle(id, title) {
  const ref = conversationDoc(id);
  await ref.set(
    {
      title,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
  const snap = await ref.get();
  return sanitize({ id: snap.id, ...(snap.data() || {}) });
}

// ---------------------- SET FINAL TITLE (auto-title mới) ----------------------
export async function setConversationAutoTitle(userId, id, title) {
  const ref = conversationDoc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Conversation not found");

  const data = snap.data() || {};
  if (data.userId !== userId) throw new Error("Forbidden");

  await ref.set(
    {
      title,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  const after = await ref.get();
  return sanitize({ id: after.id, ...(after.data() || {}) });
}

// ---------------------- DELETE CONVERSATION + MESSAGES ----------------------
export async function deleteConversation(userId, id) {
  const ref = conversationDoc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  if ((snap.data() || {}).userId !== userId) throw new Error("Forbidden");

  const msgsSnap = await ref.collection(MESSAGES_SUBCOLLECTION).get();
  const batch = db.batch();

  msgsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}

// ---------------------- SAVE MESSAGE ----------------------
export async function saveMessage({ conversationId, userId, role, content }) {
  if (!conversationId || !role || !content) throw new Error("Invalid params");

  const ref = conversationDoc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Conversation not found");

  const conv = snap.data() || {};
  if (userId && conv.userId !== userId) throw new Error("Forbidden");

  const now = Timestamp.now();

  const msgRef = ref.collection(MESSAGES_SUBCOLLECTION).doc();
  const msg = { role, content, createdAt: now };
  await msgRef.set(msg);

  await ref.set(
    {
      updatedAt: now,
      lastMessagePreview: content.slice(0, 200),
    },
    { merge: true }
  );

  return sanitize({ id: msgRef.id, ...msg });
}

// ---------------------- GET MESSAGES ----------------------
export async function getMessages(id) {
  const ref = conversationDoc(id);
  const snap = await ref
    .collection(MESSAGES_SUBCOLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  return snap.docs.map((d) =>
    sanitize({
      id: d.id,
      ...(d.data() || {}),
    })
  );
}
