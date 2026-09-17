// Toast — แจ้งผลลัพธ์พร้อมตัวเลขจริงที่บันทึกไป (§8)
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Tone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: Tone;
};

type ToastApi = {
  showToast: (message: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneClass: Record<Tone, string> = {
  success: "border-success text-success",
  error: "border-danger text-danger",
  info: "border-royal text-royal",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)] space-y-2 no-print">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`bg-paper border rounded px-4 py-3 shadow-lg ${toneClass[item.tone]}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast ต้องอยู่ภายใน ToastProvider");
  return context;
}
