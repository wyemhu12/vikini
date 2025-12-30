"use client";

import { useState, useEffect } from "react";
import { Gem, Loader2, Plus, Edit2, Trash2, AlertCircle, X } from "lucide-react";
import GemEditor from "@/app/features/gems/components/GemEditor";
import { AnimatePresence, motion } from "framer-motion";

interface PremadeGem {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  icon: string | null;
  color: string | null;
  is_premade: boolean;
}

export default function GemsManager() {
  const [gems, setGems] = useState<PremadeGem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingGem, setEditingGem] = useState<PremadeGem | null>(null);

  useEffect(() => {
    fetchGems();
  }, []);

  const fetchGems = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/gems");
      if (!res.ok) throw new Error("Failed to fetch gems");
      const data = await res.json();
      setGems(data.gems || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gems");
    } finally {
      setLoading(false);
    }
  };

  const deleteGem = async (gemId: string) => {
    if (!confirm("Are you sure you want to delete this GEM?")) return;

    try {
      const res = await fetch(`/api/admin/gems?id=${gemId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete gem");

      await fetchGems();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete gem");
    }
  };

  const handleSaveGem = async (gemData: any) => {
    try {
      const method = gemData.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/gems", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save gem");
      }

      await fetchGems();
      setIsEditorOpen(false);
      setEditingGem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save gem");
    }
  };

  const openAddModal = () => {
    setEditingGem(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (gem: PremadeGem) => {
    setEditingGem(gem);
    setIsEditorOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">Loading gems...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-4">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gem className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Global GEMs Management</h2>
          <span className="text-sm text-gray-500">({gems.length} gems)</span>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add GEM
        </button>
      </div>

      {gems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Gem className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No global GEMs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gems.map((gem) => (
            <div
              key={gem.id}
              className="p-4 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {gem.icon && <span className="text-2xl">{gem.icon}</span>}
                  <h3 className="font-semibold text-white">{gem.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(gem)}
                    className="p-1.5 rounded hover:bg-white/10 transition-all"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                  <button
                    onClick={() => deleteGem(gem.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
              {gem.description && (
                <p className="text-sm text-gray-400 line-clamp-2">{gem.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl relative"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-10">
                <h3 className="text-lg font-semibold text-white">
                  {editingGem ? "Edit Global GEM" : "Create Global GEM"}
                </h3>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <GemEditor
                  gem={editingGem || undefined} // GemEditor expects undefined for new
                  onSave={handleSaveGem}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
