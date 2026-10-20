import { cert, initializeApp } from "firebase-admin";
import serviceAccount from "../ServiceAccountKey.json" with { type: "json" };

// export const app = initializeApp({
//   credential: cert(serviceAccount),
// });

import { cert, initializeApp, getApps } from "firebase-admin/app";
import dotenv from "dotenv";
dotenv.config();

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing",
  );
}

const serviceAccount = JSON.parse(serviceAccountJson);

export const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });
