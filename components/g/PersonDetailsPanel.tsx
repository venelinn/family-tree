import type React from 'react';
import { CalendarIcon, UserIcon, XMarkIcon } from './icons';
import type { Family, ProcessedIndividual } from './types/types';

interface PersonDetailsPanelProps {
  person: ProcessedIndividual | null;
  individuals: Map<string, ProcessedIndividual>;
  families: Map<string, Family>;
  onSelectPerson: (id: string) => void;
  onClose: () => void;
}

const DetailItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
}> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div className='flex items-start space-x-3'>
      <div className='w-5 h-5 text-gray-500 mt-1'>{icon}</div>
      <div>
        <p className='text-sm font-semibold text-gray-500'>{label}</p>
        <p className='text-base text-gray-800'>{value}</p>
      </div>
    </div>
  );
};

const RelationLink: React.FC<{
  person: ProcessedIndividual | undefined;
  label: string;
  onSelect: (id: string) => void;
}> = ({ person, label, onSelect }) => {
  if (!person) return null;
  return (
    <div>
      <p className='text-sm font-semibold text-gray-500'>{label}</p>
      <button
        type='button'
        onClick={() => onSelect(person.Id)}
        className='text-base text-indigo-600 hover:underline'
      >
        {person.Fullname}
      </button>
    </div>
  );
};

/**
 * Helpers to safely extract date string and place from Birth/Death which may be
 * either object or string (per your types).
 */
function extractDateValue(field: any): string | undefined {
  // If field is a string, assume it's a date-like string and return it
  if (typeof field === 'string' && field.trim().length > 0) return field;
  // If it's an object, try known properties
  if (field && typeof field === 'object') {
    // prefer Date.Value, then maybe Value on death object
    return (
      (field.Date && field.Date.Value) ||
      field.Value ||
      (typeof field === 'string' ? field : undefined)
    );
  }
  return undefined;
}

function formatDateFromValue(value?: string): string | undefined {
  if (!value) return undefined;
  // Try to parse; some GEDCOM outputs are "23 DEC 1976" which Date can parse in many environments.
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  // If Date parsing failed, return the raw string (safer than nothing)
  return value;
}

function extractPlace(field: any): string | undefined {
  // If field is an object and has Place, return it. If field is a string, there's no structured Place.
  if (field && typeof field === 'object' && typeof field.Place === 'string') {
    return field.Place;
  }
  return undefined;
}

// Type predicate for filtering out nulls from spousesAndChildren
function isSpouseEntry(
  v: {
    spouse: ProcessedIndividual | undefined;
    children: ProcessedIndividual[];
  } | null
): v is {
  spouse: ProcessedIndividual | undefined;
  children: ProcessedIndividual[];
} {
  return v !== null;
}

const PersonDetailsPanel: React.FC<PersonDetailsPanelProps> = ({
  person,
  individuals,
  families,
  onSelectPerson,
  onClose,
}) => {
  if (!person) return null;

  const imageUrl = person.Object?.File?.[0];

  // ---- Birth / Death dates and places (safe) ----
  const birthValue = extractDateValue(person.Birth);
  const birthDate = formatDateFromValue(birthValue);
  const birthPlace = extractPlace(person.Birth);

  const deathValue =
    typeof person.Death === 'string'
      ? person.Death
      : extractDateValue(person.Death);
  const deathDate = formatDateFromValue(deathValue);
  const deathPlace = extractPlace(person.Death);

  // ---- parents (safe) ----
  const parentFamily = person.familyAsChild
    ? families.get(person.familyAsChild)
    : undefined;
  const father = parentFamily?.Husband
    ? individuals.get(parentFamily.Husband)
    : undefined;
  const mother = parentFamily?.Wife
    ? individuals.get(parentFamily.Wife)
    : undefined;

  // ---- spouses & children (normalize children and filter) ----
  const spousesAndChildren = (person.familyAsSpouse || [])
    .map(familyId => {
      const family = families.get(familyId);
      if (!family) return null;

      const spouseId =
        (family.Husband === person.Id && family.Wife) ||
        (family.Wife === person.Id && family.Husband) ||
        undefined;
      const spouse = spouseId ? individuals.get(spouseId) : undefined;

      // normalize children (Children could be string | string[] | undefined)
      const childrenIds: string[] = Array.isArray(family.Children)
        ? family.Children
        : family.Children
        ? [family.Children]
        : [];

      const children = childrenIds
        .map(cid => individuals.get(cid))
        .filter(Boolean) as ProcessedIndividual[];

      return { spouse, children };
    })
    .filter(isSpouseEntry); // drop nulls and convince TS they are the right shape

  return (
    <div
      className={`absolute top-0 right-0 h-full w-full md:w-96 bg-white/90 backdrop-blur-lg shadow-2xl z-30 transition-transform duration-300 ease-in-out ${
        person ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className='p-4 flex flex-col h-full overflow-y-auto'>
        <button
          type='button'
          onClick={onClose}
          className='absolute top-4 right-4 text-gray-500 hover:text-gray-800'
        >
          <XMarkIcon className='w-6 h-6' />
        </button>

        <div className='w-32 h-32 rounded-full mx-auto overflow-hidden border-4 border-white shadow-lg mb-4'>
          {imageUrl ? (
            <img
              loading='lazy'
              src={imageUrl}
              alt={person.Fullname}
              className='w-full h-full object-cover'
            />
          ) : (
            <div className='w-full h-full bg-gray-200 flex items-center justify-center'>
              <UserIcon className='w-24 h-24 text-gray-400' />
            </div>
          )}
        </div>

        <h2 className='text-2xl font-bold text-center text-gray-900'>
          {person.Fullname}
        </h2>

        <div className='mt-6 space-y-4 border-t pt-6'>
          <DetailItem
            icon={<CalendarIcon />}
            label='Born'
            value={
              birthDate
                ? `${birthDate}${birthPlace ? ` in ${birthPlace}` : ''}`
                : birthPlace
                ? `in ${birthPlace}`
                : undefined
            }
          />

          {deathDate || deathPlace ? (
            <DetailItem
              icon={<CalendarIcon />}
              label='Died'
              value={
                deathDate
                  ? `${deathDate}${deathPlace ? ` in ${deathPlace}` : ''}`
                  : deathPlace
              }
            />
          ) : null}
        </div>

        <div className='mt-6 space-y-4 border-t pt-6'>
          <h3 className='text-lg font-semibold text-gray-800'>Family</h3>

          <RelationLink
            person={father}
            label='Father'
            onSelect={onSelectPerson}
          />
          <RelationLink
            person={mother}
            label='Mother'
            onSelect={onSelectPerson}
          />

          {spousesAndChildren.map(({ spouse, children }, index) => (
            <div key={spouse?.Id || index}>
              <RelationLink
                person={spouse}
                label='Spouse'
                onSelect={onSelectPerson}
              />
              {children.length > 0 && (
                <div className='pl-4 mt-2'>
                  <p className='text-sm font-semibold text-gray-500'>
                    Children
                  </p>
                  <ul className='list-disc list-inside'>
                    {children.map(child => (
                      <li key={child.Id}>
                        <button
                          type='button'
                          onClick={() => onSelectPerson(child.Id)}
                          className='text-base text-indigo-600 hover:underline'
                        >
                          {child.Fullname}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonDetailsPanel;
