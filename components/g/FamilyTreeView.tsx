import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MiniMap,
  type Node,
} from 'reactflow';
import PersonNode from './PersonNode';
import type { Family, ProcessedIndividual } from './types/types';
import { generateLayoutedElements } from './utils/layoutTree';

interface FamilyTreeViewProps {
  individuals: Map<string, ProcessedIndividual>;
  families: Map<string, Family>;
  selectedPersonId: string | null;
  onSelectPerson: (id: string | null) => void;
  rootId: string;
}

const nodeTypes = {
  person: PersonNode,
};

const FamilyTreeView = ({
  individuals,
  families,
  selectedPersonId,
  onSelectPerson,
  rootId,
}: FamilyTreeViewProps) => {
  // Ensure generateLayoutedElements always returns { nodes, edges }
  const baseLayout = useMemo(() => {
    const layout = generateLayoutedElements(individuals, families, rootId);
    return layout ?? { nodes: [], edges: [] };
  }, [individuals, families, rootId]);

  // Add selection state to nodes
  const nodesWithSelection = useMemo(() => {
    return (
      baseLayout.nodes?.map(node => ({
        ...node,
        selected: node.id === selectedPersonId,
      })) || []
    );
  }, [baseLayout.nodes, selectedPersonId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'person') {
        onSelectPerson(node.id);
      }
    },
    [onSelectPerson]
  );

  return (
    <ReactFlow
      nodes={nodesWithSelection}
      edges={baseLayout.edges || []}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      className='bg-gray-100'
    >
      <Controls />
      <MiniMap nodeStrokeWidth={3} pannable zoomable />
    </ReactFlow>
  );
};

export default FamilyTreeView;
