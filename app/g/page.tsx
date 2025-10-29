import { familyData } from '@/components/g/data';
import GemClientPage from '@/components/g/GemClientPage';

export default async function GemPage() {
  // optional: fetch or prepare data server-side
  return <GemClientPage initialData={familyData} />;
}
