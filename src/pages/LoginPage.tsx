// =====================================================================
// หน้า 0 — เข้าสู่ระบบ (§5)
// อีเมล + รหัสผ่านผ่าน Supabase Auth
// =====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
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
    <div className="min-h-screen bg-bone flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="font-display text-4xl font-bold text-royal tracking-wide">Aunchan</p>
          <p className="text-ink/70 mt-1">ระบบขายหน้าร้านและจัดการสต็อก</p>
        </div>

        <form onSubmit={onSubmit} className="panel p-4 space-y-4">
          <TextField
            label="อีเมล"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            label="รหัสผ่าน"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </div>
    </div>
  );
}
