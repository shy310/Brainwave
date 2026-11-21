// Concept maps: a lecture's main ideas and how they connect, drawn as a
// diagram. The AI writes the nodes and links; the layout is computed here
// (pure, deterministic, tested).
import { z } from 'zod';

export const ConceptMapSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1).max(40),
    label: z.string().min(1).max(60),
    /** "main" is the lecture's topic (one), "concept" a key idea, "detail" an example or fact. */
    kind: z.enum(['main', 'concept', 'detail']),
    /** One sentence about it, shown when the node is tapped. */
    note: z.string().max(240).default(''),
  })).min(3).max(24),
  edges: z.array(z.object({
    from: z.string().max(40),
    to: z.string().max(40),
    /** How they relate, a few words ("is a", "causes", "used for"). */
    label: z.string().max(40).default(''),
  })).max(40),
});
export type ConceptMap = z.infer<typeof ConceptMapSchema>;

export const ConceptMapInputSchema = z.object({
  title: z.string().max(200).optional(),
  /** The notes (or transcript) as plain text. */
  text: z.string().min(20).max(30_000),
});

/**
 * Tidy what the AI wrote: unique node ids, exactly one main node (the first,
 * or the best-connected), links only between existing nodes, no duplicates
 * or self-links, and every node reachable (strays get linked to the main).
 */
export const cleanMap = (m: ConceptMap): ConceptMap => {
  const seen = new Set<string>();
  const nodes = m.nodes.filter((n) => !seen.has(n.id) && seen.add(n.id));
  const edges: ConceptMap['edges'] = [];
  const pair = new Set<string>();
  for (const e of m.edges) {
    const key = [e.from, e.to].sort().join('|');
    if (e.from === e.to || !seen.has(e.from) || !seen.has(e.to) || pair.has(key)) continue;
    pair.add(key);
    edges.push(e);
  }
  const degree = (id: string) => edges.filter((e) => e.from === id || e.to === id).length;
  const main = nodes.find((n) => n.kind === 'main') ?? [...nodes].sort((a, b) => degree(b.id) - degree(a.id))[0];
  const fixed = nodes.map((n) => ({ ...n, kind: n.id === main.id ? 'main' as const : n.kind === 'main' ? 'concept' as const : n.kind }));
  // Link anything not connected to the main idea's component.
  const reach = new Set([main.id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of edges) {
      if (reach.has(e.from) && !reach.has(e.to)) { reach.add(e.to); grew = true; }
      if (reach.has(e.to) && !reach.has(e.from)) { reach.add(e.from); grew = true; }
    }
  }
  for (const n of fixed) if (!reach.has(n.id)) { edges.push({ from: main.id, to: n.id, label: '' }); reach.add(n.id); }
  return { nodes: fixed, edges };
};

export interface Placed { id: string; x: number; y: number; ring: number }

/**
 * Where each node goes: the main idea in the middle, its direct links on a
 * ring around it, the rest on outer rings next to what they hang from.
 * Children share their parent's slice of the circle, so branches don't cross.
 */
export const layoutMap = (m: ConceptMap, ringGap = 190): Placed[] => {
  const main = m.nodes.find((n) => n.kind === 'main') ?? m.nodes[0];
  const adj = new Map(m.nodes.map((n) => [n.id, [] as string[]]));
  for (const e of m.edges) { adj.get(e.from)?.push(e.to); adj.get(e.to)?.push(e.from); }
  // Breadth-first tree from the main idea.
  const parent = new Map<string, string | null>([[main.id, null]]);
  const ring = new Map<string, number>([[main.id, 0]]);
  const queue = [main.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const nb of adj.get(id) ?? []) if (!parent.has(nb)) { parent.set(nb, id); ring.set(nb, ring.get(id)! + 1); queue.push(nb); }
  }
  for (const n of m.nodes) if (!parent.has(n.id)) { parent.set(n.id, main.id); ring.set(n.id, 1); }
  const children = new Map<string, string[]>();
  for (const [id, p] of parent) if (p) children.set(p, [...(children.get(p) ?? []), id]);
  // Each subtree gets a share of the angle in proportion to its number of leaves.
  const leaves = (id: string): number => { const c = children.get(id) ?? []; return c.length ? c.reduce((s, x) => s + leaves(x), 0) : 1; };
  const out: Placed[] = [{ id: main.id, x: 0, y: 0, ring: 0 }];
  const place = (id: string, from: number, to: number) => {
    const kids = children.get(id) ?? [];
    const total = kids.reduce((s, k) => s + leaves(k), 0) || 1;
    let a = from;
    for (const k of kids) {
      const span = ((to - from) * leaves(k)) / total;
      const mid = a + span / 2;
      const r = ring.get(k)! * ringGap;
      out.push({ id: k, x: Math.round(Math.cos(mid) * r), y: Math.round(Math.sin(mid) * r), ring: ring.get(k)! });
      place(k, a, a + span);
      a += span;
    }
  };
  place(main.id, -Math.PI / 2, (3 * Math.PI) / 2);
  return out;
};
