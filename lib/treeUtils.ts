// src/lib/treeUtils.ts

import { PersonNode, D3Node } from './types';

// Global Fallback Node (must match your D3Node interface)
const UNKNOWN_NODE: D3Node = {
  name: 'Unknown',
  attributes: { id: 'unknown', sex: 'M', born: 'N/A', died: 'N/A' },
  children: [],
};

function createNode(person: PersonNode): D3Node {
  return {
    name: person.name,
    attributes: {
      id: person.id,
      sex: person.sex,
      born: person.birthDate,
      died: person.deathDate,
    },
    children: [],
  };
}

/**
 * 1. Family View: Builds the Descendant Tree (Vertical)
 * Includes Spouses as sibling nodes to children.
 */
export const createFamilyTree = (
  peopleMap: Map<string, PersonNode>,
  personId: string,
  currentDepth: number = 0,
  maxDepth: number = 3
): D3Node => {
  const person = peopleMap.get(personId);
  if (!person) return UNKNOWN_NODE;
  console.log('currentDepth', currentDepth);

  const node = createNode(person);

  if (currentDepth < maxDepth) {
    // --- LOGIC 1: Insert Parents/Ancestors (The MyHeritage Top Half) ---

    // This logic will run for Venelin to connect him to Nikola and Elena.
    // It will also run for Lea to connect her to Venelin and Veselina.

    if (person.parentIds.length > 0) {
      // Find the Family ID that links the parents (requires looping, but for simplicity,
      // we'll assume the primary parent relationship is the first set).

      const fatherId = person.parentIds[0];
      const motherId = person.parentIds[1];

      const father = peopleMap.get(fatherId);
      const mother = peopleMap.get(motherId);

      if (father && mother) {
        // The D3 hack: Create a VIRTUAL NODE for the marriage.
        // All parents attach to this virtual node, and the current person (child)
        // attaches below it.

        const marriageNode: D3Node = {
          name: `Family: ${father.name} & ${mother.name}`,
          attributes: { id: `MARRIAGE-${fatherId}-${motherId}`, sex: 'M' },
          children: [], // This will hold the PARENTS
          // Set to collapsed by default for deep ancestors
          // __rd3t: { collapsed: true }
        };

        // Add the parents as children of the marriage node (horizontal link hack)
        marriageNode.children.push(
          createNode(father), // Convert PersonNode to D3Node
          createNode(mother) // Convert PersonNode to D3Node
        );

        // Now, attach the VIRTUAL MARRIAGE NODE as a child of the CURRENT PERSON.
        // This creates the line you need (Child -> Marriage Node -> Parents).
        node.children.push(marriageNode);
      }
    }

    // --- LOGIC 2: Add Spouses and Descendants (The MyHeritage Bottom Half) ---

    // This remains your existing logic for progeny.

    // A. Add SPOUSE(S) as siblings (Horizontal Link Hack)
    for (const spouseId of person.spouseIds) {
      // ... (your existing spouse logic) ...
    }

    // B. ADD CHILDREN/DESCENDANTS (Correct Vertical Path)
    for (const childId of person.childrenIds) {
      if (childId !== personId) {
        // Check that the child is not referencing the current node
        node.children.push(
          createFamilyTree(peopleMap, childId, currentDepth + 1, maxDepth)
        );
      }
    }
  }
  return node;
};

/**
 * 2. Pedigree View: Builds the Ancestor Tree (Horizontal)
 * Children array holds the PARENTS.
 */
export const createPedigreeTree = (
  peopleMap: Map<string, PersonNode>,
  personId: string,
  currentDepth: number = 0,
  maxDepth: number = 4
): D3Node => {
  const person = peopleMap.get(personId);
  if (!person) return UNKNOWN_NODE;

  const node = createNode(person);

  if (currentDepth < maxDepth) {
    // Follow PARENT IDs (Standard Recursion UP)
    for (const parentId of person.parentIds) {
      node.children.push(
        createPedigreeTree(peopleMap, parentId, currentDepth + 1, maxDepth)
      );
    }
  }
  return node;
};
