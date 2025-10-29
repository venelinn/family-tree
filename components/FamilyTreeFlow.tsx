// src/components/FamilyTreeFlow.tsx
'use client';
// ... (Keep existing imports)
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  ReactFlowProvider,
  Node,
  Edge,
  useReactFlow, // Keep this hook
  Position,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  useNodesState,
  useEdgesState,
  // Add Viewport type if needed for setViewport
  Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css'; // Don't forget this import

// Assuming these paths are correct relative to this file
import { mapCoreFamilyToFlowElements } from '../lib/reactFlowMapper';
import { getLayoutedElements, LayoutResult } from '../lib/layoutUtils';
import { PersonNode } from '../lib/types';
import ProfileSidebar from './ProfileSidebar'; // Ensure this path is correct

interface FamilyTreeFlowProps {
  peopleMap: Map<string, PersonNode>;
  rootId: string;
  setActivePersonId: (id: string | null) => void; // Allow setting to null
  activePersonId: string | null;
  activePersonData: PersonNode | undefined;
  onClose: () => void; // This might be redundant if handled by setActivePersonId(null)
  viewType: 'family' | 'pedigree';
}

// Custom Node component (Tailwind Box)
const CustomPersonNode = ({
  data,
  selected,
}: {
  data: PersonNode;
  selected: boolean;
}) => {
  const bgColor =
    data.sex === 'F'
      ? 'bg-pink-100 border-pink-500'
      : 'bg-blue-100 border-blue-500';
  const borderColor = selected
    ? 'border-4 border-yellow-500'
    : data.sex === 'F'
    ? 'border-red-500'
    : 'border-blue-500';

  return (
    <div
      className={`p-3 rounded-lg shadow-xl text-center text-xs ${bgColor} ${borderColor} transition-all duration-200 relative`}
      style={{ width: '180px', height: '100px' }}
    >
      <Handle
        type='target'
        position={Position.Top}
        id='top'
        className='!bg-gray-400 !w-2 !h-2'
      />
      <Handle
        type='source'
        position={Position.Bottom}
        id='bottom'
        className='!bg-gray-400 !w-2 !h-2'
      />
      <Handle
        type='target'
        position={Position.Left}
        id='left'
        className='!bg-gray-400 !w-2 !h-2'
      />
      <Handle
        type='source'
        position={Position.Right}
        id='right'
        className='!bg-gray-400 !w-2 !h-2'
      />

      <div className='font-bold text-base'>{data.name}</div>
      <div className='text-gray-600'>Born: {data.birthDate || 'N/A'}</div>
      {data.deathDate && (
        <div className='text-red-600 text-xs font-medium'>
          Died: {data.deathDate}
        </div>
      )}
    </div>
  );
};

const nodeTypes = { personNode: CustomPersonNode };

