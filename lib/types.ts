// src/lib/types.ts

// The raw format after JSON conversion from GEDCOM
export interface RawIndividual {
  Id: string;
  Surname?: string;
  Givenname?: string;
  Fullname: string;
  Sex: 'M' | 'F';
  Relations?: string[] | string; // Array of @F IDs
  Birth?: {
    Date: {
      Value: string; // e.g., "1976-12-23T05:00:00.000Z"
    };
    Place?: string;
    Notes?: {
      Id: string; // e.g., "Родена точно в: 2:50"
    };
  };
  Death?: {
    Date?: {
      Value: string;
    };
  };
  Object?: {
    File: string[]; // URLs for photos/media
  };
}

export interface RawFamily {
  Id: string;
  Husband?: string; // @I ID
  Wife?: string; // @I ID
  Children?: string[] | string; // Array of @I IDs
}

export interface RawData {
  Individuals: RawIndividual[];
  Relations: RawFamily[];
}

// The clean, final structure used by the application (Node-Link Model)
export interface PersonNode {
  id: string;
  name: string;
  sex: 'M' | 'F';
  birthDate?: string;
  birthPlace?: string;
  birthTimeNote?: string;
  deathDate?: string;
  photoUrl?: string;
  parentIds: string[];
  spouseIds: string[];
  childrenIds: string[];
}

// The Hierarchical D3 Structure (for the visualization library)
export interface D3Node {
  name: string;
  attributes: {
    id: string;
    born?: string;
    died?: string;
    sex: 'M' | 'F';
  };
  children: D3Node[];
}
