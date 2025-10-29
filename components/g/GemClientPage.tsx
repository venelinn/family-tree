'use client';

import { useCallback, useState } from 'react';
import FamilyTreeView from '@/components/g/FamilyTreeView';
import { useFamilyData } from '@/components/g/hooks/useFamilyData';
import PersonDetailsPanel from '@/components/g/PersonDetailsPanel';
import ViewSwitcher from '@/components/g/ViewSwitcher';

interface GemClientPageProps {
  initialData: any;
}

export default function GemClientPage({ initialData }: GemClientPageProps) {
  const { individuals, families, isLoading, error } =
    useFamilyData(initialData);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(
    '@I85@'
  );
  const [view, setView] = useState<'family' | 'pedigree'>('family');

  const handleSelectPerson = useCallback((id: string | null) => {
    setSelectedPersonId(id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPersonId(null);
  }, []);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full text-lg font-semibold'>
        Loading Family Data...
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center h-full text-red-600 bg-red-50 p-4'>
        {error}
      </div>
    );
  }

  return (
    <div className='h-full w-full font-sans overflow-hidden bg-gray-100'>
      <header className='absolute top-0 left-0 p-4 z-20 flex items-center space-x-4'>
        <h1 className='text-2xl font-bold text-gray-800'>
          Family Tree Explorer
        </h1>
        <p>Individuals: {individuals.size}</p>
        <p>Families: {families.size}</p>
        <ViewSwitcher currentView={view} onViewChange={setView} />
      </header>

      <main className='h-full w-full relative'>
        <FamilyTreeView
          individuals={individuals}
          families={families}
          selectedPersonId={selectedPersonId}
          onSelectPerson={handleSelectPerson}
          rootId='@I63@'
        />
        <PersonDetailsPanel
          person={
            selectedPersonId ? individuals.get(selectedPersonId) ?? null : null
          }
          individuals={individuals}
          families={families}
          onSelectPerson={handleSelectPerson}
          onClose={handleClosePanel}
        />
      </main>
    </div>
  );
}
