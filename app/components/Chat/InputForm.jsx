"use client";

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  disabled,
  t,
}) {
  const handleSubmit = (e) => {
    onSubmit(e);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-neutral-800 bg-neutral-950 p-3"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          rows={1}
          value={input}
          placeholder={t.placeholder}
          onChange={(e) => onChangeInput(e.target.value)}
          className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-500"
        />

        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-black disabled:opacity-40"
        >
          {t.send}
        </button>
      </div>
    </form>
  );
}
