import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import PublicAiChat from '../../components/PublicAiChat';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `AI 聊天 | ${siteConfig.title}`,
  description: '站内 GPT 聊天工具，支持连续对话、识图和思考强度选择',
};

export default function AiChatPage() {
  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <PublicAiChat />
      </PageTransition>
    </div>
  );
}
