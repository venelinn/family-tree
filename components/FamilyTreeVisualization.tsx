// src/components/FamilyTreeVisualization.tsx
'use client';
import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CustomNodeElementProps } from 'react-d3-tree';
import { PersonNode, D3Node } from '../lib/types';
import { createVisualTree } from '../lib/treeUtils'; //
import ProfileSidebar from '@/components/ProfileSidebar';

const DynamicTree = dynamic(() => import('react-d3-tree'), {
  ssr: false, // <-- CRITICAL: Forces client-side rendering only
  loading: () => <div style={{ height: 800 }}>Loading Tree...</div>,
});

interface VisualizationProps {
  peopleMap: Map<string, PersonNode>;
  rootId: string;
}

const containerStyles: React.CSSProperties = {
  width: '100%',
  height: '800px',
  background: '#f2f2f2',
};

// Define a custom node element to show more information
const renderCustomNode = ({
  nodeDatum,
  toggleNode,
}: CustomNodeElementProps) => {
  // We can safely cast nodeDatum to D3Node here since we know our data structure matches
  const customNodeData = nodeDatum as unknown as D3Node;

  const sex = customNodeData.attributes.sex; // Now the 'sex' property exists!
  // A node can only be expanded if it has children
  const hasExpandableChildren =
    customNodeData.children && customNodeData.children.length > 0;

  return (
    <g>
      <circle
        r={20}
        fill={sex === 'F' ? '#ff9999' : '#99ccff'}
        onClick={toggleNode}
        style={{ cursor: hasExpandableChildren ? 'pointer' : 'default' }}
      />
      <text
        fill='black'
        strokeWidth='0.5'
        x='25'
        y='5'
        textAnchor='start'
        style={{ fontSize: '10px' }}
      >
        {customNodeData.name}
      </text>
      {hasExpandableChildren && (
        <text
          x={-5}
          y={5}
          fill='black'
          strokeWidth='0.5'
          style={{ fontSize: '20px', pointerEvents: 'none' }}
        >
          {nodeDatum.__rd3t.collapsed ? '+' : '-'}
        </text>
      )}
      <text
        fill='gray'
        strokeWidth='0.5'
        x='25'
        y='18'
        textAnchor='start'
        style={{ fontSize: '9px' }}
      >
        Born: {customNodeData.attributes.born}
      </text>
    </g>
  );
};

export default function FamilyTreeVisualization({
  peopleMap,
  rootId,
}: VisualizationProps) {
  // State to track which person's data to display in the sidebar
  const [activePersonId, setActivePersonId] = useState<string | null>(rootId); // <-- Initialized to the root ID
  // Use useMemo to prevent re-running the heavy tree creation on every render
  const data: D3Node = useMemo(() => {
    return createVisualTree(peopleMap, rootId, 0, 2);
  }, [peopleMap, rootId]);

  // Handler for when a user clicks a node (circle)
  const handleNodeClick = (nodeDatum: D3Node) => {
    setActivePersonId(nodeDatum.attributes.id);
  };

  // Modify the renderCustomNode function (see below for the full update)
  const renderCustomNodeWithHandler = ({
    nodeDatum,
    toggleNode,
  }: CustomNodeElementProps) => {
    const customNodeData = nodeDatum as unknown as D3Node;
    const sex = customNodeData.attributes.sex;
    const hasExpandableChildren =
      customNodeData.children && customNodeData.children.length > 0;
    const isActive = customNodeData.attributes.id === activePersonId;

    // Define the click handler once, which will be attached to the main group.
    const clickHandler = (evt: React.MouseEvent) => {
      handleNodeClick(customNodeData); // Update the sidebar
      toggleNode(); // Collapse/expand the branch
      evt.stopPropagation();
    };

    return (
      // Use a single top-level SVG group element
      <g onClick={clickHandler} style={{ cursor: 'pointer' }}>
        {/* 1. The Main Node Shape (Circle) */}
        <circle
          r={20}
          // Fill color logic
          fill={isActive ? '#3388ff' : sex === 'F' ? '#ff9999' : '#99ccff'}
        />

        {/* 2. Expand/Collapse Indicator (+/-) */}
        {hasExpandableChildren && (
          <text
            x={-5}
            y={5}
            fill='black'
            strokeWidth='0.5'
            style={{ fontSize: '20px', pointerEvents: 'none' }}
          >
            {nodeDatum.__rd3t.collapsed ? '+' : '-'}
          </text>
        )}

        {/* 3. Name (Primary Label) */}
        <text
          fill='black'
          strokeWidth='0.5'
          x='25'
          y='5'
          textAnchor='start'
          style={{ fontSize: '10px' }}
          pointerEvents='none'
        >
          {customNodeData.name}
        </text>

        {/* 4. Birth Date (Secondary Label) */}
        <text
          fill='gray'
          strokeWidth='0.5'
          x='25'
          y='18'
          textAnchor='start'
          style={{ fontSize: '9px' }}
          pointerEvents='none'
        >
          Born: {customNodeData.attributes.born}
        </text>
      </g>
    );
  };

  if (data.name === 'Unknown') return <p>Root person not found in data.</p>;

  // Use a unique key to force a re-render if the root changes
  // const key = `${rootId}-${peopleMap.size}`;
  const key = `tree-view-${rootId}`;
  const activePersonData = peopleMap.get(activePersonId || '');
  return (
    <div className='flex relative h-full'>
      <div style={containerStyles} key={key}>
        <DynamicTree
          data={[data]} // react-d3-tree expects an array of nodes
          orientation='vertical'
          translate={{ x: 50, y: 50 }}
          nodeSize={{ x: 250, y: 150 }}
          separation={{ siblings: 2, nonSiblings: 2 }}
          renderCustomNodeElement={renderCustomNodeWithHandler}
          depthFactor={100}
          pathFunc={'step'}
          shouldCollapseNeighborNodes={true}
          // optional: enable zooming/panning
          zoomable
          draggable
          transitionDuration={500}
          centeringTransitionDuration={800}
        />
      </div>
      <ProfileSidebar
        person={activePersonData}
        peopleMap={peopleMap}
        onClose={() => setActivePersonId(null)}
      />
    </div>
  );
}