// Component for layout initialization and fitting view
const FlowInitializer = ({
  layoutedNodes,
  layoutedEdges,
  rootId,
}: LayoutResult & { rootId: string }) => {
  const { setNodes, setEdges, fitView, getNode, setViewport, getZoom } =
    useReactFlow(); // Added getZoom
  const [isInitialized, setIsInitialized] = useState(false); // Track initialization

  useEffect(() => {
    // Run ONLY ONCE after the first successful layout calculation
    if (layoutedNodes.length > 0 && !isInitialized) {
      console.log('[INIT] Setting nodes and edges state for initial render...');
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Defer centering to ensure React Flow internal state is ready
      const timeout = setTimeout(() => {
        const rootNode = getNode(rootId);
        // Check if React Flow instance is fully ready
        if (rootNode && rootNode.position && typeof getZoom === 'function') {
          console.log(`[INIT] Centering view on root node: ${rootId}`);
          const zoomLevel = 1; // Start zoom
          const x =
            rootNode.position.x + (rootNode.width ? rootNode.width / 2 : 90);
          const y =
            rootNode.position.y + (rootNode.height ? rootNode.height / 2 : 50);

          // Calculate offsets based on current viewport size (requires getting viewport)
          // For simplicity, using fixed offsets that worked previously
          const offsetX = 500;
          const offsetY = 200;

          setViewport(
            { x: x - offsetX, y: y - offsetY, zoom: zoomLevel },
            { duration: 600 }
          );
          setIsInitialized(true); // Mark as initialized
          console.log('[INIT] Viewport centering complete.');
        } else {
          console.warn(
            '[INIT] React Flow instance or root node not ready for centering. Using fitView as fallback.'
          );
          // Fallback if precise centering fails
          fitView({ padding: 0.3, duration: 400 });
          setIsInitialized(true); // Mark as initialized even if fallback used
        }
      }, 200); // Increased delay slightly more

      return () => clearTimeout(timeout);
    }
  }, [
    layoutedNodes,
    layoutedEdges,
    rootId,
    setNodes,
    setEdges,
    fitView,
    getNode,
    setViewport,
    getZoom,
    isInitialized,
  ]); // Added dependencies

  // Effect to handle viewType CHANGES (re-layout and re-center)
  useEffect(() => {
    // Only run if ALREADY initialized and layout changes (due to viewType)
    if (isInitialized && layoutedNodes.length > 0) {
      console.log('[UPDATE] Re-setting nodes/edges due to viewType change...');
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Re-center after view change
      const timeout = setTimeout(() => {
        console.log('[UPDATE] Re-centering view after viewType change...');
        fitView({ padding: 0.3, duration: 400 });
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [
    layoutedNodes,
    layoutedEdges,
    isInitialized,
    setNodes,
    setEdges,
    fitView,
  ]);

  return null;
};

// --- FlowCore Component ---
const FlowCore = ({
  peopleMap,
  rootId,
  setActivePersonId,
  activePersonId,
  activePersonData,
  onClose,
  viewType,
}: FamilyTreeFlowProps) => {
  // 1. Map raw data
  const rawData = useMemo(
    () => mapCoreFamilyToFlowElements(peopleMap, rootId),
    [peopleMap, rootId]
  );

  // 2. Apply Dagre Layout
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    try {
      const direction = viewType === 'pedigree' ? 'LR' : 'TB';
      console.log(`[LAYOUT] Calculating layout with direction: ${direction}`);
      return getLayoutedElements(
        [...rawData.nodes],
        rawData.edges,
        direction,
        peopleMap
      ) as LayoutResult;
    } catch (e) {
      console.error('Dagre Layout Calculation Failed:', e);
      return {
        layoutedNodes: rawData.nodes,
        layoutedEdges: rawData.edges,
      } as LayoutResult;
    }
  }, [rawData.nodes, rawData.edges, viewType, peopleMap]);

  // 3. Use state hooks, initialized empty. Initial state set by FlowInitializer.
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      setActivePersonId(node.id);
    },
    [setActivePersonId]
  );

  return (
    <div className='flex relative w-full h-full'>
      <div className='flex-grow h-full w-full' style={{ minHeight: '900px' }}>
        {/* Render ReactFlow unconditionally; state is managed by initializer */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange}
          onEdgesChange={onEdgesChange as OnEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          // REMOVED fitView prop - handled by initializer
          className='react-flow-container'
          style={{ width: '100%', height: '100%' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          {/* Initializer component handles setting nodes/edges and centering */}
          <FlowInitializer
            layoutedNodes={layoutedNodes}
            layoutedEdges={layoutedEdges}
            rootId={rootId}
          />
        </ReactFlow>
      </div>

      <ProfileSidebar
        person={activePersonData}
        peopleMap={peopleMap}
        onClose={onClose}
      />
    </div>
  );
};

// --- Export the component wrapped in the required Provider ---
export default function FamilyTreeFlow(props: FamilyTreeFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowCore {...props} viewType={props.viewType} />
    </ReactFlowProvider>
  );
}
