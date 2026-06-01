import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Page',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
