// src/lib/familyData.ts

import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { RawData, PersonNode, RawIndividual, RawFamily } from './types';

// Helper function to ensure we always get an array of IDs
const ensureArray = (idOrIds: string | string[] | undefined): string[] => {
  if (!idOrIds) return [];
  return Array.isArray(idOrIds) ? idOrIds : [idOrIds];
};

/**
 * Reads the raw JSON and converts it into a clean, flat Map of PersonNodes.
 */
export async function getAllPeople(): Promise<Map<string, PersonNode>> {
  // FIX: Switch back to the full tree file
  const filePath = path.join(process.cwd(), 'data', 'nikolov-tree.json');

  const jsonString = await fs.readFile(filePath, 'utf8');
  const rawData: RawData = JSON.parse(jsonString);

  // 1. Map all records by their ID for fast lookup (Pass 1)
  const recordMap = new Map<string, RawIndividual | RawFamily>();
  rawData.Individuals.forEach(r => recordMap.set(r.Id, r));
  rawData.Relations.forEach(r => recordMap.set(r.Id, r));

  const peopleData: PersonNode[] = [];

  // 2. Transformation Logic (Pass 2: Resolve all relationships)
  for (const rawRecord of rawData.Individuals) {
    const record = rawRecord as RawIndividual;

    const person: PersonNode = {
      id: record.Id,
      name: record.Fullname.replace(/\//g, '').trim(),
      sex: record.Sex,
      birthDate: record.Birth?.Date?.Value?.split('T')[0],
      deathDate: record.Death?.Date?.Value?.split('T')[0],
      photoUrl: record.Object?.File?.[0],
      parentIds: [],
      spouseIds: [],
      childrenIds: [],
      birthTimeNote: record.Birth?.Notes?.Id,
    };

    const relations = ensureArray(record.Relations);

    for (const relId of relations) {
      const family = recordMap.get(relId) as RawFamily | undefined;
      if (!family) continue;

      // A. Ancestry: If this person is a CHILD in the family record
      const childrenIds = ensureArray(family.Children);
      if (childrenIds.includes(person.id)) {
        if (family.Husband) person.parentIds.push(family.Husband);
        if (family.Wife) person.parentIds.push(family.Wife);
      }

      // B. Spousal/Progeny: If this person is a SPOUSE in the family record
      if (family.Husband === person.id || family.Wife === person.id) {
        // Add the spouse (the other parent)
        const spouseId =
          family.Husband === person.id ? family.Wife : family.Husband;
        if (spouseId) person.spouseIds.push(spouseId);

        // Add children from this relationship
        person.childrenIds.push(...childrenIds);
      }
    }

    // Dedupe and finalize
    // FIX: Removed the filter that caused the ReferenceError, relying on later steps to filter nulls.
    person.parentIds = [...new Set(person.parentIds)];
    person.spouseIds = [...new Set(person.spouseIds)];
    person.childrenIds = [...new Set(person.childrenIds)];

    peopleData.push(person);
  }

  // Create a map of all individuals
  const finalPeopleMap = new Map(peopleData.map(p => [p.id, p]));

  // OPTIONAL: Second pass to filter IDs that point to non-existent people
  // We can skip this pass and rely on the rendering components to check peopleMap.has(id)
  // before rendering, which is cleaner.

  // NOTE: This console log is key for the next step of debugging!
  console.log(`[DATA PROCESSOR] Final People Map Size: ${finalPeopleMap.size}`);

  return finalPeopleMap;
}
