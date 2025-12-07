// lib/firestoreChat.js
import { db } from "./firebaseAdmin";
import {
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore";

const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";

// ---------- Helpers ----------

function conversationsCol() {
  return db.collection(CONVERSATIONS_COLLECTION);
}

function conversationDoc(conversationId) {
  return conversationsCol().doc(conversationId);
}

/**
 * Sanitize Firestore data so NextResponse.json không bị crash
 * - Bỏ undefined
 * - Timestamp -> number (ms)
 */
function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.filter(Boolean).map((v) => sanitize(v));
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    // Firestore Timestamp
    if (value && typeof value.toDate === "function") {
      clean[key] = value.toDate().getTime();
      continue;
    }

    if (Array.isArray(value)) {
      clean[key] = value.filter(Boolean).map((v) => sanitize(v));
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

// ---------- Conversations ----------

/**
 * Lấy tất cả conversation của 1 user (mới nhất trước)
 */
export async function getUserConversations(userId) {
  const snapshot = await conversationsCol()
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    sanitize({ id: doc.id, ...(doc.data() || {}) })
  );
}

/**
 * Tạo mới hoặc update conversation (metadata)
 * - Không lưu messages ở đây nữa
 */
export async function saveConversation(userId, conversation = {}) {
  const now = Timestamp.now();

  const baseData = {
    userId,
    title: conversation.title || "New chat",
    autoTitled: !!conversation.autoTitled,
    renamed: !!conversation.renamed,
    createdAt: conversation.createdAt
      ? new Timestamp(
          Math.floor(conversation.createdAt / 1000),
          (conversation.createdAt % 1000) * 1_000_000
        )
      : now,
    updatedAt: now,
  };

  if (conversation.id) {
    const ref = conversationDoc(conversation.id);
    await ref.set(baseData, { merge: true });
    const snap = await ref.get();
    return sanitize({ id: ref.id, ...(snap.data() || {}) });
  } else {
    const ref = await conversationsCol().add(baseData);
    const snap = await ref.get();
    return sanitize({ id: ref.id, ...(snap.data() || {}) });
  }
}

/**
 * Lấy 1 conversation theo id
 */
export async function getConversation(conversationId) {
  const snap = await conversationDoc(conversationId).get();
  if (!snap.exists) return null;
  return sanitize({ id: snap.id, ...(snap.data() || {}) });
}

/**
 * Đổi title (rename)
 */
export async function updateConversationTitle(conversationId, title) {
  const ref = conversationDoc(conversationId);
  await ref.set(
    {
      title,
      renamed: true,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  const snap = await ref.get();
  return sanitize({ id: snap.id, ...(snap.data() || {}) });
}

export async function setConversationAutoTitle(userId, conversationId, title) {
  if (!conversationId || !title?.trim()) {
    throw new Error("conversationId and title are required");
  }

  const ref = conversationDoc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Conversation not found");
  }

  const data = snap.data() || {};
  if (data.userId !== userId) {
    throw new Error("Forbidden");
  }

  await ref.set(
    {
      title: title.trim(),
      autoTitled: true,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  const updatedSnap = await ref.get();
  return sanitize({ id: updatedSnap.id, ...(updatedSnap.data() || {}) });
}

/**
 * Xoá conversation + toàn bộ messages (simple, không batch lớn)
 */
export async function deleteConversation(userId, conversationId) {
  const ref = conversationDoc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data() || {};
  if (data.userId !== userId) {
    throw new Error("Forbidden");
  }

  // Xoá subcollection messages
  const messagesSnap = await ref
    .collection(MESSAGES_SUBCOLLECTION)
    .get();

  const batch = db.batch();
  messagesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}

// ---------- Messages ----------

/**
 * Lưu 1 message vào subcollection messages
 * - Đồng thời update updatedAt + lastMessagePreview của conversation
 */
export async function saveMessage({
  conversationId,
  userId, // optional, để check quyền (nếu muốn)
  role,
  content,
}) {
  if (!conversationId) {
    throw new Error("conversationId is required");
  }
  if (!role || !content) {
    throw new Error("role and content are required");
  }

  const convRef = conversationDoc(conversationId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    throw new Error("Conversation not found");
  }

  const convData = convSnap.data() || {};
  if (userId && convData.userId !== userId) {
    throw new Error("Forbidden");
  }

  const now = Timestamp.now();

  const msgRef = convRef.collection(MESSAGES_SUBCOLLECTION).doc();
  const message = {
    role,
    content,
    createdAt: now,
  };

  await msgRef.set(message);

  await convRef.set(
    {
      updatedAt: now,
      lastMessagePreview: content.slice(0, 200),
    },
    { merge: true }
  );

  return sanitize({ id: msgRef.id, ...message });
}

/**
 * Lấy toàn bộ messages của 1 conversation (asc)
 */
export async function getMessages(conversationId) {
  const convRef = conversationDoc(conversationId);

  const snap = await convRef
    .collection(MESSAGES_SUBCOLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  return snap.docs.map((d) =>
    sanitize({ id: d.id, ...(d.data() || {}) })
  );
}
