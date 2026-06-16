"use client";

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Filter, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Place {
  id: number;
  title: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

let isApiLoading = false;

const REGIONS = {
  '성수': { lat: 37.5445, lng: 127.0560, title: '성수 팝업 맵' },
  '홍대': { lat: 37.5575, lng: 126.9245, title: '홍대 팝업 맵' }
};

export default function MapView({ places = [], region = '성수', lang = 'ko' }: { places?: Place[], region?: string, lang?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (window.google) {
      setMapLoaded(true);
      return;
    }
    if (isApiLoading) return;
    isApiLoading = true;

    window.initMap = () => setMapLoaded(true);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&v=weekly`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mapLoaded && mapRef.current && window.google) {
      const currentRegion = REGIONS[region as keyof typeof REGIONS] || REGIONS['성수'];
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: currentRegion.lat, lng: currentRegion.lng },
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        styles: [
          { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
          { "featureType": "transit", "stylers": [{ "visibility": "simplified" }] }
        ]
      });
      
      setMapInstance(map);

      places.forEach((place: any, idx) => {
        const position = (place.latitude && place.longitude) 
          ? { lat: Number(place.latitude), lng: Number(place.longitude) }
          : { 
              lat: currentRegion.lat + (Math.random() - 0.5) * 0.006, 
              lng: currentRegion.lng + (Math.random() - 0.5) * 0.006 
            };

        const marker = new window.google.maps.Marker({
          position,
          map,
          title: lang === 'en' ? (place.title_en || place.title) : place.title,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: region === '홍대' ? '#8b5cf6' : '#10b981', // 홍대는 보라색, 성수는 에메랄드
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 7,
          }
        });

        // 마커 클릭 시 상세 페이지로 이동
        marker.addListener('click', () => {
          router.push(`/posts/${place.id}?region=${encodeURIComponent(region)}`);
        });
      });
    }
  }, [mapLoaded, places, router, region, lang]);

  const handleMyLocation = () => {
    if (!mapInstance) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          mapInstance.panTo(pos);
          mapInstance.setZoom(17);
          
          // 내 위치 마커 표시 (파란색 점)
          new window.google.maps.Marker({
            position: pos,
            map: mapInstance,
            title: lang === 'en' ? "My Location" : "내 위치",
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            }
          });
        },
        () => {
          alert(lang === 'en' ? "Unable to retrieve your location." : "현재 위치를 가져올 수 없습니다.");
        }
      );
    } else {
      alert(lang === 'en' ? "Geolocation is not supported by your browser." : "브라우저가 위치 정보를 지원하지 않습니다.");
    }
  };

  return (
    <div className="w-full h-[calc(100vh-180px)] bg-zinc-50 relative overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* Floating Info Card */}
      <div className="absolute top-6 left-6 right-6 z-50 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white/40 shadow-2xl flex items-center gap-4 pointer-events-auto">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner",
            region === '홍대' ? "bg-purple-500" : "bg-emerald-500"
          )}>
            <Calendar size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">
              {lang === 'en' 
                ? `${region === '성수' ? 'Seongsu' : 'Hongdae'} Map` 
                : (REGIONS[region as keyof typeof REGIONS]?.title || '지금 여기 팝업 맵')}
            </h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {lang === 'en' ? 'Tap markers for details' : '마커를 누르면 상세 정보를 확인합니다'}
            </p>
          </div>
        </div>
      </div>
      
      {/* My Location Button */}
      <button 
        onClick={handleMyLocation}
        className="fixed bottom-28 left-6 z-[60] bg-white p-3.5 rounded-full shadow-2xl border border-zinc-200 text-zinc-600 hover:text-emerald-500 hover:border-emerald-500 transition-all active:scale-95 flex items-center justify-center"
        aria-label="My Location"
      >
        <Navigation size={24} className="fill-zinc-600 hover:fill-emerald-500" />
      </button>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-400 animate-pulse">
              {lang === 'en' ? 'Syncing Map...' : '지도를 연동 중입니다...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
