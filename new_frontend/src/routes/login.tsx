import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import {
  createAccount,
  loginUser,
} from "@/lib/profile-store";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Sahayak" },
      { name: "description", content: "Sign in or create your Sahayak account." },
      { property: "og:title", content: "Sign in — Sahayak" },
      { property: "og:description", content: "Sign in or create your Sahayak account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState<string | null>(null);

  async function login() {
    try {
      const profile = await loginUser(username.trim(), password);
      const profileComplete = !!(profile?.name && profile.dob && profile.occupation);
      navigate({ to: profileComplete ? "/dashboard" : "/profile" });
    } catch {
      toast.error(t("login.errInvalidCredentials"));
    }
  }

  function startRegistration() {
    if (!username.trim() || !password) {
      toast.error(t("login.errEnterUserPass"));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error(t("login.errInvalidMobile"));
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSentOtp(code);
    setStep("otp");
    toast.success(t("login.demoOtpToastTitle", { code }), {
      description: t("login.demoOtpToastDesc", { mobile }),
      duration: 10000,
    });
  }

  async function verifySignupOtp() {
    if (otp !== sentOtp) {
      toast.error(t("login.errIncorrectOtp"));
      return;
    }
    try {
      await createAccount(username.trim(), password, mobile);
      toast.success(t("login.accountCreatedToast"));
      navigate({ to: "/profile" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("login.errUsernameTaken"));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-foreground">
            {mode === "login" ? t("login.titleLogin") : t("login.titleRegister")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? t("login.subtitleLogin") : t("login.subtitleRegister")}
          </p>

          {mode === "login" ? (
            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="username">{t("login.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("login.usernamePlaceholderLogin")}
                />
              </div>
              <div>
                <Label htmlFor="password">{t("login.password")}</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholderLogin")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={login}>
                {t("login.loginBtn")}
              </Button>
            </div>
          ) : step === "form" ? (
            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="username">{t("login.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("login.usernamePlaceholderRegister")}
                />
              </div>
              <div>
                <Label htmlFor="password">{t("login.password")}</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholderRegister")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="mobile">{t("login.mobileLabel")}</Label>
                <div className="mt-1.5 flex">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="mobile"
                    inputMode="numeric"
                    maxLength={10}
                    className="rounded-l-none"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                    placeholder={t("login.mobilePlaceholder")}
                  />
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={startRegistration}>
                {t("login.sendOtp")}
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="otp">{t("login.otpLabel", { mobile })}</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="mt-1.5 tracking-[0.5em] text-center text-lg"
                  placeholder="••••••"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t("login.otpDemoNote")}</p>
                  <button
                    type="button"
                    onClick={startRegistration}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("login.resendOtp")}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1">
                  {t("login.back")}
                </Button>
                <Button onClick={verifySignupOtp} className="flex-1">
                  {t("login.verifyOtp")}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
            {mode === "register" ? (
              <>
                {t("login.alreadyHaveAccount")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setStep("form");
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {t("login.titleLogin")}
                </button>
              </>
            ) : (
              <>
                {t("login.newToSahayak")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setStep("form");
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {t("login.createAccount")}
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}