import { redirect } from 'next/navigation';

export const metadata = {
  title: '推荐表',
  description: '推荐表已迁移到独立页面。',
};

export default function SharePage() {
  redirect('/recommendations');
}