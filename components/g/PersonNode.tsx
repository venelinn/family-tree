import { Handle, Position } from 'reactflow';
import { UserIcon } from './icons';
import type { ProcessedIndividual } from './types/types';

interface PersonNodeData {
  person: ProcessedIndividual;
}

interface PersonNodeProps {
  data: PersonNodeData;
  selected: boolean;
}

const PersonNode = ({ data, selected }: PersonNodeProps) => {
  const { person } = data;

  const birthYear = person.Birth?.Date?.Value
    ? new Date(person.Birth.Date.Value).getFullYear()
    : '?';
  const deathYear = person.Death?.Date?.Value
    ? new Date(person.Death.Date.Value).getFullYear()
    : '';
  const lifespan = deathYear
    ? `${birthYear} - ${deathYear}`
    : `b. ${birthYear}`;
  const imageUrl = person.Object?.File?.[0];

  const genderColorClasses =
    person.Sex === 'M'
      ? 'bg-blue-100 border-blue-400'
      : 'bg-pink-100 border-pink-400';

  const selectedClasses = selected
    ? 'ring-4 ring-offset-2 ring-indigo-500'
    : 'shadow-md hover:shadow-lg';

  return (
    <div
      className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border-2 w-[200px] h-[80px] ${genderColorClasses} ${selectedClasses}`}
    >
      <Handle
        type='target'
        position={Position.Top}
        id='top'
        className='!bg-gray-400'
      />

      <div className='flex items-center space-x-3 h-full'>
        <div className='flex-shrink-0 w-14 h-14 rounded-full overflow-hidden bg-gray-300 border-2 border-white shadow-sm'>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={person.Fullname}
              className='w-full h-full object-cover'
            />
          ) : (
            <UserIcon className='w-full h-full text-gray-400' />
          )}
        </div>
        <div className='flex-grow overflow-hidden'>
          <p
            className='font-bold text-sm text-gray-800 truncate'
            title={person.Fullname}
          >
            {person.Fullname}
          </p>
          <p className='text-xs text-gray-600'>{lifespan}</p>
        </div>
      </div>

      <Handle
        type='source'
        position={Position.Bottom}
        id='bottom'
        className='!bg-gray-400'
      />
    </div>
  );
};

export default PersonNode;
