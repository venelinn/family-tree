import type React from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
} from 'reactflow';

// Hardcoded initial nodes for the simple example
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Input Node' },
    position: { x: 250, y: 5 },
  },
  {
    id: '2',
    data: { label: 'Default Node' },
    position: { x: 100, y: 100 },
  },
  {
    id: '3',
    type: 'output',
    data: { label: 'Output Node' },
    position: { x: 400, y: 100 },
  },
];

// Hardcoded initial edges
const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'this is an edge' },
  { id: 'e1-3', source: '1', target: '3', animated: true },
];

const SimpleFlow: React.FC = () => {
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
        <Controls />
        <MiniMap />
        <Background gap={16} />
      </ReactFlow>
    </div>
  );
};

export default SimpleFlow;
