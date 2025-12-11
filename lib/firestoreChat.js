// app/lib/firestoreChat.js
import { firestoreRequest, getProjectId } from "./firestoreRest";

const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";

// -------------------------------------------
// Helper: sanitize object (bỏ undefined, deep)
// -------------------------------------------
function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitize(v));
  if (typeof obj !== "object") return obj;

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    clean[k] = sanitize(v);
  }
  return clean;
}

// -------------------------------------------
// Helper: Firestore REST encode/decode fields
// -------------------------------------------
function encodeDocument(plain) {
  const fields = {};

  for (const [key, value] of Object.entries(plain || {})) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      // Dùng integerValue (lưu ms từ epoch)
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((v) => encodeValue(v)),
        },
      };
    } else if (typeof value === "object") {
      fields[key] = {
        mapValue: {
          fields: encodeDocument(value).fields,
        },
      };
    } else {
      // Fallback: stringify
      fields[key] = { stringValue: String(value) };
    }
  }

  return { fields };
}

function encodeValue(value) {
  if (value === undefined || value === null) return { nullValue: null };

  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number")
    return { integerValue: value.toString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value instanceof Date)
    return { timestampValue: value.toISOString() };
  if (Array.isArray(value))
    return {
      arrayValue: { values: value.map((v) => encodeValue(v)) },
    };
  if (typeof value === "object")
    return {
      mapValue: { fields: encodeDocument(value).fields },
    };

  return { stringValue: String(value) };
}

function decodeDocument(doc) {
  if (!doc || !doc.fields) return null;
  const id = doc.name?.split("/").pop();
  return sanitize({
    id,
    ...decodeFields(doc.fields),
  });
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = decodeValue(value);
  }
  return out;
}

function decodeValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v)
    return new Date(v.timestampValue).getTime();
  if ("nullValue" in v) return null;

  if ("mapValue" in v) {
    return decodeFields(v.mapValue.fields || {});
  }

  if ("arrayValue" in v) {
    const arr = v.arrayValue.values || [];
    return arr.map((item) => decodeValue(item));
  }

  return null;
}

// Helper path
function conversationDocPath(id) {
  return `/documents/${CONVERSATIONS_COLLECTION}/${id}`;
}

function messagesCollectionPath(conversationId) {
  return `/documents/${CONVERSATIONS_COLLECTION}/${conversationId}/${MESSAGES_SUBCOLLECTION}`;
}

// ===========================================
// GET LIST (projection tối ưu)
// ===========================================
export async function getUserConversations(userId) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: CONVERSATIONS_COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: "userId" },
          op: "EQUAL",
          value: { stringValue: userId },
        },
      },
      orderBy: [
        {
          field: { fieldPath: "updatedAt" },
          direction: "DESCENDING",
        },
      ],
      select: {
        fields: [
          { fieldPath: "title" },
          { fieldPath: "updatedAt" },
          { fieldPath: "lastMessagePreview" },
          { fieldPath: "createdAt" },
          { fieldPath: "userId" },
        ],
      },
    },
  };

  const res = await firestoreRequest("/documents:runQuery", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const list = [];

  for (const row of res || []) {
    if (!row.document) continue;
    const conv = decodeDocument(row.document);
    if (conv) list.push(conv);
  }

  return list;
}

// ===========================================
// SAVE CONVERSATION (create / update)
// ===========================================
export async function saveConversation(userId, data = {}) {
  const now = Date.now();

  const base = {
    userId,
    title: data.title || "New Chat",
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  };

  let doc;

  if (data.id) {
    // PATCH /documents/conversations/{id}
    doc = await firestoreRequest(conversationDocPath(data.id), {
      method: "PATCH",
      body: JSON.stringify(encodeDocument(base)),
    });
  } else {
    // POST /documents/conversations
    doc = await firestoreRequest(
      `/documents/${CONVERSATIONS_COLLECTION}`,
      {
        method: "POST",
        body: JSON.stringify(encodeDocument(base)),
      }
    );
  }

  return decodeDocument(doc);
}

