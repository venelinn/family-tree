// src/components/ProfileSidebar.tsx
import React, { useEffect, useRef } from 'react';
import { PersonNode } from '../lib/types';

interface SidebarProps {
  person: PersonNode | undefined;
  peopleMap: Map<string, PersonNode>;
  onClose: () => void;
}

// Helper function to render related names with profile links (using Tailwind for list styling)
const renderRelatedLinks = (
  ids: string[],
  peopleMap: Map<string, PersonNode>,
  title: string
) => {
  if (ids.length === 0) return null;
  return (
    <div className='mt-4'>
      <h4 className='text-sm font-semibold text-gray-700 mb-1'>{title}</h4>
      <ul className='space-y-1 list-disc pl-5 text-sm text-gray-800'>
        {ids.map(id => {
          const relatedPerson = peopleMap.get(id);
          if (!relatedPerson) return null;
          return (
            <li key={id}>
              {relatedPerson.name} ({relatedPerson.sex})
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default function ProfileSidebar({
  person,
  peopleMap,
  onClose,
}: SidebarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Use effect to control the native <dialog> element's open state
  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (dialogElement) {
      if (person) {
        dialogElement.showModal();
        // Prevent scrolling on the main page when dialog is open
        document.body.style.overflow = 'hidden';
      } else {
        dialogElement.close();
        document.body.style.overflow = 'unset';
      }
    }
  }, [person]);

  // If no person is active, return null (dialog opening is controlled by useEffect)
  if (!person) return null;

  return (
    // Tailwind classes for fixed position, size, background, and shadows
    <dialog
      ref={dialogRef}
      className='fixed top-0 right-0 bottom-0 h-full w-80 max-w-sm bg-white shadow-xl p-6 m-0 border-none overflow-y-auto'
      onCancel={onClose}
    >
      {/* Profile Content */}

      {/* Close Button (positioned absolutely for the top-right corner) */}
      <button
        onClick={onClose}
        className='absolute top-3 right-3 text-gray-500 hover:text-gray-900 text-2xl bg-transparent border-none cursor-pointer p-1'
      >
        &times;
      </button>

      {/* Profile Photo */}
      {person.photoUrl && (
        <img
          src={person.photoUrl}
          alt={person.name}
          className='w-full h-auto max-h-52 object-cover rounded-md mb-4 shadow-md'
        />
      )}

      {/* Name and Basic Facts */}
      <h2 className='text-2xl font-bold text-gray-900 mt-2'>{person.name}</h2>
      <ul className='text-base text-gray-600'>
        <li>Born: {person.birthDate || 'Unknown'}</li>
        <li>Place: {person.birthPlace || 'Unknown'}</li>
        <li>Place: {person.birthTimeNote || 'Unknown'}</li>
      </ul>

      {person.deathDate && (
        <p className='text-base text-red-600'>Died: {person.deathDate}</p>
      )}

      <hr className='my-4 border-gray-200' />

      {/* Family Relations Section */}
      <h3 className='text-xl font-semibold mb-2 text-gray-800'>
        Immediate Family
      </h3>

      {renderRelatedLinks(person.spouseIds, peopleMap, 'Spouse(s)')}
      {renderRelatedLinks(person.childrenIds, peopleMap, 'Children')}
      {renderRelatedLinks(person.parentIds, peopleMap, 'Parents')}
    </dialog>
  );
}
