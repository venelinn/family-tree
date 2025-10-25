// src/app/page.tsx
import { PersonNode } from '../lib/types';
import { getAllPeople } from '../lib/familyData';
import FamilyTreeVisualization from '../components/FamilyTreeVisualization';

// The page component is async, running on the server/at build time
export default async function HomePage() {
  const peopleMap: Map<string, PersonNode> = await getAllPeople();

  // You confirmed @I85@ is your ID in the previous prompt.
  const rootPersonId = '@I85@';

  if (peopleMap.size === 0) {
    return <p>Error: Could not load or process family tree data.</p>;
  }

  return (
    <main style={{ padding: '1rem' }}>
      <h1>My Family Tree Viewer {rootPersonId}</h1>
      <FamilyTreeVisualization peopleMap={peopleMap} rootId={rootPersonId} />
    </main>
  );
}
