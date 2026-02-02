import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Save, Trash2, Key, CheckCircle, AlertCircle } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { t } = useLanguage();
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Simple feedback state instead of full toast system
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Clear feedback after 3s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load keys from local storage on mount/open
  useEffect(() => {
    if (open) {
      setGeminiKey(localStorage.getItem("vikini-gemini-key") || "");
      setOpenaiKey(localStorage.getItem("vikini-openai-key") || "");
      setReplicateKey(localStorage.getItem("vikini-replicate-key") || "");
      setFeedback(null);
    }
  }, [open]);

  const handleSave = () => {
    try {
      if (geminiKey) localStorage.setItem("vikini-gemini-key", geminiKey);
      else localStorage.removeItem("vikini-gemini-key");

      if (openaiKey) localStorage.setItem("vikini-openai-key", openaiKey);
      else localStorage.removeItem("vikini-openai-key");

      if (replicateKey) localStorage.setItem("vikini-replicate-key", replicateKey);
      else localStorage.removeItem("vikini-replicate-key");

      setFeedback({ type: "success", message: t("studioSettingsSaved") });
    } catch {
      setFeedback({ type: "error", message: t("studioSettingsFailed") });
    }
  };

  const handleClearRequest = () => {
    setShowClearConfirm(true);
  };

  const handleClearConfirm = () => {
    localStorage.removeItem("vikini-gemini-key");
    localStorage.removeItem("vikini-openai-key");
    localStorage.removeItem("vikini-replicate-key");
    setGeminiKey("");
    setOpenaiKey("");
    setReplicateKey("");
    setFeedback({ type: "success", message: t("studioAllKeysCleared") });
    setShowClearConfirm(false);
  };

  const toggleShow = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              {t("studioSettingsTitle")}
            </DialogTitle>
            <DialogDescription>{t("studioSettingsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Feedback Message */}
            {feedback && (
              <div
                className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-1 ${
                  feedback.type === "success"
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : "bg-red-500/10 text-red-500 border border-red-500/20"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {feedback.message}
              </div>
            )}

            {/* Gemini Key */}
            <div className="space-y-2">
              <Label htmlFor="gemini">{t("studioGeminiKey")}</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="gemini"
                  type={showKey.gemini ? "text" : "password"}
                  placeholder="AIzaSy..."
                  className="pl-9 pr-10"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("gemini")}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showKey.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("studioGeminiKeyDesc")}</p>
            </div>

            {/* OpenAI Key */}
            <div className="space-y-2">
              <Label htmlFor="openai">{t("studioOpenaiKey")}</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="openai"
                  type={showKey.openai ? "text" : "password"}
                  placeholder="sk-..."
                  className="pl-9 pr-10"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("openai")}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showKey.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Replicate Key */}
            <div className="space-y-2">
              <Label htmlFor="replicate">{t("studioReplicateKey")}</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="replicate"
                  type={showKey.replicate ? "text" : "password"}
                  placeholder="r8_..."
                  className="pl-9 pr-10"
                  value={replicateKey}
                  onChange={(e) => setReplicateKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("replicate")}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showKey.replicate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={handleClearRequest}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("studioClearAll")}
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              {t("studioSaveSettings")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Keys Confirmation Modal */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studioClearAll")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studioClearKeysConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("studioClearAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
