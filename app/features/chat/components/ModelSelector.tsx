import { useState, useMemo } from "react";
import { Check, ChevronDown, Cpu, Zap, Sparkles } from "lucide-react";
import Image from "next/image";
import { SELECTABLE_MODELS, PROVIDER_LABELS, SelectableModel } from "@/lib/core/modelRegistry";
import { Card } from "@/components/ui/card";

const PROVIDER_IDS = [
  "gemini",
  "grok",
  "deepseek",
  "openai",
  "anthropic",
  "groq",
  "openrouter-free",
  "openrouter-pay",
] as const;

const PROVIDER_LOGOS: Record<string, string> = {
  gemini: "/assets/providers/gemini.png",
  grok: "/assets/providers/grok.webp",
  deepseek: "/assets/providers/deepseek.png",
  openai: "/assets/providers/gpt.png",
  anthropic: "/assets/providers/anthropic.png",
  groq: "/assets/providers/groq.png",
  "openrouter-free": "/assets/providers/openrouter.png",
  "openrouter-pay": "/assets/providers/openrouter.png",
};

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "from-blue-500/20 to-purple-500/20 border-blue-500/50",
  grok: "from-gray-600/20 to-gray-400/20 border-gray-400/50",
  deepseek: "from-blue-600/20 to-cyan-400/20 border-blue-400/50",
  openai: "from-emerald-500/20 to-green-500/20 border-emerald-500/50",
  anthropic: "from-orange-400/20 to-amber-200/20 border-amber-400/50",
  groq: "from-orange-600/20 to-red-500/20 border-orange-500/50",
  "openrouter-free": "from-indigo-500/20 to-purple-500/20 border-indigo-500/50",
  "openrouter-pay": "from-indigo-500/20 to-purple-500/20 border-indigo-500/50",
};

// Logos that are black and need to be inverted on dark backgrounds
const NEEDS_INVERSION = new Set([
  "grok",
  "openai",
  "anthropic",
  "groq",
  "openrouter-free",
  "openrouter-pay",
]);

interface ModelSelectorProps {
  // ... (keep interface)
  currentModelId: string;
  onSelectModel: (id: string) => void;
  isModelAllowed: (id: string) => boolean;
  t: Record<string, string>;
  disabled: boolean;
}

