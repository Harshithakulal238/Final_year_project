import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut, User, LayoutDashboard, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { clearProfile, useSession } from "@/lib/profile-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export function SiteHeader() {
  const navigate = useNavigate();
  const { profile, hydrated, isAuthed } = useSession();
  const { lang, setLang, t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = profile?.name ?? "";
  const profileComplete = !!(profile?.name && profile?.dob && profile?.occupation);
  const onboarding = isAuthed && !profileComplete;

  if (hydrated && onboarding) return null;

  function doLogout() {
    clearProfile();
    try {
      localStorage.removeItem("sahayak.bookmarks");
    } catch {
      // ignore
    }
    setConfirmOpen(false);
    toast.success(t("header.loggedOutToast"));
    navigate({ to: "/" });
  }

  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to={isAuthed ? "/dashboard" : "/"} className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="truncate text-lg font-semibold tracking-tight text-foreground">
            {t("common.appName")}
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "kn" : "en")}
            aria-label={t("header.langToggleAria")}
            className="mr-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent/20 hover:text-foreground"
          >
            {lang === "en" ? "ಕನ್ನಡ" : "English"}
          </button>
          {!hydrated ? null : isAuthed ? (
            <>
              <NavLink
                to="/dashboard"
                icon={<LayoutDashboard className="h-4 w-4" />}
                label={t("header.home")}
              />
              <NavLink
                to="/results"
                icon={<FileText className="h-4 w-4" />}
                label={t("header.mySchemes")}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20"
                  aria-label={t("header.accountMenuAria")}
                >
                  {(name || "U").slice(0, 1).toUpperCase()}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {name || t("header.dashboard")}
                    {profile?.mobile ? (
                      <div className="text-xs font-normal text-muted-foreground">
                        {t("header.mobilePrefix", { mobile: profile.mobile })}
                      </div>
                    ) : (
                      <div className="text-xs font-normal text-muted-foreground">
                        {t("header.guestSession")}
                      </div>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard" })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> {t("header.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
                    <User className="mr-2 h-4 w-4" /> {t("header.viewProfile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate({ to: "/profile", hash: "edit" })}>
                    <Pencil className="mr-2 h-4 w-4" /> {t("header.editProfile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirmOpen(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> {t("header.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm" className="rounded-full px-4">
                {t("header.signIn")}
              </Button>
            </Link>
          )}
        </nav>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("header.logoutConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("header.logoutConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("header.logoutCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doLogout}>{t("header.logoutConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

function NavLink({
  to,
  icon,
  label,
}: {
  to: "/dashboard" | "/results";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent/20 hover:text-foreground sm:inline-flex"
      activeProps={{ className: "text-foreground font-medium bg-accent/10" }}
    >
      <span className="text-muted-foreground/80">{icon}</span>
      {label}
    </Link>
  );
}
