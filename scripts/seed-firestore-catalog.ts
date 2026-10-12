/**
 * Consolidated Admin seed / reset script:
 * Ensures `challenges/state` and `achievements/state` are initialized under `users/{uid}/…`.
 * Removes legacy `challenge_defs` and `achievement_defs` subcollections.
 *
 * Usage:
 *   SEED_UID=svdCifsvCOVsjGeFjM14t3LaVGE2 npx tsx scripts/seed-firestore-catalog.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import admin from "firebase-admin";

const UID = process.env.SEED_UID ?? "svdCifsvCOVsjGeFjM14t3LaVGE2";
const RESET_STATE = process.env.SEED_RESET === "1" || process.env.SEED_RESET === "true";

function initAdmin() {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "rehab-app-45234-firebase-adminsdk-fbsvc-7435950b2d.json";
  const abs = resolve(path);
  const sa = JSON.parse(readFileSync(abs, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

async function deleteCollection(db: admin.firestore.Firestore, collPath: string, exceptIds: string[] = []) {
  const ref = db.collection(collPath);
  const snap = await ref.get();
  const batch = db.batch();
  let count = 0;
  for (const d of snap.docs) {
    if (exceptIds.includes(d.id)) continue;
    batch.delete(d.ref);
    count++;
  }
  if (count > 0) {
    await batch.commit();
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const base = `users/${UID}`;

  // Clean legacy subcollections
  await deleteCollection(db, `${base}/achievement_defs`);
  await deleteCollection(db, `${base}/challenge_defs`);
  await deleteCollection(db, `${base}/challenges`, ["state"]);

  const challengeStateRef = db.doc(`${base}/challenges/state`);
  const existingChallengeState = await challengeStateRef.get();
  if (!existingChallengeState.exists || RESET_STATE) {
    await challengeStateRef.set({
      activeChallengeId: 1,
      currentProgress: 0,
      lastCompletedDate: null,
      completedChallenges: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Initialized challenges/state doc for uid=${UID}`);
  } else {
    console.log(`challenges/state doc already active for uid=${UID}`);
  }

  const achievementStateRef = db.doc(`${base}/achievements/state`);
  const existingAchievementState = await achievementStateRef.get();
  if (!existingAchievementState.exists || RESET_STATE) {
    await achievementStateRef.set({
      unlockedAchievements: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Initialized achievements/state doc for uid=${UID}`);
  } else {
    console.log(`achievements/state doc already active for uid=${UID}`);
  }

  console.log(`Seed verified successfully for uid=${UID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
