import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import KeyUrlPublicTable from '../../components/KeyUrlPublicTable';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `资源表 | ${siteConfig.title}`,
  description: 'API Key、URL 与推广链接资源展示表',
};

export default function KeyUrlsPage() {
  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <KeyUrlPublicTable />
      </PageTransition>
    </div>
  );
}
