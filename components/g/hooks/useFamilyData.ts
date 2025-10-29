'use client';
import { useEffect, useState } from 'react';
import type { Family, GedcomData, ProcessedIndividual } from '../types/types';

export const useFamilyData = (data?: GedcomData) => {
  const [individuals, setIndividuals] = useState<
    Map<string, ProcessedIndividual>
  >(new Map());
  const [families, setFamilies] = useState<Map<string, Family>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setIsLoading(true);
      return;
    }

    try {
      const individualsMap = new Map<string, ProcessedIndividual>();
      const familiesMap = new Map<string, Family>();

      // Step 1: process all individuals
      data.Individuals.forEach(ind => {
        const processedInd: ProcessedIndividual = {
          ...ind,
          familyAsSpouse: [],
          familyAsChild: undefined,
        };
        individualsMap.set(ind.Id, processedInd);
      });

      // Step 2: process families
      data.Relations.forEach(fam => {
        familiesMap.set(fam.Id, fam);

        // link spouses
        if (fam.Husband) {
          individualsMap.get(fam.Husband)?.familyAsSpouse.push(fam.Id);
        }
        if (fam.Wife) {
          individualsMap.get(fam.Wife)?.familyAsSpouse.push(fam.Id);
        }

        // normalize children into an array
        const children = Array.isArray(fam.Children)
          ? fam.Children
          : fam.Children
          ? [fam.Children]
          : [];

        // link children
        children.forEach(childId => {
          const child = individualsMap.get(childId);
          if (child) {
            child.familyAsChild = fam.Id;
          }
        });
      });

      setIndividuals(individualsMap);
      setFamilies(familiesMap);
      setIsLoading(false);
      setError(null);
    } catch (e) {
      console.error('Error processing GEDCOM data:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [data]);

  return { individuals, families, isLoading, error };
};
