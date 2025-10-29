// src/components/FamilyTreeVisualization.tsx
'use client';
import { useState } from 'react';
import FamilyTreeFlow from './FamilyTreeFlow';
import { PersonNode } from '../lib/types';

interface VisualizationProps {
  peopleMap: Map<string, PersonNode>;
  rootId: string;
}

type ViewType = 'family' | 'pedigree';

export default function FamilyTreeVisualization({
  peopleMap,
  rootId,
}: VisualizationProps) {
  // State initialization for React Flow is simpler now:
  const [activePersonId, setActivePersonId] = useState<string | null>(rootId);
  const [viewType, setViewType] = useState<ViewType>('family'); // View state is mostly for UI/Filter

  // Get the active person's data for the sidebar
  const activePersonData = peopleMap.get(activePersonId || '');

  // NOTE: With React Flow, we don't need a complex D3 structure anymore,
  // so we skip the creation of the D3Node structure and pass the raw map.

  return (
    <div className='flex relative h-full w-full'>
      {/* View Switcher Controls (Still useful for future data filtering) */}
      <div className='absolute top-1 right-2 z-10 space-x-2'>
        <button
          onClick={() => setViewType('family')}
          className={`px-3 py-1 text-sm font-medium rounded ${
            viewType === 'family'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Family View
        </button>
        <button
          onClick={() => setViewType('pedigree')}
          className={`px-3 py-1 text-sm font-medium rounded ${
            viewType === 'pedigree'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-300 text-gray-700'
          }`}
        >
          Pedigree View
        </button>
      </div>

      {/* The main flow renderer component */}
      <FamilyTreeFlow
        peopleMap={peopleMap}
        rootId={rootId}
        setActivePersonId={setActivePersonId}
        activePersonId={activePersonId}
        activePersonData={activePersonData}
        onClose={() => setActivePersonId(null)}
        viewType={viewType}
      />
    </div>
  );
}
