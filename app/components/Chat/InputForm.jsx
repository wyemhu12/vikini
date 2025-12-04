"use client";

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  disabled,
  t,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-neutral-800 bg-neutral-950 px-4 py-3"
    >
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={input}
          placeholder={t.placeholder}
          onChange={(e) => onChangeInput(e.target.value)}
          className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-base sm:text-lg"
        />

        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm sm:text-base font-medium text-black disabled:opacity-40"
        >
          {t.send}
        </button>
      </div>
    </form>
  );
}
