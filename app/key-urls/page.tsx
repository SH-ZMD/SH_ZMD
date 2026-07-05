import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import KeyUrlPublicTable from '../../components/KeyUrlPublicTable';
import Comments from '../../components/Comments';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `中转站 | ${siteConfig.title}`,
  description: '中转站、镜像站和资源入口推荐表。',
};

export default function KeyUrlsPage() {
  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <>
          <KeyUrlPublicTable />
          <main className="w-[95%] max-w-5xl mx-auto relative z-10">
            <Comments pageId="/key-urls" />
          </main>
        </>
      </PageTransition>
    </div>
  );
}
