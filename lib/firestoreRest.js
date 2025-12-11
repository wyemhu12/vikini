// app/lib/firestoreRest.js
import crypto from "crypto";

let serviceAccount = null;
let projectId = null;

let cachedToken = null;
let cachedExpiry = 0; // epoch seconds

function normalizePrivateKey(key) {
  if (!key) return key;
  // Trường hợp env bị double-escape, vẫn an toàn
  return key.replace(/\\n/g, "\n");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function loadServiceAccount() {
  if (serviceAccount) return serviceAccount;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_KEY env for Firestore REST client."
    );
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:", e);
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON.");
  }

  const { project_id, client_email, private_key } = json;

  if (!project_id || !client_email || !private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY must contain project_id, client_email, private_key."
    );
  }

  serviceAccount = {
    project_id,
    client_email,
    private_key: normalizePrivateKey(private_key),
  };

  projectId =
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount.project_id ||
    process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error("Cannot resolve Firestore projectId.");
  }

  return serviceAccount;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  // Dùng token cache nếu còn hạn
  if (cachedToken && cachedExpiry - 60 > now) {
    return cachedToken;
  }

  const { client_email, private_key } = loadServiceAccount();

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: client_email,
    sub: client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/datastore",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();

  const signature = base64url(signer.sign(private_key));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("❌ Failed to fetch access token:", res.status, json);
    throw new Error("Failed to obtain Firestore access token.");
  }

  if (!json.access_token) {
    console.error("❌ Token response missing access_token:", json);
    throw new Error("Invalid token response from Google OAuth.");
  }

  cachedToken = json.access_token;
  cachedExpiry = now + (json.expires_in || 3600);

  return cachedToken;
}

export function getProjectId() {
  if (!projectId) loadServiceAccount();
  return projectId;
}

/**
 * Firestore REST generic request
 *
 * @param {string} path - relative path, vd: `/documents/...`
 * @param {object} options
 *   - method, body, headers
 *   - acceptNotFound: nếu true, trả về null khi 404
 */
export async function firestoreRequest(
  path,
  { method = "GET", body, headers, acceptNotFound = false } = {}
) {
  const token = await getAccessToken();
  const pid = getProjectId();

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)`;
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body !== undefined ? body : undefined,
  });

  const text = await res.text();

  if (res.status === 404 && acceptNotFound) {
    return null;
  }

  if (!res.ok) {
    console.error("❌ Firestore REST error:", res.status, text);
    throw new Error(`Firestore REST error ${res.status}`);
  }

  return text ? JSON.parse(text) : null;
}
