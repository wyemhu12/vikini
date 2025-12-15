// /app/gems/components/GemEditor.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

export default function GemEditor({ gem, onSave }) {
  const isReadOnly = !!gem?.isPremade;

  const [dirty, setDirty] = useState(false);

  const [id, setId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    setId(gem?.id || null);
    setName(gem?.name || "");
    setDescription(gem?.description || "");
    setInstructions(gem?.instructions || "");
    setIcon(gem?.icon || "");
    setColor(gem?.color || "");
    setDirty(false);
  }, [gem?.id]); // switch gem

  const canSave = useMemo(() => {
    if (isReadOnly) return false;
    if (!name.trim()) return false;
    return dirty;
  }, [dirty, isReadOnly, name]);

  const title = gem
    ? isReadOnly
      ? "View Gem (Premade)"
      : `Edit Gem${dirty ? " (Gem not saved)" : ""}`
    : "Select or create a Gem";

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    setDirty(true);
  };

  const save = () => {
    if (!canSave) return;
    onSave?.({
      id,
      name,
      description,
      instructions,
      icon,
      color,
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <button
          onClick={save}
          disabled={!canSave}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-black disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {!gem ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm text-neutral-300">
          Chọn một Gem để xem / sửa, hoặc bấm <b>+ New Gem</b>.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-neutral-400">Name</label>
              <input
                value={name}
                onChange={handleChange(setName)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Icon</label>
              <input
                value={icon}
                onChange={handleChange(setIcon)}
                disabled={isReadOnly}
                placeholder="💡"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">
              Description
            </label>
            <input
              value={description}
              onChange={handleChange(setDescription)}
              disabled={isReadOnly}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Color</label>
            <input
              value={color}
              onChange={handleChange(setColor)}
              disabled={isReadOnly}
              placeholder="amber | indigo | charcoal | ..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">
              Instructions (versioned)
            </label>
            <textarea
              value={instructions}
              onChange={handleChange(setInstructions)}
              disabled={isReadOnly}
              rows={14}
              className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-6 outline-none disabled:opacity-60"
            />
            <div className="mt-1 text-[11px] text-neutral-500">
              Mỗi lần Save sẽ tạo 1 version mới trong <code>gem_versions</code>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
