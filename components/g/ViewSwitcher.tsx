type View = 'family' | 'pedigree';

interface ViewSwitcherProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const ViewSwitcher = ({ currentView, onViewChange }: ViewSwitcherProps) => {
  const commonClasses =
    'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
  const activeClasses = 'bg-indigo-600 text-white shadow';
  const inactiveClasses = 'bg-white text-gray-700 hover:bg-gray-100';

  return (
    <div className='flex space-x-2 p-1 bg-gray-200 rounded-lg'>
      <button
        type='button'
        onClick={() => onViewChange('family')}
        className={`${commonClasses} ${
          currentView === 'family' ? activeClasses : inactiveClasses
        }`}
      >
        Family Tree
      </button>
      <button
        type='button'
        onClick={() => onViewChange('pedigree')}
        className={`${commonClasses} ${
          currentView === 'pedigree' ? activeClasses : inactiveClasses
        }`}
      >
        Pedigree
      </button>
    </div>
  );
};

export default ViewSwitcher;
