import { readFileSync } from "fs";
import { resolve } from "path";
import admin from "firebase-admin";

const UID = process.env.SEED_UID ?? "svdCifsvCOVsjGeFjM14t3LaVGE2";

function initAdmin() {
  const sa = JSON.parse(readFileSync(resolve("rehab-app-45234-firebase-adminsdk-fbsvc-7435950b2d.json"), "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

async function deleteCollection(db: admin.firestore.Firestore, collPath: string, exceptIds: string[] = []) {
  const ref = db.collection(collPath);
  const snap = await ref.get();
  const batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    if (exceptIds.includes(doc.id)) continue;
    batch.delete(doc.ref);
    count++;
  }
  if (count > 0) {
    await batch.commit();
  }
  console.log(`Deleted ${count} documents from ${collPath}`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const base = `users/${UID}`;

  console.log(`Starting migration for ${base}...`);

  // 1. Read existing achievements to preserve any unlocked ones (like urge_1)
  const achSnap = await db.collection(`${base}/achievements`).get();
  const unlockedAchievements: Array<{ id: string; title: string; unlockedAt: string }> = [];
  for (const doc of achSnap.docs) {
    if (doc.id === "state") continue;
    const data = doc.data();
    unlockedAchievements.push({
      id: doc.id,
      title: data.title ?? data.name ?? doc.id,
      unlockedAt: (data.unlockedAt?.toDate?.() ? data.unlockedAt.toDate().toISOString() : data.unlockedAt) ?? new Date().toISOString(),
    });
  }
  console.log(`Preserved ${unlockedAchievements.length} unlocked achievements:`, unlockedAchievements.map(a => a.id));

  // 2. Delete challenge_defs and achievement_defs subcollections completely
  await deleteCollection(db, `${base}/challenge_defs`);
  await deleteCollection(db, `${base}/achievement_defs`);

  // 3. Delete individual docs in challenges and achievements subcollections (except "state")
  await deleteCollection(db, `${base}/challenges`, ["state"]);
  await deleteCollection(db, `${base}/achievements`, ["state"]);

  // 4. Create consolidated state in users/{uid}/challenges/state
  const challengesStateRef = db.doc(`${base}/challenges/state`);
  const existingChallengeState = await challengesStateRef.get();
  if (!existingChallengeState.exists) {
    await challengesStateRef.set({
      activeChallengeId: 1,
      currentProgress: 0,
      lastCompletedDate: null,
      completedChallenges: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("Created initial challenges/state doc (activeChallengeId: 1, currentProgress: 0)");
  } else {
    console.log("challenges/state doc already exists, keeping current state:", existingChallengeState.data());
  }

  // 5. Create consolidated state in users/{uid}/achievements/state
  const achievementsStateRef = db.doc(`${base}/achievements/state`);
  await achievementsStateRef.set(
    {
      unlockedAchievements,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log("Created/updated achievements/state doc with preserved achievements");

  console.log("Migration complete!");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