// ===========================================
// GET ONE CONVERSATION
// ===========================================
export async function getConversation(id) {
  const doc = await firestoreRequest(conversationDocPath(id), {
    acceptNotFound: true,
  });

  if (!doc) return null;
  return decodeDocument(doc);
}

// ===========================================
// UPDATE TITLE (rename)
// ===========================================
export async function updateConversationTitle(id, title) {
  const patch = {
    title,
    updatedAt: Date.now(),
  };

  const doc = await firestoreRequest(conversationDocPath(id), {
    method: "PATCH",
    body: JSON.stringify(encodeDocument(patch)),
  });

  return decodeDocument(doc);
}

// ===========================================
// SET FINAL TITLE (auto-title mới)
// ===========================================
export async function setConversationAutoTitle(userId, id, title) {
  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const patch = {
    title,
    updatedAt: Date.now(),
  };

  const doc = await firestoreRequest(conversationDocPath(id), {
    method: "PATCH",
    body: JSON.stringify(encodeDocument(patch)),
  });

  return decodeDocument(doc);
}

// ===========================================
// DELETE CONVERSATION + MESSAGES
// ===========================================
export async function deleteConversation(userId, id) {
  const current = await getConversation(id);
  if (!current) return;
  if (current.userId !== userId) throw new Error("Forbidden");

  // 1) Xoá toàn bộ messages subcollection
  const listRes = await firestoreRequest(
    `${messagesCollectionPath(id)}?pageSize=1000`,
    {
      acceptNotFound: true,
    }
  );

  const docs = listRes?.documents || [];

  for (const msg of docs) {
    const name = msg.name; // full path
    const parts = name.split("/"); // projects/.../documents/conversations/{id}/messages/{msgId}
    const msgId = parts[parts.length - 1];

    await firestoreRequest(
      `${messagesCollectionPath(id)}/${msgId}`,
      {
        method: "DELETE",
      }
    );
  }

  // 2) Xoá conversation document
  await firestoreRequest(conversationDocPath(id), {
    method: "DELETE",
  });
}

// ===========================================
// SAVE MESSAGE
// ===========================================
export async function saveMessage({
  conversationId,
  userId,
  role,
  content,
}) {
  if (!conversationId || !role || !content) {
    throw new Error("Invalid params");
  }

  const conv = await getConversation(conversationId);
  if (!conv) throw new Error("Conversation not found");
  if (userId && conv.userId !== userId) throw new Error("Forbidden");

  const now = Date.now();

  // 1) Tạo message mới
  const msgDoc = await firestoreRequest(
    messagesCollectionPath(conversationId),
    {
      method: "POST",
      body: JSON.stringify(
        encodeDocument({
          role,
          content,
          createdAt: now,
        })
      ),
    }
  );

  const msg = decodeDocument(msgDoc);

  // 2) Update conversation meta
  const patch = {
    updatedAt: now,
    lastMessagePreview: content.slice(0, 200),
  };

  await firestoreRequest(conversationDocPath(conversationId), {
    method: "PATCH",
    body: JSON.stringify(encodeDocument(patch)),
  });

  return msg;
}

// ===========================================
// GET MESSAGES (ASC by createdAt)
// ===========================================
export async function getMessages(id) {
  const parentPath = `projects/${getProjectId()}/databases/(default)/documents/${CONVERSATIONS_COLLECTION}/${id}`;

  const body = {
    parent: parentPath,
    structuredQuery: {
      from: [{ collectionId: MESSAGES_SUBCOLLECTION }],
      orderBy: [
        {
          field: { fieldPath: "createdAt" },
          direction: "ASCENDING",
        },
      ],
    },
  };

  const res = await firestoreRequest("/documents:runQuery", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const list = [];

  for (const row of res || []) {
    if (!row.document) continue;
    const msg = decodeDocument(row.document);
    if (msg) list.push(msg);
  }

  return list;
}
