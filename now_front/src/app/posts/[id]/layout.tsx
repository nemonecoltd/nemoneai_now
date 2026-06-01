import { Metadata } from 'next';

const BACKEND = 'http://127.0.0.1:8081';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${BACKEND}/places`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const places = Array.isArray(data) ? data : (data.places || []);
      const place = places.find((p: any) => String(p.id) === params.id);
      if (place) {
        const title = place.title_en ? `${place.title} · ${place.title_en}` : place.title;
        const description = (place.content || '').slice(0, 160);
        return {
          title,
          description,
          alternates: {
            canonical: `https://now.nemoneai.com/posts/${params.id}`,
          },
          openGraph: {
            title,
            description,
            url: `https://now.nemoneai.com/posts/${params.id}`,
            images: place.image_url ? [{ url: place.image_url, alt: place.title }] : ['/og-image.png'],
            type: 'article',
            locale: 'ko_KR',
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: place.image_url ? [place.image_url] : ['/og-image.png'],
          },
        };
      }
    }
  } catch {}

  return {
    alternates: {
      canonical: `https://now.nemoneai.com/posts/${params.id}`,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
