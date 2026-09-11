import type { Detection, DetectionBox } from "../detection/types";
import type { DetectionFrame } from "../detection/sampledVideoDetection";
import { compareAppearance, updateTrackAppearance } from "./appearance";
import { TRACKER_CONFIG } from "./config";
import type {
  Track,
  TrackedFrame,
  TrackedObservation,
  TrackerConfig,
  TrackingResult,
} from "./types";

export function observationsForPlaybackTime(
  frames: TrackedFrame[],
  playbackTime: number,
  intervalSeconds: number,
) {
  let nearest: TrackedFrame | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    const candidateDistance = Math.abs(frame.time - playbackTime);
    if (candidateDistance < distance) {
      nearest = frame;
      distance = candidateDistance;
    }
  }
  return nearest && distance <= intervalSeconds / 2 ? nearest.observations : [];
}

interface WorkingTrack extends Track {
  missedFrames: number;
}

interface Match {
  trackIndex: number;
  detectionIndex: number;
}

export function trackDetectionFrames(
  frames: DetectionFrame[],
  config: Partial<TrackerConfig> = {},
): TrackingResult {
  const resolved = { ...TRACKER_CONFIG, ...config };
  validateConfig(resolved);
  const tracks: WorkingTrack[] = [];
  const trackedFrames: TrackedFrame[] = [];
  let nextTrackNumber = 1;

  for (const frame of frames) {
    const eligible = tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => track.lifecycle !== "ended");
    const matches = globallyAssign(eligible.map(({ track }) => track), frame.detections, frame.time, resolved);
    const matchedTrackIndexes = new Set<number>();
    const matchedDetectionIndexes = new Set<number>();
    const observations: TrackedObservation[] = [];

    for (const match of matches) {
      const actualTrackIndex = eligible[match.trackIndex].index;
      const track = tracks[actualTrackIndex];
      const detection = frame.detections[match.detectionIndex];
      track.positions.push(positionFrom(detection, frame.time));
      track.confidence = averageConfidence(track.positions);
      if (detection.appearance) {
        track.appearance = updateTrackAppearance(track.appearance, detection.appearance, resolved.appearanceEmaAlpha);
      }
      track.lifecycle = track.positions.length === 1 ? "new" : "active";
      track.missedFrames = 0;
      matchedTrackIndexes.add(actualTrackIndex);
      matchedDetectionIndexes.add(match.detectionIndex);
      observations.push({ ...detection, trackId: track.trackId, lifecycle: track.lifecycle });
    }

    for (const { track, index } of eligible) {
      if (matchedTrackIndexes.has(index)) continue;
      track.missedFrames += 1;
      track.lifecycle = track.missedFrames > resolved.lostWindowFrames ? "ended" : "temporarily_lost";
    }

    let liveTracks = tracks.filter((track) => track.lifecycle !== "ended").length;
    for (let detectionIndex = 0; detectionIndex < frame.detections.length; detectionIndex += 1) {
      if (matchedDetectionIndexes.has(detectionIndex) || liveTracks >= resolved.maxTracks) continue;
      const detection = frame.detections[detectionIndex];
      const track: WorkingTrack = {
        trackId: `track_${String(nextTrackNumber).padStart(3, "0")}`,
        category: detection.category,
        confidence: detection.confidence,
        lifecycle: "new",
        positions: [positionFrom(detection, frame.time)],
        appearance: detection.appearance
          ? updateTrackAppearance(null, detection.appearance, resolved.appearanceEmaAlpha)
          : undefined,
        missedFrames: 0,
      };
      nextTrackNumber += 1;
      liveTracks += 1;
      tracks.push(track);
      observations.push({ ...detection, trackId: track.trackId, lifecycle: "new" });
    }

    const observationOrder = new Map(frame.detections.map((detection, index) => [detection.detectionId, index]));
    observations.sort((left, right) => (observationOrder.get(left.detectionId) ?? 0) - (observationOrder.get(right.detectionId) ?? 0));
    trackedFrames.push({ time: frame.time, observations, inferenceMs: frame.inferenceMs });
  }

  return {
    frames: trackedFrames,
    tracks: tracks.map((track) => ({
      trackId: track.trackId,
      category: track.category,
      confidence: track.confidence,
      lifecycle: track.lifecycle,
      positions: track.positions,
      appearance: track.appearance,
    })),
  };
}

function globallyAssign(
  tracks: WorkingTrack[],
  detections: Detection[],
  time: number,
  config: TrackerConfig,
): Match[] {
  if (tracks.length === 0 || detections.length === 0) return [];
  const invalidCost = config.maximumMatchCost + 10;
  const costs = tracks.map((track) => [
    ...detections.map((detection) => {
      const cost = matchCost(track, detection, time, config);
      return cost !== null && cost <= config.maximumMatchCost ? cost : invalidCost;
    }),
    ...tracks.map(() => config.maximumMatchCost),
  ]);
  const assignment = minimumCostAssignment(costs);
  return assignment.flatMap((column, trackIndex) => (
    column < detections.length && costs[trackIndex][column] < config.maximumMatchCost
      ? [{ trackIndex, detectionIndex: column }]
      : []
  ));
}

