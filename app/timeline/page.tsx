import fs from 'fs';
import path from 'path';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import ArchiveCollectionsClient from '../../components/ArchiveCollectionsClient';
import Comments from '../../components/Comments';
import { siteConfig } from '../../siteConfig';

function readArchiveCollections() {
  try {
    const file = path.join(process.cwd(), 'public', 'archive-collections.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data?.collections) ? data.collections : [];
  } catch {
    return [];
  }
}

export const metadata = {
  title: `归档 | ${siteConfig.title}`,
  description: "文章、杂谈与说说的完整时间线归档",
};

export default function Timeline() {
  const collections = readArchiveCollections();

  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <>
          <ArchiveCollectionsClient initialCollections={collections} />
          <main className="w-[95%] max-w-5xl mx-auto relative z-10">
            <Comments pageId="/timeline" />
          </main>
        </>
      </PageTransition>
    </div>
  );
}
