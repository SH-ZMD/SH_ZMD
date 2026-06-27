import fs from 'fs';
import path from 'path';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import KeyUrlPublicTable from '../../components/KeyUrlPublicTable';
import ShareBoard from './ShareBoard';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `分享表 | ${siteConfig.title}`,
  description: '推荐资源、工具、课程和 Key 链接的统一分享面板',
};

type RecommendType = 'course' | 'software' | 'skill' | 'tool' | 'site' | 'book' | 'other';

type RecommendationItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  type: RecommendType;
  tags: string[];
  rating: number;
  note: string;
};

type RecommendationGroup = {
  id: string;
  name: string;
  description: string;
  items: RecommendationItem[];
};

function readRecommendationGroups(): RecommendationGroup[] {
  try {
    const file = path.join(process.cwd(), 'public', 'life-modules.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data?.recommendationGroups) ? data.recommendationGroups : [];
  } catch {
    return [];
  }
}

export default function SharePage() {
  const groups = readRecommendationGroups();

  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <ShareBoard
          keyUrlTable={<KeyUrlPublicTable />}
          recommendationGroups={groups}
        />
      </PageTransition>
    </div>
  );
}
