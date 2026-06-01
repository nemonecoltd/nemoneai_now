import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '피드백',
  description: '지금여기 서비스 개선을 위한 피드백을 보내주세요.',
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
