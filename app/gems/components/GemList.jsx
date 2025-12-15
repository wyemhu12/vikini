// /app/gems/components/GemList.jsx
"use client";

export default function GemList({
  loading,
  premade,
  mine,
  selectedGemId,
  onSelect,
  onEdit,
  onDelete,
}) {
  const renderItem = (g, readOnly) => {
    const selected = selectedGemId === g.id;

    return (
      <div
        key={g.id}
        className={`rounded-lg border px-3 py-2 ${
          selected
            ? "border-[var(--primary)] bg-neutral-900/60"
            : "border-neutral-800 bg-neutral-950"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">{g.icon || "◆"}</span>
              <div className="truncate text-sm font-medium">{g.name}</div>
              {g.isPremade ? (
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                  Premade
                </span>
              ) : null}
            </div>
            {g.description ? (
              <div className="mt-1 line-clamp-2 text-[11px] text-neutral-400">
                {g.description}
              </div>
            ) : null}
            <div className="mt-1 text-[10px] text-neutral-500">
              v{g.latestVersion || 0}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => onSelect?.(g)}
              className="rounded-md bg-[var(--primary)] px-2 py-1 text-[11px] text-black"
            >
              Select
            </button>

            {!readOnly && (
              <>
                <button
                  onClick={() => onEdit?.(g)}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-900"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete?.(g)}
                  className="rounded-md border border-red-900/50 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-xs text-neutral-400">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold text-neutral-300">
          Premade by Vikini
        </div>
        <div className="space-y-2">
          {premade?.length ? premade.map((g) => renderItem(g, true)) : (
            <div className="text-xs text-neutral-500">No premade gems.</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-neutral-300">My Gems</div>
        <div className="space-y-2">
          {mine?.length ? mine.map((g) => renderItem(g, false)) : (
            <div className="text-xs text-neutral-500">No gems yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
