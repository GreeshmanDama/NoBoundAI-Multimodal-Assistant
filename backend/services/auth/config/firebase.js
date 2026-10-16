import { cert, initializeApp, getApps } from "firebase-admin/app";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing"
  );
}

const serviceAccount = JSON.parse(serviceAccountJson);

export const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });