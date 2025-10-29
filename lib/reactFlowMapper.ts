// src/lib/reactFlowMapper.ts
import { PersonNode } from './types';
import { Node, Edge, Position } from 'reactflow';
import React from 'react'; // For CSSProperties

// --- 1. Define Core Family IDs ---
// Replace these with the actual IDs from your data
const ME_ID = '@I85@';
const WIFE_ID = '@I129@';
const DAUGHTER_ID = '@I123@';
const FATHER_ID = '@I63@';
const MOTHER_ID = '@I69@';
const SISTER_ID = '@I125@'; // Assuming this is Sonia's ID

const CORE_FAMILY_IDS = new Set([
  ME_ID,
  WIFE_ID,
  DAUGHTER_ID,
  FATHER_ID,
  MOTHER_ID,
  SISTER_ID,
]);

// --- 2. Define Layout Constants ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;
const HORIZONTAL_SPACING = 50; // Gap between horizontal nodes (Me/Wife, Parents)
const VERTICAL_SPACING = 80; // Gap between generations

// --- 3. Positioning Calculations ---
// Center point calculations (adjust as needed for your canvas size)
const CENTER_X = 400;
const ME_Y = 200; // Your generation level

const PARENT_Y = ME_Y - NODE_HEIGHT - VERTICAL_SPACING;
const CHILD_Y = ME_Y + NODE_HEIGHT + VERTICAL_SPACING;

const FATHER_X = CENTER_X - NODE_WIDTH / 2 - HORIZONTAL_SPACING / 2;
const MOTHER_X = CENTER_X + NODE_WIDTH / 2 + HORIZONTAL_SPACING / 2;

const ME_X = CENTER_X - NODE_WIDTH / 2 - HORIZONTAL_SPACING / 2; // Position slightly left
const SISTER_X = ME_X - NODE_WIDTH - HORIZONTAL_SPACING; // Sister to the left of you
const WIFE_X = CENTER_X + NODE_WIDTH / 2 + HORIZONTAL_SPACING / 2; // Position slightly right

const DAUGHTER_X = CENTER_X; // Centered below marriage line

// --- 4. Function to generate unique IDs for edges ---
let edgeIdCounter = 0;
const getUniqueEdgeId = () => `e-${edgeIdCounter++}`;

interface ReactFlowData {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Maps ONLY the core family members to manually positioned React Flow nodes and edges.
 */
export function mapCoreFamilyToFlowElements(
  peopleMap: Map<string, PersonNode>
): ReactFlowData {
  edgeIdCounter = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Filter the map to only include core family members
  const coreFamilyMap = new Map<string, PersonNode>();
  CORE_FAMILY_IDS.forEach(id => {
    if (peopleMap.has(id)) {
      coreFamilyMap.set(id, peopleMap.get(id)!);
    }
  });

  // --- 5. Create Nodes with Manual Positions ---
  coreFamilyMap.forEach((person, id) => {
    let position = { x: 0, y: 0 };
    switch (id) {
      case ME_ID:
        position = { x: ME_X, y: ME_Y };
        break;
      case WIFE_ID:
        position = { x: WIFE_X, y: ME_Y };
        break;
      case DAUGHTER_ID:
        position = { x: DAUGHTER_X, y: CHILD_Y };
        break;
      case FATHER_ID:
        position = { x: FATHER_X, y: PARENT_Y };
        break;
      case MOTHER_ID:
        position = { x: MOTHER_X, y: PARENT_Y };
        break;
      case SISTER_ID:
        position = { x: SISTER_X, y: ME_Y };
        break;
      default:
        position = { x: Math.random() * 400, y: Math.random() * 400 }; // Fallback
    }

    nodes.push({
      id: person.id,
      type: 'personNode', // Use your custom node type
      position: position,
      data: { ...person },
      // Style removed, handled by CustomPersonNode
    });
  });

  // --- 6. Create Edges ONLY between Core Members ---
  const addEdge = (
    source: string,
    target: string,
    type: string = 'smoothstep',
    style: React.CSSProperties = {},
    sourceHandle = 'bottom',
    targetHandle = 'top'
  ) => {
    // Only add edge if both nodes exist in our core set
    if (CORE_FAMILY_IDS.has(source) && CORE_FAMILY_IDS.has(target)) {
      edges.push({
        id: getUniqueEdgeId(),
        source,
        target,
        type,
        style,
        sourceHandle,
        targetHandle,
      });
    }
  };

  // Parent -> Child edges
  addEdge(FATHER_ID, ME_ID);
  addEdge(MOTHER_ID, ME_ID);
  addEdge(FATHER_ID, SISTER_ID);
  addEdge(MOTHER_ID, SISTER_ID);

  // Marriage edges (horizontal)
  addEdge(
    FATHER_ID,
    MOTHER_ID,
    'straight',
    { stroke: '#4B5563', strokeDasharray: '5 5' },
    'right',
    'left'
  );
  addEdge(
    ME_ID,
    WIFE_ID,
    'straight',
    { stroke: '#4B5563', strokeDasharray: '5 5' },
    'right',
    'left'
  );

  // Child -> Parent (actually Parent -> Child visually)
  addEdge(ME_ID, DAUGHTER_ID);
  addEdge(WIFE_ID, DAUGHTER_ID); // Add edge from wife to daughter too

  console.log(
    `[MAPPER - CORE] Nodes Found: ${nodes.length}, Edges Found: ${edges.length}`
  );
  return { nodes, edges };
}
