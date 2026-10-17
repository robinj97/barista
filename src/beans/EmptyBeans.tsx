/** First-use state: one clear action. */
export function EmptyBeans({ onAdd }: { onAdd: () => void }) {
  return (
    <section aria-label="No beans yet" className="mt-16 flex flex-col items-center text-center">
      <div className="relative mb-6 h-20 w-32" aria-hidden>
        <span className="pebble-1 absolute top-3 left-1 size-16 bg-tint-sand" />
        <span className="pebble-2 absolute top-0 left-10 size-14 bg-tint-sage" />
        <span className="pebble-3 absolute top-6 left-[4.5rem] size-14 bg-tint-rose" />
      </div>
      <h2 className="text-xl font-medium">Add your first bag</h2>
      <p className="mt-2 max-w-64 text-sm text-balance text-muted">Search for it or type it in. About 30 seconds.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 h-12 rounded-full bg-ink px-8 font-medium text-bg transition-transform active:scale-[0.98]"
      >
        Add a bag
      </button>
    </section>
  )
}
