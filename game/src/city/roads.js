// The road network as a graph: intersections (nodes) joined by road segments with lanes.
// Traffic follows lane lines, police plan routes over the nodes, and signals take turns.
import { LANE_W, SIDEWALK_W } from '../core/config.js';
import { V_ROADS, H_ROADS, NV, NH, RIVER_ROW, BRIDGE_COLS, halfWidth } from './layout.js';

export function buildRoadNetwork() {
  const nodes = [];
  const segs = [];
  for (let j = 0; j < NH; j++) {
    for (let i = 0; i < NV; i++) {
      nodes.push({
        id: j * NV + i, i, j, x: V_ROADS[i].x, y: H_ROADS[j].y,
        hx: halfWidth(V_ROADS[i]), hy: halfWidth(H_ROADS[j]), links: [], signal: false, phase: (i * 3 + j * 5) % 4,
      });
    }
  }
  const link = (a, b, seg) => {
    seg.id = segs.length;
    seg.a = a.id;
    seg.b = b.id;
    segs.push(seg);
    a.links.push({ seg, to: b.id, dir: 1 });
    b.links.push({ seg, to: a.id, dir: -1 });
  };
  for (let j = 0; j < NH; j++) {
    for (let i = 0; i < NV - 1; i++) {
      const a = nodes[j * NV + i];
      const b = nodes[j * NV + i + 1];
      link(a, b, { horiz: true, lanes: H_ROADS[j].lanes, hw: a.hy, name: H_ROADS[j].name, x1: a.x + a.hx, x2: b.x - b.hx, y1: a.y, y2: a.y, bridge: false });
    }
  }
  for (let i = 0; i < NV; i++) {
    for (let j = 0; j < NH - 1; j++) {
      if (j === RIVER_ROW && !BRIDGE_COLS.includes(i)) continue;
      const a = nodes[j * NV + i];
      const b = nodes[(j + 1) * NV + i];
      link(a, b, { horiz: false, lanes: V_ROADS[i].lanes, hw: a.hx, name: V_ROADS[i].name, x1: a.x, x2: a.x, y1: a.y + a.hy, y2: b.y - b.hy, bridge: j === RIVER_ROW });
    }
  }
  for (const n of nodes) n.signal = n.links.length >= 3 && (n.hx > LANE_W || n.hy > LANE_W);
  return { nodes, segs };
}

/** The centre line of one lane: travelling a -> b (dir 1) keeps to the right-hand side. */
export function laneLine(seg, dir, lane) {
  const off = (Math.min(lane, seg.lanes - 1) + 0.5) * LANE_W;
  if (seg.horiz) {
    return dir > 0
      ? { sx: seg.x1, sy: seg.y1 + off, ex: seg.x2, ey: seg.y1 + off, dx: 1, dy: 0 }
      : { sx: seg.x2, sy: seg.y1 - off, ex: seg.x1, ey: seg.y1 - off, dx: -1, dy: 0 };
  }
  return dir > 0
    ? { sx: seg.x1 - off, sy: seg.y1, ex: seg.x1 - off, ey: seg.y2, dx: 0, dy: 1 }
    : { sx: seg.x1 + off, sy: seg.y2, ex: seg.x1 + off, ey: seg.y1, dx: 0, dy: -1 };
}

export function nearestNode(roads, x, y) {
  let best = roads.nodes[0];
  let bestD = Infinity;
  for (const n of roads.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Breadth-first route between two node ids, as a list of node ids (both ends included). */
export function findPath(roads, from, to) {
  if (from === to) return [from];
  const prev = new Int16Array(roads.nodes.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  for (let q = 0; q < queue.length; q++) {
    const n = roads.nodes[queue[q]];
    for (const l of n.links) {
      if (prev[l.to] !== -1) continue;
      prev[l.to] = n.id;
      if (l.to === to) {
        const path = [to];
        let at = to;
        while (at !== from) {
          at = prev[at];
          path.push(at);
        }
        return path.reverse();
      }
      queue.push(l.to);
    }
  }
  return [from];
}

/** The light an approach sees: 'green', 'yellow' or 'red'. East-west and north-south take turns. */
export function signalState(node, horiz, time) {
  if (!node.signal) return 'green';
  let t = (time + node.phase * 4) % 16;
  if (!horiz) t = (t + 8) % 16;
  return t < 6 ? 'green' : t < 7.5 ? 'yellow' : 'red';
}

/** The road under a point, as { name, horiz }, or null. Sidewalks count when `withSidewalk` is set. */
export function roadAt(x, y, withSidewalk = false) {
  const extra = withSidewalk ? SIDEWALK_W : 0;
  const x0 = V_ROADS[0].x - halfWidth(V_ROADS[0]) - extra;
  const x1 = V_ROADS[NV - 1].x + halfWidth(V_ROADS[NV - 1]) + extra;
  const y0 = H_ROADS[0].y - halfWidth(H_ROADS[0]) - extra;
  const y1 = H_ROADS[NH - 1].y + halfWidth(H_ROADS[NH - 1]) + extra;
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  for (const r of H_ROADS) if (Math.abs(y - r.y) <= halfWidth(r) + extra) return { name: r.name, horiz: true };
  for (let i = 0; i < NV; i++) {
    const r = V_ROADS[i];
    if (Math.abs(x - r.x) > halfWidth(r) + extra) continue;
    const inRiver = y > H_ROADS[RIVER_ROW].y && y < H_ROADS[RIVER_ROW + 1].y;
    if (inRiver && !BRIDGE_COLS.includes(i)) return null;
    return { name: r.name, horiz: false };
  }
  return null;
}

/** Position of the intersection of avenue i and street j. */
export function nodeAt(roads, i, j) {
  return roads.nodes[j * NV + i];
}