export default function ModelSelector({
  currentModelId,
  onSelectModel,
  isModelAllowed,
  t,
  disabled,
}: ModelSelectorProps) {
  // ... (keep state)
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"service" | "providers">("service");
  const [activeProviderFilter, setActiveProviderFilter] = useState<string>("gemini");

  const currentModel = useMemo(
    () => SELECTABLE_MODELS.find((m) => m.id === currentModelId),
    [currentModelId]
  );

  // --- SERVICE VIEW LOGIC ---
  const modelsByCategory = useMemo(() => {
    const groups: Record<"reasoning" | "low-latency", SelectableModel[]> = {
      reasoning: [],
      "low-latency": [],
    };

    SELECTABLE_MODELS.forEach((model) => {
      if (groups[model.category]) {
        groups[model.category].push(model);
      }
    });

    return groups;
  }, []);

  // --- PROVIDERS VIEW LOGIC ---
  const filteredModelsByProvider = useMemo(() => {
    if (activeTab !== "providers") return [];
    return SELECTABLE_MODELS.filter((m) => m.providerId === activeProviderFilter);
  }, [activeTab, activeProviderFilter]);

  if (disabled) {
    return (
      <div className="flex items-center rounded-full bg-(--control-bg) border border-(--control-border) p-1 px-4 py-1.5 opacity-50 cursor-not-allowed">
        <span className="text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
          {currentModel?.name || currentModelId}
        </span>
      </div>
    );
  }

  return (
    <div className="relative z-50">
      {/* TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-(--control-bg) border border-(--control-border) hover:border-(--border) p-1 px-4 py-1.5 transition-all shadow-lg group text-(--text-primary)"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-(--text-secondary) group-hover:text-(--text-primary) transition-colors">
          {currentModel?.name || currentModelId}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-(--text-secondary) transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* DROPDOWN BACKDROP (to close on click outside) */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
      )}

      {/* DROPDOWN CONTENT */}
      {isOpen && (
        <Card className="absolute bottom-full left-0 mb-2 w-[350px] bg-(--surface-muted) border border-(--border) rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* TABS HEADER */}
          <div className="flex items-center p-1 bg-(--control-bg) border-b border-(--border)">
            <button
              onClick={() => setActiveTab("providers")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${
                activeTab === "providers"
                  ? "bg-(--control-bg-hover) text-(--text-primary) shadow-sm"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {t.modelSelectorProviders || "Providers"}
            </button>
            <button
              onClick={() => setActiveTab("service")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${
                activeTab === "service"
                  ? "bg-(--control-bg-hover) text-(--text-primary) shadow-sm"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {t.modelSelectorService || "Service"}
            </button>
          </div>

          <div className="max-h-[450px] overflow-y-auto custom-scrollbar bg-(--surface-muted)">
            {/* --- PROVIDERS VIEW --- */}
            {activeTab === "providers" && (
              <div className="flex flex-col">
                {/* Horizontal Provider Filter Scroll -> REPLACED WITH GRID */}
                <div className="grid grid-cols-3 gap-2 p-2 border-b border-(--border)">
                  {PROVIDER_IDS.map((pid) => {
                    const logoSrc = PROVIDER_LOGOS[pid];
                    const isActive = activeProviderFilter === pid;
                    const needsInvert = NEEDS_INVERSION.has(pid);
                    const activeClass =
                      PROVIDER_COLORS[pid] || "bg-(--control-bg-hover) border-(--border)";

                    return (
                      <button
                        key={pid}
                        onClick={() => setActiveProviderFilter(pid)}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all border bg-linear-to-br ${
                          isActive
                            ? `${activeClass} text-(--text-primary) shadow-lg scale-[1.02]`
                            : "from-transparent to-transparent border-transparent text-(--text-secondary) hover:bg-(--control-bg) hover:text-(--text-primary)"
                        }`}
                      >
                        {logoSrc ? (
                          <div
                            className={`relative w-8 h-8 shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-50 group-hover:opacity-80"}`}
                          >
                            <Image
                              src={logoSrc}
                              alt={PROVIDER_LABELS[pid] || pid}
                              fill
                              className={`object-contain drop-shadow-sm transition-all ${needsInvert ? "invert brightness-200" : ""}`}
                            />
                          </div>
                        ) : (
                          <Sparkles className="w-8 h-8 shrink-0" />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight">
                          {PROVIDER_LABELS[pid] || pid}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Models List for Provider */}
                <div className="p-2 space-y-1">
                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--text-secondary)">
                    {PROVIDER_LABELS[activeProviderFilter]}{" "}
                    {t.modelSelectorModelsSuffix || "MODELS"}
                  </div>

                  {filteredModelsByProvider.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-(--text-secondary) opacity-60 italic">
                      {t.modelSelectorAvailableLater || "Available later"}
                    </div>
                  ) : (
                    filteredModelsByProvider.map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        isActive={model.id === currentModelId}
                        isAllowed={isModelAllowed(model.id)}
                        onSelect={() => {
                          onSelectModel(model.id);
                          setIsOpen(false);
                        }}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* --- SERVICE VIEW --- */}
            {activeTab === "service" && (
              <div className="p-2 space-y-4">
                {/* Reasoning Group */}
                <div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--accent) sticky top-0 bg-(--surface-muted) z-10">
                    <Cpu className="w-3 h-3" />
                    {t.modelCategoryReasoning || "Reasoning"}
                  </div>
                  <div className="space-y-1">
                    {modelsByCategory.reasoning.map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        isActive={model.id === currentModelId}
                        isAllowed={isModelAllowed(model.id)}
                        onSelect={() => {
                          onSelectModel(model.id);
                          setIsOpen(false);
                        }}
                        t={t}
                      />
                    ))}
                  </div>
                </div>

                {/* Low Latency Group */}
                <div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--text-secondary) sticky top-0 bg-(--surface-muted) z-10">
                    <Zap className="w-3 h-3" />
                    {t.modelCategoryLowLatency || "Low Latency"}
                  </div>
                  <div className="space-y-1">
                    {modelsByCategory["low-latency"].map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        isActive={model.id === currentModelId}
                        isAllowed={isModelAllowed(model.id)}
                        onSelect={() => {
                          onSelectModel(model.id);
                          setIsOpen(false);
                        }}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

interface ModelItemProps {
  model: SelectableModel;
  isActive: boolean;
  isAllowed: boolean;
  onSelect: () => void;
  t: Record<string, string>;
}

function ModelItem({ model, isActive, isAllowed, onSelect, t }: ModelItemProps) {
  return (
    <button
      onClick={() => onSelect()}
      className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all group ${
        isActive ? "bg-(--control-bg-hover)" : "hover:bg-(--control-bg)"
      } ${!isAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isActive ? "text-(--text-primary)" : "text-(--text-secondary) group-hover:text-(--text-primary)"}`}
          >
            {model.name}
          </span>
          {!isAllowed && <span className="text-[10px] text-(--text-secondary) opacity-70">🔒</span>}
        </div>
        {model.descKey && t[model.descKey] && (
          <div className="text-[11px] text-(--text-secondary) line-clamp-1">{t[model.descKey]}</div>
        )}
      </div>
      {isActive && (
        <div className="bg-(--accent) rounded-full p-0.5 mt-1">
          <Check className="w-3 h-3 text-(--surface)" />
        </div>
      )}
    </button>
  );
}
