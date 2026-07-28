import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { NmpLogo } from "@/components/layout/NmpLogo";
import { useAuth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/navigation";
import { useApiHealth } from "@/lib/use-api-health";
import { cn } from "@/lib/utils";
import qualityPolicyBg from "@/assets/nmp-quality-policy.png";

const REMEMBER_KEY = "nmp.tarf.rememberUsername";

export function UnifiedLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiHealth = useApiHealth();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(username, password);
      if (!loggedInUser) {
        setError("Incorrect email or password.");
        return;
      }

      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }

      void navigate({ to: dashboardForRole(loggedInUser.role), replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <img src={qualityPolicyBg} aria-hidden alt="" className="login-bg-img" />
      <div className="login-vignette" aria-hidden />

      <div className="login-center">
        <div className="flex w-full max-w-[26rem] flex-col gap-5">
        <div className="w-full rounded-[1.35rem] border border-white/70 bg-white px-7 py-8 shadow-[0_18px_50px_rgba(60,16,24,0.18)] sm:px-8 sm:py-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f8e9eb] shadow-inner">
              <NmpLogo size="sm" className="mx-0 h-11 w-11" />
            </div>
            <h1 className="text-[1.65rem] font-bold tracking-tight text-[#5c121c]">
              Welcome Back
            </h1>
            <p className="mt-1.5 text-[0.92rem] text-slate-500">Please log in to continue.</p>
          </div>

          {apiHealth === "down" ? (
            <div
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left text-sm text-rose-800"
              role="alert"
            >
              <p className="font-medium">API server is not running</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                From project root run <code className="rounded bg-black/10 px-1">npm run start</code>{" "}
                and ensure MongoDB is running.
              </p>
            </div>
          ) : null}

          {apiHealth === "checking" ? (
            <p className="mb-4 text-center text-sm text-slate-500">Checking API connection…</p>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-semibold text-slate-800">
                Username
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-900 outline-none transition",
                    "placeholder:text-slate-400",
                    "focus:border-[#7a1f2b]/55 focus:ring-2 focus:ring-[#7a1f2b]/15",
                    "disabled:opacity-60",
                  )}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "h-11 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-10 text-sm text-slate-900 outline-none transition",
                    "placeholder:text-slate-400",
                    "focus:border-[#7a1f2b]/55 focus:ring-2 focus:ring-[#7a1f2b]/15",
                    "disabled:opacity-60",
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#7a1f2b] accent-[#7a1f2b]"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm font-semibold text-[#7a1f2b] transition hover:text-[#5c121c]"
                onClick={() =>
                  toast.message("Forgot password?", {
                    description: "Contact your system administrator to reset your account.",
                  })
                }
              >
                Forgot password?
              </button>
            </div>

            {error ? (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || apiHealth === "down"}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7a1f2b] text-sm font-semibold text-white shadow-md transition",
                "hover:bg-[#5c121c]",
                "disabled:cursor-not-allowed disabled:opacity-55",
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </form>

          <div className="relative mt-7">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
            <div className="relative mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white">
              <ShieldCheck className="h-4 w-4 text-[#7a1f2b]" aria-hidden />
            </div>
          </div>
        </div>

        <footer className="px-4 text-center">
          <p className="text-xs font-medium text-slate-700/90 drop-shadow-sm">
            © {new Date().getFullYear()} National Museum of the Philippines
          </p>
          <p className="mt-1 text-[11px] text-slate-600/90">
            <button
              type="button"
              className="hover:underline"
              onClick={() => toast.message("Privacy Policy", { description: "Coming soon." })}
            >
              Privacy Policy
            </button>
            <span className="mx-2 text-slate-400">|</span>
            <button
              type="button"
              className="hover:underline"
              onClick={() => toast.message("Terms of Use", { description: "Coming soon." })}
            >
              Terms of Use
            </button>
          </p>
        </footer>
        </div>
      </div>
    </div>
  );
}
