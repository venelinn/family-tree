// src/components/PersonBox.tsx
'use client';
import React from 'react';
import { D3Node } from '../lib/types';

type ViewType = 'family' | 'pedigree';

interface PersonBoxProps {
  node: D3Node;
  onClick: (node: D3Node) => void;
  viewType: ViewType;
}

const PersonBox = ({ node, onClick, viewType }: PersonBoxProps) => {
  // Use attributes directly from the node
  const { sex, born, died, id } = node.attributes;

  // Tailwind styling based on sex and viewType
  const bgColor =
    sex === 'F' ? 'bg-red-100 border-red-500' : 'bg-blue-100 border-blue-500';

  // Customize style for visual space (assuming horizontal is wider)
  const style =
    viewType === 'pedigree'
      ? { width: '150px', height: '50px', margin: '5px 20px' }
      : { width: '130px', height: '70px', margin: '10px' };

  return (
    <div
      onClick={() => onClick(node)}
      className={`p-2 border-2 rounded-lg shadow-md cursor-pointer text-center text-xs transition-shadow duration-300 hover:shadow-xl ${bgColor}`}
      style={style}
    >
      <div className='font-bold whitespace-nowrap overflow-hidden text-ellipsis text-sm'>
        {node.name}
      </div>
      <div className='text-gray-600 text-xs'>Born: {born}</div>
      {died && <div className='text-red-500 text-xs'>Died: {died}</div>}
    </div>
  );
};

export default PersonBox;
