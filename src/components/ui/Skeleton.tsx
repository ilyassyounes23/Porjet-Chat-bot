export function PosterSkeleton() {
  return (
    <div className="shrink-0 w-[156px] sm:w-[178px] md:w-[196px]">
      <div className="aspect-[2/3] w-full noir-skeleton border border-white/[0.06]" />
      <div className="mt-2.5 h-3.5 w-3/4 noir-skeleton" />
      <div className="mt-1.5 h-3 w-1/2 noir-skeleton" />
    </div>
  );
}

export function RowSkeleton({ title }: { title?: string }) {
  return (
    <section className="py-5 px-5 sm:px-8 lg:px-14">
      <div className="flex items-center justify-between mb-4">
        {title ? (
          <h2 className="text-sm uppercase tracking-[0.16em] text-[#929292]">{title}</h2>
        ) : (
          <div className="h-4 w-40 noir-skeleton" />
        )}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <PosterSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[84vh] min-h-[580px] max-h-[900px] bg-[#0c0c0c] border-b border-white/[0.06] flex items-end">
      <div className="w-full px-5 sm:px-8 lg:px-14 pb-16 max-w-3xl space-y-5">
        <div className="h-3 w-44 noir-skeleton" />
        <div className="h-14 w-3/4 noir-skeleton" />
        <div className="h-4 w-full noir-skeleton" />
        <div className="h-4 w-4/5 noir-skeleton" />
        <div className="flex gap-3 pt-2">
          <div className="h-11 w-36 noir-skeleton" />
          <div className="h-11 w-40 noir-skeleton" />
        </div>
      </div>
    </div>
  );
}