/** Hungarian assignment for a short row set and any detector output width. */
function minimumCostAssignment(costs: number[][]) {
  const rowCount = costs.length;
  const columnCount = costs[0].length;
  const rowPotential = Array(rowCount + 1).fill(0);
  const columnPotential = Array(columnCount + 1).fill(0);
  const matchedRow = Array(columnCount + 1).fill(0);
  const predecessor = Array(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    matchedRow[0] = row;
    const minimum = Array(columnCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = Array(columnCount + 1).fill(false);
    let column = 0;
    do {
      used[column] = true;
      const currentRow = matchedRow[column];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) continue;
        const reducedCost = costs[currentRow - 1][candidate - 1] - rowPotential[currentRow] - columnPotential[candidate];
        if (reducedCost < minimum[candidate]) {
          minimum[candidate] = reducedCost;
          predecessor[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) {
          rowPotential[matchedRow[candidate]] += delta;
          columnPotential[candidate] -= delta;
        } else {
          minimum[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (matchedRow[column] !== 0);

    do {
      const previousColumn = predecessor[column];
      matchedRow[column] = matchedRow[previousColumn];
      column = previousColumn;
    } while (column !== 0);
  }

  const assignment = Array(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (matchedRow[column] > 0) assignment[matchedRow[column] - 1] = column - 1;
  }
  return assignment;
}

function matchCost(track: WorkingTrack, detection: Detection, time: number, config: TrackerConfig) {
  if (track.category !== detection.category) return null;
  const predicted = predictBox(track, time);
  const distance = normalizedCenterDistance(predicted, detection.box);
  if (distance > config.maximumCenterDistance) return null;
  const overlap = intersectionOverUnion(predicted, detection.box);
  const direction = directionPenalty(track, detection.box);
  const spatialCost = (1 - overlap) * 0.5 + Math.min(distance, 1) * 0.35 + direction * 0.15;
  const appearanceCost = compareAppearance(track.appearance, detection.appearance);
  return appearanceCost === null
    ? spatialCost
    : spatialCost * (1 - config.appearanceWeight) + appearanceCost * config.appearanceWeight;
}

function predictBox(track: WorkingTrack, time: number): DetectionBox {
  const last = track.positions.at(-1)!;
  const previous = track.positions.at(-2);
  if (!previous || last.time === previous.time) return { ...last.box };
  const elapsed = time - last.time;
  const observedElapsed = last.time - previous.time;
  return {
    ...last.box,
    x: last.box.x + ((last.box.x - previous.box.x) / observedElapsed) * elapsed,
    y: last.box.y + ((last.box.y - previous.box.y) / observedElapsed) * elapsed,
  };
}

function directionPenalty(track: WorkingTrack, next: DetectionBox) {
  const last = track.positions.at(-1);
  const previous = track.positions.at(-2);
  if (!last || !previous) return 0;
  const prior = centerDelta(previous.box, last.box);
  const candidate = centerDelta(last.box, next);
  const priorLength = Math.hypot(prior.x, prior.y);
  const candidateLength = Math.hypot(candidate.x, candidate.y);
  if (priorLength === 0 || candidateLength === 0) return 0;
  const cosine = (prior.x * candidate.x + prior.y * candidate.y) / (priorLength * candidateLength);
  return (1 - cosine) / 2;
}

function centerDelta(from: DetectionBox, to: DetectionBox) {
  return {
    x: to.x + to.width / 2 - (from.x + from.width / 2),
    y: to.y + to.height / 2 - (from.y + from.height / 2),
  };
}

function normalizedCenterDistance(left: DetectionBox, right: DetectionBox) {
  const delta = centerDelta(left, right);
  const scale = Math.max(1, (Math.hypot(left.width, left.height) + Math.hypot(right.width, right.height)) / 2);
  return Math.hypot(delta.x, delta.y) / scale;
}

function intersectionOverUnion(left: DetectionBox, right: DetectionBox) {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function positionFrom(detection: Detection, time: number) {
  return { time, detectionId: detection.detectionId, box: { ...detection.box }, confidence: detection.confidence };
}

function averageConfidence(positions: Track["positions"]) {
  return positions.reduce((sum, position) => sum + position.confidence, 0) / positions.length;
}

function validateConfig(config: TrackerConfig) {
  if (!Number.isInteger(config.lostWindowFrames) || config.lostWindowFrames < 0) throw new Error("lost window 必须是非负整数");
  if (!Number.isInteger(config.maxTracks) || config.maxTracks <= 0 || config.maxTracks > 30) throw new Error("主体数量上限必须是 1 到 30");
  if (config.appearanceWeight < 0 || config.appearanceWeight > 1) throw new Error("外观权重必须在 0 到 1 之间");
  if (config.appearanceEmaAlpha <= 0 || config.appearanceEmaAlpha > 1) throw new Error("外观 EMA 系数必须大于 0 且不超过 1");
}
