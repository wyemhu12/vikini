// app/lib/firestoreChat.js
import { db } from "./firebaseAdmin";

export async function getUserConversations(userId) {
  const snapshot = await db
    .collection("conversations")
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function saveConversation(userId, data = {}) {
  const now = Date.now();
  const base = {
    userId,
    title: data.title || "New Chat",
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  };

  if (data.id) {
    await db.collection("conversations").doc(data.id).set(base, { merge: true });
    return { id: data.id, ...base };
  } else {
    const ref = await db.collection("conversations").add(base);
    return { id: ref.id, ...base };
  }
}

export async function getConversation(id) {
  const doc = await db.collection("conversations").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function updateConversationTitle(id, title) {
  const patch = {
    title,
    updatedAt: Date.now(),
  };

  await db.collection("conversations").doc(id).set(patch, { merge: true });
  return { id, ...patch };
}

export async function setConversationAutoTitle(userId, id, title) {
  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const patch = {
    title,
    updatedAt: Date.now(),
  };

  await db.collection("conversations").doc(id).set(patch, { merge: true });
  return { id, ...patch };
}

export async function deleteConversation(userId, id) {
  const current = await getConversation(id);
  if (!current) return;
  if (current.userId !== userId) throw new Error("Forbidden");

  // delete messages subcollection
  const messagesRef = db
    .collection("conversations")
    .doc(id)
    .collection("messages");

  const snap = await messagesRef.get();
  const batch = db.batch();

  snap.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();
  await db.collection("conversations").doc(id).delete();
}

export async function saveMessage({ conversationId, userId, role, content }) {
  if (!conversationId || !role || !content) {
    throw new Error("Invalid params");
  }

  const conv = await getConversation(conversationId);
  if (!conv) throw new Error("Conversation not found");
  if (userId && conv.userId !== userId) throw new Error("Forbidden");

  const now = Date.now();

  const ref = await db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .add({
      role,
      content,
      createdAt: now,
    });

  await db.collection("conversations").doc(conversationId).set(
    {
      updatedAt: now,
      lastMessagePreview: content.slice(0, 200),
    },
    { merge: true }
  );

  const doc = await ref.get();
  return { id: ref.id, ...doc.data() };
}

export async function getMessages(id) {
  const snapshot = await db
    .collection("conversations")
    .doc(id)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
