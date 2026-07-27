import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LoginProps {
  onSuccess: () => void;
}

const PIN_LENGTH = 6;

export default function Login({ onSuccess }: LoginProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    if (loading) return;
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      // Auto-submit when PIN is complete
      if (next.length === PIN_LENGTH) {
        submitPin(next);
      }
      return next;
    });
  }, [loading]);

  const handleDelete = useCallback(() => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
  }, [loading]);

  const submitPin = async (pinValue: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin: pinValue }),
      });

      if (res.ok) {
        toast.success("Bem-vindo de volta!");
        onSuccess();
      } else {
        setShake(true);
        setPin("");
        toast.error("PIN incorreto");
        setTimeout(() => setShake(false), 600);
      }
    } catch {
      toast.error("Erro de conexão");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient neon glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-emerald-400/6 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-xs flex flex-col items-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="mb-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/10">
            <img src="/sobra-logo.svg" alt="Sobra" className="h-10 w-auto" />
          </div>
          <h1 className="text-2xl font-medium text-foreground tracking-[-1px] text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            sobra
          </h1>
        </motion.div>

        {/* PIN Dots */}
        <motion.div
          animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="flex items-center gap-3 mb-8"
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <motion.div
              key={i}
              className="relative"
              animate={pin.length === i ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3, repeat: pin.length === i ? Infinity : 0, repeatDelay: 0.8 }}
            >
              <div
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? "bg-primary shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    : "bg-secondary border border-border"
                }`}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 mb-4 text-primary"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Verificando...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {digits.map((digit, i) => {
            if (digit === "") {
              return <div key={i} />;
            }
            if (digit === "del") {
              return (
                <motion.button
                  key={i}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDelete}
                  disabled={loading || pin.length === 0}
                  className="h-16 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-150 disabled:opacity-30"
                >
                  <Delete className="w-6 h-6" />
                </motion.button>
              );
            }
            return (
              <motion.button
                key={i}
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => handleDigit(digit)}
                disabled={loading}
                className="h-16 rounded-2xl bg-secondary/40 border border-border/40 flex items-center justify-center text-2xl font-medium text-foreground hover:bg-secondary/70 active:bg-primary/20 transition-all duration-150 disabled:opacity-50"
              >
                {digit}
              </motion.button>
            );
          })}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/60 mt-6">
          PIN definido via APP_PIN
        </p>
      </motion.div>
    </div>
  );
}
