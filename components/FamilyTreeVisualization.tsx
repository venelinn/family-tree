// src/components/FamilyTreeVisualization.tsx
'use client';
import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import dynamic from 'next/dynamic';
import { CustomNodeElementProps } from 'react-d3-tree';
import { PersonNode, D3Node } from '../lib/types';
import { createFamilyTree, createPedigreeTree } from '../lib/treeUtils';
import ProfileSidebar from '@/components/ProfileSidebar';

// Global Constant for Sidebar Width (Used for centering calculation)
const SIDEBAR_WIDTH = 350;
const DEFAULT_Y_START = 50; // Vertical offset for the top of the tree

const DynamicTree = dynamic(() => import('react-d3-tree'), {
  ssr: false, // <-- CRITICAL: Forces client-side rendering only
  loading: () => <div style={{ height: 1000 }}>Loading Tree...</div>,
});

interface VisualizationProps {
  peopleMap: Map<string, PersonNode>;
  rootId: string;
}

const containerStyles: React.CSSProperties = {
  width: '100%',
  height: '900px',
  background: '#f2f2f2',
};

type ViewType = 'family' | 'pedigree'; // Define the two views

export default function FamilyTreeVisualization({
  peopleMap,
  rootId,
}: VisualizationProps) {
  // State to track which person's data to display in the sidebar
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('family');

  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 50, y: DEFAULT_Y_START }); // Start with fixed value

  useLayoutEffect(() => {
    if (containerRef.current) {
      // 1. Calculate Centering
      const dimensions = containerRef.current.getBoundingClientRect();
      const treeAreaWidth = dimensions.width; // Use full width, as sidebar is fixed/overlay

      setTranslate({
        x: treeAreaWidth / 2, // Center X: Use half of the full width
        y: DEFAULT_Y_START,
      });

      // 2. Auto-Open Sidebar for the Root Person
      // Only set the active person if it hasn't been set yet (i.e., on initial load/refresh).
      // if (activePersonId === null) {
      //   setActivePersonId(rootId);
      // }
    }
  }, [rootId, viewType]); // Recalculate if the view type changes

  useEffect(() => {
    // This runs once after mount
    if (containerRef.current) {
      // Calculate the center position
      const dimensions = containerRef.current.getBoundingClientRect();
      setTranslate({
        x: dimensions.width / 2, // Center X
        y: 50, // Fixed Y start
      });
    }
  }, []);

  const treeBuilder =
    viewType === 'pedigree' ? createPedigreeTree : createFamilyTree;

  // Use useMemo to prevent re-running the heavy tree creation on every render
  const data: D3Node = useMemo(() => {
    const maxDepth = viewType === 'pedigree' ? 4 : 3;
    return treeBuilder(peopleMap, rootId, 0, maxDepth);
  }, [peopleMap, rootId, viewType]);

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

    // --- Profile Click Handler (ONLY for the text/name) ---
    const profileClickHandler = (evt: React.MouseEvent) => {
      // 1. Set the profile sidebar data
      handleNodeClick(customNodeData);
      // Prevent the click from affecting the circle's functionality or the main G group
      evt.stopPropagation();
    };

    // --- Tree Click Handler (ONLY for the circle/icon) ---
    const treeClickHandler = (evt: React.MouseEvent) => {
      // 1. Perform the collapse/expand action
      toggleNode();
      // 2. We can also click the node to select it for the sidebar, but we'll prioritize the text element.
      evt.stopPropagation();
    };

    return (
      // Use a single top-level SVG group element
      <g>
        {/* 1. The Main Node Shape (Circle) */}
        <circle
          r={20}
          // Fill color logic
          onClick={treeClickHandler}
          fill={isActive ? '#3388ff' : sex === 'F' ? '#ff9999' : '#99ccff'}
          style={{ cursor: hasExpandableChildren ? 'pointer' : 'default' }}
        />

        {/* 2. Expand/Collapse Indicator (+/-) */}
        {hasExpandableChildren && (
          <text
            x={-5}
            y={5}
            fill='black'
            strokeWidth='0.5'
            onClick={treeClickHandler}
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
          onClick={profileClickHandler}
          style={{ fontSize: '10px', cursor: 'pointer' }}
          className={isActive ? 'text-blue-700' : 'text-gray-900'}
          pointerEvents='all'
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
        {/* 4. Died Date */}
        {customNodeData.attributes.died && (
          <text
            fill='gray'
            strokeWidth='0.5'
            x='25'
            y='30'
            textAnchor='start'
            style={{ fontSize: '9px' }}
            pointerEvents='none'
          >
            Died: {customNodeData.attributes.died}
          </text>
        )}
      </g>
    );
  };

  if (data.name === 'Unknown') return <p>Root person not found in data.</p>;

  // Use a unique key to force a re-render if the root changes
  // const key = `${rootId}-${peopleMap.size}`;
  // const key = `tree-view-${rootId}`;
  const activePersonData = peopleMap.get(activePersonId || '');
  return (
    <div className='relative h-full'>
      {/* View Switcher Controls */}
      <div className='absolute top-1 right-2 z-10 space-x-2'>
        <button
          onClick={() => setViewType('family')}
          className={`px-3 py-1 text-sm font-medium rounded ${
            viewType === 'family'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Family Tree
        </button>
        <button
          onClick={() => setViewType('pedigree')}
          className={`px-3 py-1 text-sm font-medium rounded ${
            viewType === 'pedigree'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-300 text-gray-700'
          }`}
        >
          Pedigree Chart
        </button>
      </div>
      <div ref={containerRef} style={containerStyles}>
        <DynamicTree
          data={[data]} // react-d3-tree expects an array of nodes
          orientation='vertical'
          translate={translate}
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
