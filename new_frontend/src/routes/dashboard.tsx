import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/profile-store";
import { confidenceScore, evaluateAll, getAge } from "@/lib/eligibility";
import {
  ArrowRight,
  Compass,
  FileText,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sahayak" },
      {
        name: "description",
        content: "Your Sahayak home: scheme matches, profile status, and quick actions.",
      },
      { property: "og:title", content: "Dashboard — Sahayak" },
      { property: "og:description", content: "Personal home for scheme discovery." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { profile, hydrated, isAuthed } = useSession();
  const { t } = useLanguage();

  useEffect(() => {
    if (hydrated && !isAuthed) navigate({ to: "/login" });
  }, [hydrated, isAuthed, navigate]);

  const evalResult = useMemo(
    () => (profile && profile.dob ? evaluateAll(profile) : null),
    [profile],
  );
  const conf = useMemo(() => (profile ? confidenceScore(profile) : null), [profile]);

  if (!hydrated || !profile) return null;

  const firstName = (profile.name || "friend").split(" ")[0];
  const eligibleCount = evalResult?.eligible.length ?? 0;
  const topPick = evalResult?.eligible[0];
  const profileComplete = !!(profile.name && profile.dob && profile.occupation);
  const age = profile.dob ? getAge(profile.dob) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Welcome */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-950 p-6 text-white shadow-xl sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
              {profile.verified ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />{" "}
                  {t("dashboard.verifiedBadge", { mobile: profile.mobile })}
                </>
              ) : (
                <>
                  <UserCircle2 className="h-3.5 w-3.5 text-amber-300" /> {t("dashboard.guestBadge")}
                </>
              )}
            </div>
            <h1
              style={{ fontFamily: "'Playfair Display', 'Noto Sans Kannada', serif" }}
              className="mt-4 text-3xl font-black leading-tight sm:text-5xl"
            >
              {t("dashboard.welcomeBackPrefix")} <span className="text-amber-400">{firstName}</span>
              .
            </h1>
            <p className="mt-3 max-w-xl text-sm text-teal-100/90 sm:text-base">
              {profileComplete
                ? t("dashboard.matchCount", {
                    count: eligibleCount,
                    suffix: eligibleCount === 1 ? "" : "s",
                  })
                : t("dashboard.completeProfilePrompt")}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
              <MiniStat
                label={t("dashboard.statEligibleSchemes")}
                value={profileComplete ? String(eligibleCount) : "—"}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <MiniStat
                label={t("dashboard.statTopMatchScore")}
                value={topPick ? `${topPick.score}/100` : "—"}
                icon={<Sparkles className="h-4 w-4" />}
              />
              <MiniStat
                label={t("dashboard.statConfidence")}
                value={conf ? `${conf.level} · ${conf.pct}%` : "—"}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("dashboard.quickActions")}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <ActionCard
              to="/results"
              tone="teal"
              title={t("dashboard.findSchemesTitle")}
              body={t("dashboard.findSchemesBody")}
              icon={<Compass className="h-6 w-6" />}
              cta={t("dashboard.findSchemesCta")}
            />
            <ActionCard
              to="/results"
              tone="amber"
              title={t("dashboard.mySchemesTitle")}
              body={t("dashboard.mySchemesBody")}
              icon={<FileText className="h-6 w-6" />}
              cta={t("dashboard.mySchemesCta")}
            />
            <ActionCard
              to="/profile"
              tone="slate"
              title={t("dashboard.profileTitle")}
              body={
                profileComplete
                  ? t("dashboard.profileBodyComplete")
                  : t("dashboard.profileBodyIncomplete")
              }
              icon={<UserCircle2 className="h-6 w-6" />}
              cta={
                profileComplete
                  ? t("dashboard.profileCtaManage")
                  : t("dashboard.profileCtaComplete")
              }
            />
          </div>
        </section>

        {/* Snapshot */}
        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {topPick && (
            <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                  <Sparkles className="h-3.5 w-3.5" /> {t("dashboard.topPickBadge")}
                </span>
                <span className="text-xs text-slate-500">{topPick.scheme.category}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{topPick.scheme.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{topPick.scheme.description}</p>
              <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
                <span className="font-medium">{t("dashboard.why")}</span>
                {topPick.explanation}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {topPick.scheme.benefits}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t("dashboard.matchScoreLabel", { score: topPick.score })}
                  </div>
                </div>
                <Link
                  to="/scheme/$id"
                  params={{ id: topPick.scheme.id }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
                >
                  {t("dashboard.viewDetails")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              {t("dashboard.profileSnapshot")}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <SnapshotRow k={t("dashboard.name")} v={profile.name || "—"} />
              <SnapshotRow k={t("dashboard.age")} v={age ? t("common.years", { n: age }) : "—"} />
              <SnapshotRow k={t("dashboard.occupation")} v={profile.occupation || "—"} />
              <SnapshotRow k={t("dashboard.rationCard")} v={profile.rationCard} />
              <SnapshotRow
                k={t("dashboard.location")}
                v={
                  profile.location?.district
                    ? `${profile.location.village || profile.location.taluk || ""} · ${profile.location.district}, ${profile.location.state}`
                    : "—"
                }
                icon={<MapPin className="h-3.5 w-3.5" />}
              />
            </dl>
            <Link to="/profile" className="mt-5 block">
              <Button variant="outline" className="w-full">
                {t("dashboard.editProfile")}
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-teal-100/80">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ActionCard({
  to,
  title,
  body,
  icon,
  cta,
  tone,
}: {
  to: "/results" | "/profile";
  title: string;
  body: string;
  icon: React.ReactNode;
  cta: string;
  tone: "teal" | "amber" | "slate";
}) {
  const iconWrap =
    tone === "amber"
      ? "bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white"
      : tone === "slate"
        ? "bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white"
        : "bg-teal-100 text-teal-700 group-hover:bg-teal-700 group-hover:text-white";
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${iconWrap}`}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-600">{body}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-700">
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function SnapshotRow({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
        {icon}
        {k}
      </dt>
      <dd className="text-right text-sm font-medium capitalize text-slate-900">{v}</dd>
    </div>
  );
}
