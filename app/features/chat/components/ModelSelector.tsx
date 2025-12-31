import { useState, useMemo } from "react";
import { Check, ChevronDown, Cpu, Zap, Sparkles } from "lucide-react";
import Image from "next/image";
import { SELECTABLE_MODELS, PROVIDER_LABELS, SelectableModel } from "@/lib/core/modelRegistry";

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
      <div className="flex items-center rounded-full bg-[#0f1115] border border-white/5 p-1 px-4 py-1.5 opacity-50 cursor-not-allowed">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
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
        className="flex items-center gap-2 rounded-full bg-[#0f1115] border border-white/5 hover:border-white/10 p-1 px-4 py-1.5 transition-all shadow-lg group"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 group-hover:text-white transition-colors">
          {currentModel?.name || currentModelId}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* DROPDOWN BACKDROP (to close on click outside) */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
      )}

      {/* DROPDOWN CONTENT */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-[350px] bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* TABS HEADER */}
          <div className="flex items-center p-1 bg-[#151515] border-b border-white/5">
            <button
              onClick={() => setActiveTab("providers")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${
                activeTab === "providers"
                  ? "bg-[#252525] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t.modelSelectorProviders || "Providers"}
            </button>
            <button
              onClick={() => setActiveTab("service")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${
                activeTab === "service"
                  ? "bg-[#252525] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t.modelSelectorService || "Service"}
            </button>
          </div>

          <div className="max-h-[450px] overflow-y-auto custom-scrollbar bg-[#0A0A0A]">
            {/* --- PROVIDERS VIEW --- */}
            {activeTab === "providers" && (
              <div className="flex flex-col">
                {/* Horizontal Provider Filter Scroll -> REPLACED WITH GRID */}
                <div className="grid grid-cols-2 gap-2 p-2 border-b border-white/5">
                  {PROVIDER_IDS.map((pid) => {
                    const logoSrc = PROVIDER_LOGOS[pid];
                    return (
                      <button
                        key={pid}
                        onClick={() => setActiveProviderFilter(pid)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border ${
                          activeProviderFilter === pid
                            ? "bg-white text-black border-white shadow-md glow-white"
                            : "bg-[#111] text-white/40 border-white/5 hover:bg-[#1a1a1a] hover:border-white/20"
                        }`}
                      >
                        {logoSrc ? (
                          <div className="relative w-5 h-5 flex-shrink-0">
                            <Image
                              src={logoSrc}
                              alt={PROVIDER_LABELS[pid] || pid}
                              fill
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <Sparkles className="w-5 h-5 flex-shrink-0" />
                        )}
                        <span className="truncate">{PROVIDER_LABELS[pid] || pid}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Models List for Provider */}
                <div className="p-2 space-y-1">
                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {PROVIDER_LABELS[activeProviderFilter]}{" "}
                    {t.modelSelectorModelsSuffix || "MODELS"}
                  </div>

                  {filteredModelsByProvider.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-white/20 italic">
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
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400/80 sticky top-0 bg-[#0A0A0A] z-10">
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
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80 sticky top-0 bg-[#0A0A0A] z-10">
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
        </div>
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
      onClick={() => isAllowed && onSelect()}
      disabled={!isAllowed}
      className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all group ${
        isActive ? "bg-white/10" : "hover:bg-white/5"
      } ${!isAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"}`}
          >
            {model.name}
          </span>
          {!isAllowed && <span className="text-[10px] text-white/30">🔒</span>}
        </div>
        {model.descKey && t[model.descKey] && (
          <div className="text-[11px] text-gray-500 line-clamp-1">{t[model.descKey]}</div>
        )}
      </div>
      {isActive && (
        <div className="bg-blue-500 rounded-full p-0.5 mt-1">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}
