import fs from 'fs';
import path from 'path';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import ArchiveCollectionsClient from '../../components/ArchiveCollectionsClient';

function readArchiveCollections() {
  try {
    const file = path.join(process.cwd(), 'public', 'archive-collections.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data?.collections) ? data.collections : [];
  } catch {
    return [];
  }
}

export default function Timeline() {
  const collections = readArchiveCollections();

  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <ArchiveCollectionsClient initialCollections={collections} />
      </PageTransition>
    </div>
  );
}
