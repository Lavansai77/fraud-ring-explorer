export function Loading({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center text-slate-400">
      <span className="h-4 w-4 rounded-full border-2 border-graph-400 border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="py-14 text-center border border-dashed border-white/10 rounded-xl">
      <p className="text-slate-300 font-medium">{title}</p>
      {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="py-10 text-center border border-red-500/20 bg-red-500/5 rounded-xl">
      <p className="text-red-300 font-medium">Something went wrong</p>
      <p className="text-red-400/80 text-sm mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-1.5 text-sm rounded-lg bg-red-500/10 text-red-200 hover:bg-red-500/20 transition"
        >
          Try again
        </button>
      )}
    </div>
  );
}
