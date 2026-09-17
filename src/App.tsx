import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./components/ui/Toast";
import { SetupNotice } from "./components/ui/SetupNotice";
import { AppRoutes } from "./routes/AppRoutes";
import { isSupabaseConfigured } from "./lib/supabase";

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
