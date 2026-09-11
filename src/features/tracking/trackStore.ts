import type { Track, TrackedObservation, UserTrackSettings } from "./types";

export type UserTrackSettingsMap = Record<string, UserTrackSettings>;

export interface DisplayTrackObservation extends TrackedObservation {
  labelZh: string;
  labelEn: string;
}

export function createUserTrackSettings(
  tracks: Track[],
  current: UserTrackSettingsMap,
): UserTrackSettingsMap {
  const next = { ...current };
  const categoryTotals = countCategories(tracks);
  const categoryIndexes = new Map<string, number>();

  for (const track of tracks) {
    const index = (categoryIndexes.get(track.category) ?? 0) + 1;
    categoryIndexes.set(track.category, index);
    if (next[track.trackId]) continue;
    const categoryName = categoryLabel(track.category);
    next[track.trackId] = {
      trackId: track.trackId,
      labelZh: categoryTotals.get(track.category)! > 1 ? `${categoryName} ${index}` : categoryName,
      labelEn: "",
      nameEdited: false,
      visible: true,
      deleted: false,
    };
  }

  return next;
}

export function updateUserTrackSettings(
  settings: UserTrackSettingsMap,
  trackId: string,
  patch: Partial<Omit<UserTrackSettings, "trackId">>,
): UserTrackSettingsMap {
  const current = settings[trackId];
  if (!current) throw new Error(`找不到主体设置：${trackId}`);
  const nameEdited = patch.labelZh === undefined ? current.nameEdited : patch.nameEdited ?? true;
  return { ...settings, [trackId]: { ...current, ...patch, nameEdited, trackId } };
}

export function updateManyUserTrackSettings(
  settings: UserTrackSettingsMap,
  trackIds: readonly string[],
  patch: Partial<Omit<UserTrackSettings, "trackId">>,
): UserTrackSettingsMap {
  return trackIds.reduce(
    (current, trackId) => updateUserTrackSettings(current, trackId, patch),
    settings,
  );
}

export function copyPreviousTrackName(
  settings: UserTrackSettingsMap,
  previousTrackId: string,
  trackId: string,
): UserTrackSettingsMap {
  const previous = settings[previousTrackId];
  if (!previous) throw new Error(`找不到上一主体设置：${previousTrackId}`);
  return updateUserTrackSettings(settings, trackId, { labelZh: previous.labelZh });
}

export function nextTrackId(trackIds: readonly string[], currentTrackId: string) {
  const index = trackIds.indexOf(currentTrackId);
  return index >= 0 && index + 1 < trackIds.length ? trackIds[index + 1] : null;
}

export function autoNumberUserTrackSettings(
  tracks: readonly Track[],
  settings: UserTrackSettingsMap,
): UserTrackSettingsMap {
  const categoryIndexes = new Map<string, number>();
  let next = settings;
  for (const track of tracks) {
    const setting = next[track.trackId];
    if (!setting || setting.deleted) continue;
    const index = (categoryIndexes.get(track.category) ?? 0) + 1;
    categoryIndexes.set(track.category, index);
    if (setting.nameEdited) continue;
    next = updateUserTrackSettings(next, track.trackId, {
      labelZh: `${categoryLabel(track.category)}${index}`,
      nameEdited: false,
    });
  }
  return next;
}

export function applyUserTrackSettings(
  observations: TrackedObservation[],
  settings: UserTrackSettingsMap,
): DisplayTrackObservation[] {
  return observations.flatMap((observation) => {
    const setting = settings[observation.trackId];
    if (!setting || !setting.visible || setting.deleted) return [];
    return [{ ...observation, labelZh: setting.labelZh, labelEn: setting.labelEn }];
  });
}

function countCategories(tracks: Track[]) {
  const counts = new Map<string, number>();
  for (const track of tracks) counts.set(track.category, (counts.get(track.category) ?? 0) + 1);
  return counts;
}

export function categoryLabel(category: string) {
  if (category === "person") return "人物";
  if (category === "bird") return "鸟";
  if (category === "car") return "汽车";
  return category;
}
