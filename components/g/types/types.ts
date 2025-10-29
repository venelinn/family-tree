export interface DateInfo {
  Original?: string;
  Value?: string;
  Between?: any;
  And?: any;
  HasYear?: boolean;
  HasMonth?: boolean;
  HasDay?: boolean;
}

export interface Birth {
  Date?: DateInfo;
  Place?: string;
  Notes?: {
    Id: string;
  };
}

export interface Death {
  Date?: DateInfo;
  Place?: string;
  Value?: string;
  Age?: string;
  Cause?: string;
}

export interface Individual {
  Id: string;
  Surname?: string;
  Givenname?: string;
  Fullname: string;
  Sex?: 'M' | 'F';
  Birth?: Birth | string;
  Death?: Death | string;
  Burial?: {
    Place?: string;
  };
  Events?: {
    Name: string;
    Type: string;
  };
  Relations?: string[] | string;
  Notes?: {
    Id: string;
  };
  RecordIdNumber?: string;
  Object?: {
    File?: string[];
    Format?: string[];
    Title?: string[] | string;
  };
  Residence?: {
    EMail?: string;
  };
}

export interface Marriage {
  Date: DateInfo;
  Place: string;
}

export interface Family {
  Id: string;
  Husband?: string;
  Wife?: string;
  Children?: string[] | string;
  Marriage?: Marriage;
  RecordIdNumber?: string;
  Events?: {
    Name?: string;
    Type?: string;
  };
  Divorce?: string;
}

export interface GedcomData {
  Individuals: Individual[];
  Relations: Family[];
}

export interface ProcessedIndividual extends Individual {
  familyAsSpouse: string[];
  familyAsChild?: string;
}
