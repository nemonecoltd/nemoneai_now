"use client";

import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get('q') || '');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/');
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full mt-4 group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors">
        <Search size={18} />
      </div>
      <input 
        type="text"
        placeholder="어디로 떠나볼까요?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-zinc-100 border-none rounded-2xl py-3.5 pl-12 pr-10 text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all text-sm font-medium"
      />
      {query && (
        <button 
          type="button"
          onClick={() => { setQuery(''); router.push('/'); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          <X size={18} />
        </button>
      )}
    </form>
  );
}
