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
  return { ...settings, [trackId]: { ...current, ...patch, trackId } };
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
