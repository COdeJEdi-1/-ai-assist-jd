import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { ArvindGccBrand } from "../components/brand/ArvindGccBrand";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("manav.raval@arvindgcc.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error ?? "Login failed. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-bg">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-maroon-dark p-12 text-white">
        <ArvindGccBrand variant="dark" />

        <div className="space-y-6">
          <h1 className="text-4xl font-heading leading-tight">
            Enterprise HR Voice Screening
          </h1>
          <p className="text-lg text-white/80 leading-relaxed max-w-md">
            Secure access for Arvind GCC HR teams to manage AI-powered candidate
            screening campaigns.
          </p>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              Campaign monitoring &amp; analytics
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              AI voice agent screening
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              Structured reports &amp; exports
            </li>
          </ul>
        </div>

        <p className="text-xs text-white/50">
          © {new Date().getFullYear()} Arvind GCC. Internal use only.
        </p>
      </div>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 animate-fade-in">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <div className="mb-6 flex justify-center lg:hidden">
              <ArvindGccBrand variant="light" />
            </div>
            <h2 className="text-2xl font-heading text-gray-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-grey-secondary">
              Sign in to your HR platform account
            </p>
          </div>

          <div className="rounded-card bg-surface-card p-8 shadow-card animate-slide-up">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-button bg-red-50 px-4 py-3 text-sm text-status-error animate-fade-in">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 mt-0.5"
                    strokeWidth={1.75}
                  />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-button text-gray-800"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-secondary"
                    strokeWidth={1.75}
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@arvindgcc.com"
                    autoComplete="email"
                    className="w-full rounded-input border border-grey-border bg-white py-3 pl-10 pr-4 text-sm transition-colors focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-button text-gray-800"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-secondary"
                    strokeWidth={1.75}
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-input border border-grey-border bg-white py-3 pl-10 pr-10 text-sm transition-colors focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-secondary hover:text-gray-800"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-grey-border text-maroon focus:ring-maroon/20"
                  />
                  <span className="text-sm text-grey-secondary">
                    Remember me
                  </span>
                </label>
                <button
                  type="button"
                  className="text-sm font-button text-maroon hover:text-maroon-hover transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" loading={isLoading} className="w-full py-3">
                Sign In
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-grey-secondary border-t border-grey-border pt-6">
              Demo:{" "}
              <span className="font-button">manav.raval@arvindgcc.com</span>
              {" · "}
              Password: <span className="font-button">ArvindGCC@2026</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
