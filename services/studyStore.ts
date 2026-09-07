import type { StudyLibrary } from "./studyTypes";

const empty = (): StudyLibrary => ({
  version: 1,
  sets: [],
  sprints: [],
  importedLegacyIds: [],
});
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("brainwave-study-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("profiles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error("Close other Brainwave tabs and retry."));
  });
}
export async function loadLibrary(ownerId: string): Promise<StudyLibrary> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction("profiles")
        .objectStore("profiles")
        .get(ownerId);
      req.onsuccess = () => {
        const value = req.result as StudyLibrary | undefined;
        if (
          value &&
          (value.version !== 1 ||
            !Array.isArray(value.sets) ||
            !Array.isArray(value.sprints) ||
            !Array.isArray(value.importedLegacyIds) ||
            value.sets.some((s) => s.ownerId !== ownerId) ||
            value.sprints.some((s) => s.ownerId !== ownerId))
        )
          return reject(
            new Error(
              "Stored library could not be read. Your original data is preserved.",
            ),
          );
        resolve(value ?? empty());
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function saveLibrary(ownerId: string, library: StudyLibrary) {
  if (
    library.sets.some((s) => s.ownerId !== ownerId) ||
    library.sprints.some((s) => s.ownerId !== ownerId)
  )
    throw new Error("Profile mismatch");
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("profiles", "readwrite");
      tx.objectStore("profiles").put(library, ownerId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Storage interrupted"));
    });
  } finally {
    db.close();
  }
}
export function legacyNotes(): { id: string; title: string; notes: string }[] {
  try {
    const raw = JSON.parse(localStorage.getItem("brainwave_notes_v1") ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (n) =>
          n &&
          typeof n.id === "string" &&
          n.note &&
          Array.isArray(n.note.sections),
      )
      .map((n) => ({
        id: n.id,
        title: String(n.title ?? n.note.title ?? "Notes"),
        notes: n.note.sections
          .map(
            (s: { title?: string; content?: string }) =>
              `${s.title ?? ""}\n${s.content ?? ""}`,
          )
          .join("\n\n"),
      }));
  } catch {
    return [];
  }
}
