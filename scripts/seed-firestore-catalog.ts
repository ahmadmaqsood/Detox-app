/**
 * One-time Admin seed: writes `achievement_defs`, `challenge_defs`, and `challenges` under
 * `users/{uid}/…` from `lib/seed/masterCatalog.ts`.
 *
 * Prerequisites:
 *   npm install
 *   Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service account JSON with Firestore write access.
 *
 * Usage:
 *   SEED_UID=svdCifsvCOVsjGeFjM14t3LaVGE2 npx tsx scripts/seed-firestore-catalog.ts
 *
 * Replace existing catalog docs for that user:
 *   SEED_REPLACE=1 SEED_UID=... npx tsx scripts/seed-firestore-catalog.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import admin from "firebase-admin";

import { MASTER_ACHIEVEMENTS, MASTER_CHALLENGES } from "../lib/seed/masterCatalog";

const UID = process.env.SEED_UID ?? "svdCifsvCOVsjGeFjM14t3LaVGE2";
const REPLACE = process.env.SEED_REPLACE === "1" || process.env.SEED_REPLACE === "true";

function initAdmin() {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) {
    throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.");
  }
  const abs = resolve(path);
  const sa = JSON.parse(readFileSync(abs, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

async function deleteCollection(db: admin.firestore.Firestore, collPath: string) {
  const ref = db.collection(collPath);
  const batchSize = 400;
  for (;;) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const base = `users/${UID}`;

  if (REPLACE) {
    await deleteCollection(db, `${base}/achievement_defs`);
    await deleteCollection(db, `${base}/challenge_defs`);
    await deleteCollection(db, `${base}/challenges`);
    console.log(`Cleared achievement_defs, challenge_defs, challenges for ${UID}`);
  }

  let batch = db.batch();
  let n = 0;

  const commitIfNeeded = async (min = 400) => {
    if (n >= min) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  };

  MASTER_ACHIEVEMENTS.forEach((a, i) => {
    const sortOrder = i + 1;
    const ref = db.doc(`${base}/achievement_defs/${a.id}`);
    batch.set(ref, {
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      icon: JSON.stringify(a.icon),
      sortOrder,
    });
    n++;
  });
  await commitIfNeeded(1);

  MASTER_CHALLENGES.forEach((c, i) => {
    const sortOrder = i + 1;
    const idStr = String(c.id);
    const defRef = db.doc(`${base}/challenge_defs/${idStr}`);
    batch.set(defRef, {
      id: c.id,
      defId: c.defId,
      name: c.name,
      description: c.description,
      duration: c.duration,
      category: c.category,
      rules: c.rules,
      difficulty: c.difficulty,
      xp: c.xp,
      sortOrder,
    });
    n++;

    const chRef = db.doc(`${base}/challenges/${idStr}`);
    batch.set(chRef, {
      id: c.id,
      defId: c.defId,
      name: c.name,
      description: c.description,
      duration: c.duration,
      category: c.category,
      rules: c.rules,
      progress: 0,
      startedAt: null,
      completedAt: null,
      difficulty: c.difficulty,
      xp: c.xp,
    });
    n++;
  });

  if (n > 0) await batch.commit();

  console.log(
    `Seeded ${MASTER_ACHIEVEMENTS.length} achievement_defs, ${MASTER_CHALLENGES.length} challenge_defs + challenges for uid=${UID}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
