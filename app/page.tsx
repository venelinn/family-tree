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
    // FIX: Ensure the main container takes up viewport height
    <main style={{ padding: '1rem', height: 'calc(100vh - 2rem)' }}>
      <h1>My Family Tree Viewer {rootPersonId}</h1>
      {/* Ensure the visualization component fills the available space */}
      <div style={{ height: '100%', width: '100%' }}>
        <FamilyTreeVisualization peopleMap={peopleMap} rootId={rootPersonId} />
      </div>
    </main>
  );
}
