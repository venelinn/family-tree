import { FamilyTree } from '@/components/FamilyTree';
import rawFamily from '@/data/family.json';
import {
  buildFamilyAndRelations,
  RawFamilyMember,
  RawFamilyRelation,
} from '@/components/FamilyTree/utils';

export default async function TestPage() {
  const [familyMembersRecord, familyRelationsRecord] = buildFamilyAndRelations(
    rawFamily.familyMembers as RawFamilyMember[],
    rawFamily.familyRelations as RawFamilyRelation[]
  );

  const rootMember = familyMembersRecord['11'];

  return (
    <main>
      <h1>My Family Tree Viewer</h1>
      <div>
        <FamilyTree
          familyMembers={familyMembersRecord}
          familyRelations={familyRelationsRecord}
          rootMember={rootMember}
        />
      </div>
    </main>
  );
}
