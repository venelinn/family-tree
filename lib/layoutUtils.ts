// src/lib/layoutUtils.ts

import { Node, Edge, Position } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { PersonNode } from './types';

// Define the expected output structure for the layout utility
export interface LayoutResult {
  // <-- FIX: Exporting the interface
  layoutedNodes: Node[];
  layoutedEdges: Edge[];
}

const nodeWidth = 180;
const nodeHeight = 100;
const ranksep = 100; // Vertical spacing
const nodesep = 100; // Horizontal spacing

/**
 * Calculates the positions for all nodes using the Dagre layout algorithm.
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR',
  peopleMap: Map<string, PersonNode> // Required for spouse/handle logic (though simplified here)
): LayoutResult => {
  const dagreGraph = new dagre.graphlib.Graph();

  // Set up the graph settings
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: ranksep,
    nodesep: nodesep,
    // Setting edgesep to a smaller value helps group marriage units horizontally
    edgesep: nodesep / 2,
  });

  // Set nodes in the graph
  nodes.forEach(node => {
    // Dagre needs explicit dimensions
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Set edges in the graph
  edges.forEach(edge => {
    // Add edges to the graph. Dagre handles the source/target automatically.
    // Ensure that only edges connecting defined nodes are added to prevent Dagre errors.
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // Check if the graph has enough data to layout
  if (dagreGraph.nodeCount() === 0) {
    console.warn('[LAYOUT] Dagre has 0 nodes. Skipping layout.');
    return { layoutedNodes: nodes, layoutedEdges: edges };
  }

  // Run the layout algorithm
  console.log('[LAYOUT] Starting Dagre calculation...');
  try {
    dagre.layout(dagreGraph);
  } catch (error) {
    console.error('[LAYOUT] Dagre Layout Failed (Critical Error):', error);
    // Return unpositioned nodes to prevent a crash
    return { layoutedNodes: nodes, layoutedEdges: edges };
  }
  console.log('[LAYOUT] Dagre calculation complete. Applying positions.');

  // Apply calculated positions to the nodes
  const layoutedNodes: Node[] = nodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // FIX: Safely check for the position data before applying coordinates
    if (!nodeWithPosition || typeof nodeWithPosition.x === 'undefined') {
      console.warn(
        `[LAYOUT] Missing coordinates for node: ${node.id}. Skipping position.`
      );
      return node; // Return the node unpositioned
    }

    // Apply the position calculated by Dagre
    node.position = {
      // Dagre positions the center; React Flow positions the top-left corner.
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    // Set target and source handles for better edge routing
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;

    // For horizontal layouts (Pedigree), swap handle positions
    if (direction === 'LR') {
      node.targetPosition = Position.Left;
      node.sourcePosition = Position.Right;
    }

    // Mark node as successfully layouted
    node.className = 'layouted-node';

    return node;
  });

  // Return the positioned nodes and original edges
  return { layoutedNodes, layoutedEdges: edges };
};
