import {
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, getCurrentUserId } from './firebaseClient';

let activeProfile = null;
let activeProfilePromise = null;

async function fetchOrCreateProfile() {
  if (!db) {
    throw new Error('Firestore is not configured.');
  }

  const userId = await getCurrentUserId();

  const profilesCol = collection(db, 'profiles');
  const canonicalRef = doc(profilesCol, userId);

  // First preference: a canonical profile whose document ID is the uid.
  const canonicalSnap = await getDoc(canonicalRef);
  if (canonicalSnap.exists()) {
    return { id: canonicalSnap.id, ...canonicalSnap.data() };
  }

  // Backwards compatibility: look for any legacy profile for this user.
  const q = query(profilesCol, where('ownerUserId', '==', userId), limit(1));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  }

  const now = new Date();
  const data = {
    ownerUserId: userId,
    displayName: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // For future use: currency, locale, etc.
    settings: {},
    createdAtClient: now.toISOString(),
  };

  await setDoc(canonicalRef, data);
  return { id: canonicalRef.id, ...data };
}

// Resolve the current user's profile and cache it for reuse.
export async function getOrCreateProfile() {
  if (!activeProfilePromise) {
    activeProfilePromise = fetchOrCreateProfile().then((p) => {
      activeProfile = p;
      return p;
    });
  }

  return activeProfilePromise;
}

export function clearCachedProfile() {
  activeProfile = null;
  activeProfilePromise = null;
}

export async function getActiveProfile() {
  const userId = await getCurrentUserId();

  // If we already have a profile and it belongs to the current user, reuse it.
  if (activeProfile && activeProfile.ownerUserId === userId) {
    return activeProfile;
  }

  // If a profile fetch is in-flight, wait for it and ensure it matches the user.
  if (activeProfilePromise) {
    const p = await activeProfilePromise;
    if (p && p.ownerUserId === userId) {
      activeProfile = p;
      return p;
    }
  }

  // Cached profile belongs to a different user (or is missing) – reset and refetch.
  clearCachedProfile();
  return getOrCreateProfile();
}

export async function getActiveProfileId() {
  const profile = await getActiveProfile();
  return profile ? profile.id : null;
}

export async function updateProfileFields(partial) {
  if (!db) {
    throw new Error('Firestore is not configured.');
  }

  const profileId = await getActiveProfileId();
  if (!profileId) {
    throw new Error('No active profile.');
  }

  const ref = doc(db, 'profiles', profileId);
  await updateDoc(ref, {
    ...partial,
    updatedAt: serverTimestamp(),
  });

  // Keep local cache in sync if we already have it
  if (activeProfile) {
    activeProfile = {
      ...activeProfile,
      ...partial,
    };
  }
}
