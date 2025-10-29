import type { Edge, Node } from 'reactflow';
import type { Family, ProcessedIndividual } from '../types/types';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const HORIZONTAL_SPACING = 40;
const VERTICAL_SPACING = 100;

export const generateLayoutedElements = (
  individuals: Map<string, ProcessedIndividual>,
  families: Map<string, Family>,
  rootId: string
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  const familyUnionPositions = new Map<string, { x: number; y: number }>();

  // Step 1: Build generation levels starting from the root
  const levels: Map<number, string[]> = new Map();
  const visited = new Set<string>();

  const queue: Array<{ id: string; level: number }> = [
    { id: rootId, level: 0 },
  ];

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (!levels.has(level)) levels.set(level, []);
    levels.get(level)!.push(id);

    // Add children if any
    const familiesWithParent = Array.from(families.values()).filter(
      f => f.Husband === id || f.Wife === id
    );

    for (const fam of familiesWithParent) {
      const children = Array.isArray(fam.Children)
        ? fam.Children
        : fam.Children
        ? [fam.Children]
        : [];

      children.forEach(childId => {
        queue.push({ id: childId, level: level + 1 });
      });
    }
  }

  // Step 2: Position nodes per generation
  for (const [level, ids] of levels.entries()) {
    const y = level * (NODE_HEIGHT + VERTICAL_SPACING);
    ids.forEach((id, index) => {
      const x = index * (NODE_WIDTH + HORIZONTAL_SPACING);
      positions.set(id, { x, y });
    });
  }

  // Step 3: Create nodes
  for (const [id, pos] of positions) {
    const individual = individuals.get(id);
    if (individual) {
      nodes.push({
        id,
        type: 'person',
        data: { person: individual },
        position: pos,
      });
    }
  }

  // Step 4: Add family union nodes dynamically
  for (const family of families.values()) {
    const parents = [family.Husband, family.Wife].filter(Boolean);
    if (parents.length === 0) continue;

    const parentPositions = parents.map(p => positions.get(p!)).filter(Boolean);
    if (parentPositions.length === 0) continue;

    const avgX =
      parentPositions.reduce((a, b) => a + b.x, 0) / parentPositions.length;
    const avgY =
      (parentPositions[0]?.y ?? 0) + NODE_HEIGHT + VERTICAL_SPACING / 2;

    const unionId = `union-${family.Id}`;
    familyUnionPositions.set(family.Id, { x: avgX, y: avgY });

    nodes.push({
      id: unionId,
      position: { x: avgX, y: avgY },
      style: { width: 1, height: 1, opacity: 0 },
      data: {},
      draggable: false,
    });

    // parent → union edges
    parents.forEach(parentId => {
      edges.push({
        id: `e-${parentId}-${unionId}`,
        source: parentId!,
        target: unionId,
        sourceHandle: 'bottom',
        type: 'smoothstep',
        style: { stroke: '#6b7280', strokeWidth: 1.5 },
      });
    });

    // union → children edges
    const children = Array.isArray(family.Children)
      ? family.Children
      : family.Children
      ? [family.Children]
      : [];

    children.forEach(childId => {
      edges.push({
        id: `e-${unionId}-${childId}`,
        source: unionId,
        target: childId,
        targetHandle: 'top',
        type: 'smoothstep',
        style: { stroke: '#6b7280', strokeWidth: 1.5 },
      });
    });
  }

  return { nodes, edges };
};
