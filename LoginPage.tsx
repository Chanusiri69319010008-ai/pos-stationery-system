// =====================================================================
// หน้า 0 — เข้าสู่ระบบ (§5)
// อีเมล + รหัสผ่านผ่าน Supabase Auth
//
// หน้านี้เป็นหน้าเดียวของระบบที่ตกแต่งเกินกติกา §8 ได้ (พื้นหลังอนุภาค
// การ์ดกระจกฝ้า เงานุ่ม) เพราะไม่มีตัวเลขเงินให้อ่านและไม่ใช่หน้าทำงาน
// หน้าอื่นทั้งหมดยังยึด §8 เดิม: พื้น Paper เส้นขอบบาง ไม่มีเงา ไม่มี gradient
// =====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { ParticleField } from "../components/ui/ParticleField";
import { paths } from "../routes/paths";

export function LoginPage() {
  const { session, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "เข้าสู่ระบบ — Aunchan";
  }, []);

  if (!loading && session) return <Navigate to={paths.pos} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate(paths.pos, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bone flex items-center justify-center p-4">
      {/* ชั้นที่ 1 — อนุภาคลอยพร้อมเส้นเชื่อม */}
      <div className="absolute inset-0 pointer-events-none">
        <ParticleField className="w-full h-full" />
      </div>

      {/* ชั้นที่ 2 — ไล่แสงนวลจากมุมบนซ้าย (ฟ้า) และมุมล่างขวา (ครีม)
          ช่วยดันสายตาเข้าหากลางจอ ไม่ให้อนุภาคแย่งความสนใจจากฟอร์ม */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60rem 40rem at 12% 8%, rgba(208,230,253,0.55), transparent 60%)," +
            "radial-gradient(52rem 38rem at 88% 92%, rgba(241,228,209,0.75), transparent 62%)",
        }}
      />

      {/* ชั้นที่ 3 — ฟอร์ม */}
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-6">
          <p
            className="font-display text-5xl font-bold text-royal tracking-wide animate-rise-in"
            style={{ animationDelay: "60ms" }}
          >
            Aunchan
          </p>
          <p
            className="text-ink/70 mt-1 animate-rise-in"
            style={{ animationDelay: "180ms" }}
          >
            ระบบขายหน้าร้านและจัดการสต็อก
          </p>
          <div
            className="mx-auto mt-4 h-px w-16 bg-royal/30 animate-rise-in"
            style={{ animationDelay: "260ms" }}
          />
        </div>

        <form
          onSubmit={onSubmit}
          className="glass-panel p-5 space-y-4 animate-lift-in"
          style={{ animationDelay: "320ms" }}
        >
          <TextField
            label="อีเมล"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-paper/80"
          />

          <TextField
            label="รหัสผ่าน"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-paper/80"
          />

          {error && (
            <p className="text-danger border border-danger/40 bg-paper/70 rounded px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={busy}
            className="press-scale"
          >
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
        </form>

        <p
          className="text-center text-xs text-ink/50 mt-4 animate-rise-in"
          style={{ animationDelay: "440ms" }}
        >
          ลืมรหัสผ่าน ติดต่อเจ้าของร้านเพื่อรีเซ็ตให้
        </p>
      </div>
    </div>
  );
}
