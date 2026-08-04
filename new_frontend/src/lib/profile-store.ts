import { useCallback, useEffect, useState } from "react";
import { authApi, type ApiUser } from "./api/auth";
import type { Profile } from "./eligibility";

const TOKEN_KEY = "sahayak.auth.token";
const USER_KEY = "sahayak.auth.user";
const BOOKMARKS_KEY = "sahayak.bookmarks";
// This application starts signed out on every frontend load.  Do not restore
// a token from an earlier user, even when the browser reloads a dashboard URL.
function startFreshSession() {
  if (typeof window === "undefined") return;
  // Routes are code-split, so this module can be evaluated again while the
  // user moves from Login -> Profile -> Results. Clear only on the initial
  // page load, never during in-app navigation.
  if ((window as Window & { __sahayakFreshSessionStarted?: boolean }).__sahayakFreshSessionStarted) return;
  (window as Window & { __sahayakFreshSessionStarted?: boolean }).__sahayakFreshSessionStarted = true;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("sahayak.session");
  localStorage.removeItem("sahayak.accounts");
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

startFreshSession();

type StoredUser = ApiUser & { profile: Profile | null };

function readUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? "null") as StoredUser | null; } catch { return null; }
}

function writeUser(user: ApiUser) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadProfile(): Profile | null { return readUser()?.profile ?? null; }
export function getCurrentUser(): StoredUser | null { return readUser(); }

export async function loginUser(username: string, password: string): Promise<Profile | null> {
  const { token, user } = await authApi.login({ username, password });
  sessionStorage.setItem(TOKEN_KEY, token);
  writeUser(user);
  return user.profile as Profile | null;
}

export async function createAccount(username: string, password: string, phone: string) {
  await authApi.register({ username, password, phone });
  return loginUser(username, password);
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const { user } = await authApi.updateProfile(profile);
  writeUser(user);
  return (user.profile ?? profile) as Profile;
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function useSession() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    const user = readUser();
    if (sessionStorage.getItem(TOKEN_KEY) && user) {
      setProfile(user.profile);
      setIsAuthed(true);
    }
    setHydrated(true);
  }, []);
  return { profile, hydrated, isAuthed };
}

export function useProfile() {
  const { profile, hydrated } = useSession();
  const update = useCallback(async (next: Profile | null) => {
    if (next) await saveProfile(next); else clearProfile();
  }, []);
  return { profile, setProfile: update, hydrated };
}

export function useBookmarks() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { try { setIds(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "[]")); } catch {} }, []);
  const toggle = useCallback((id: string) => setIds(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); return next;
  }), []);
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}
