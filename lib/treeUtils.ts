// src/lib/treeUtils.ts

import { PersonNode, D3Node } from './types';

// Global Fallback Node (must match your D3Node interface)
const UNKNOWN_NODE: D3Node = {
  name: 'Unknown',
  attributes: { id: 'unknown', sex: 'M', born: 'N/A', died: 'N/A' },
  children: [],
};

/**
 * Builds the focused Descendant Tree structure with Spouses added as siblings
 * to the children for a clean Genogram-like view.
 */
export const createVisualTree = (
  // <-- This is the function we will use
  peopleMap: Map<string, PersonNode>,
  personId: string,
  currentDepth: number = 0,
  maxDepth: number = 3
): D3Node => {
  const person = peopleMap.get(personId);
  if (!person) return UNKNOWN_NODE;

  const node: D3Node = {
    name: person.name,
    attributes: {
      id: person.id,
      sex: person.sex,
      born: person.birthDate,
      died: person.deathDate,
    },
    children: [],
  };

  if (currentDepth < maxDepth) {
    // 1. ADD SPOUSE(S) AS SIBLING NODES (The Horizontal Hack)
    for (const spouseId of person.spouseIds) {
      const spouse = peopleMap.get(spouseId);
      if (spouse) {
        const spouseNode: D3Node = {
          name: `${spouse.name} (Spouse)`,
          attributes: {
            id: spouse.id,
            sex: spouse.sex,
            born: spouse.birthDate,
            died: spouse.deathDate,
          },
          children: [],
        };
        node.children.push(spouseNode);
        break; // Only take the first spouse for clean display.
      }
    }

    // 2. ADD CHILDREN/DESCENDANTS (The Vertical Path)
    for (const childId of person.childrenIds) {
      node.children.push(
        createVisualTree(peopleMap, childId, currentDepth + 1, maxDepth)
      );
    }
  }

  return node;
};
