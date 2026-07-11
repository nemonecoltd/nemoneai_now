"use client";

export default function StoreBanner() {
  return (
    <div className="w-full max-w-md mx-auto mt-6 mb-4 px-1">
      <a
        href="https://smartstore.naver.com/nemone24"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full overflow-hidden rounded-3xl border border-zinc-100 hover:border-emerald-300 transition-all shadow-sm"
      >
        <img
          src="/nemone_banner2.jpg"
          alt="Nemone Store Banner"
          className="w-full h-auto object-cover hover:scale-[1.02] transition-transform duration-700"
        />
      </a>
    </div>
  );
}
