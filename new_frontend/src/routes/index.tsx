import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { ArrowRight, Search, Sparkles, ShieldCheck, FileText } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sahayak — Find Government Schemes You Qualify For" },
      {
        name: "description",
        content:
          "Sahayak matches you with central and state government schemes based on your age, income, occupation and background — in under two minutes.",
      },
      { property: "og:title", content: "Sahayak — Find Government Schemes You Qualify For" },
      {
        property: "og:description",
        content: "Personalised, AI-ranked scheme recommendations with clear eligibility reasons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useLanguage();

  const STEPS = [
    { title: t("landing.step1Title"), body: t("landing.step1Body") },
    { title: t("landing.step2Title"), body: t("landing.step2Body") },
    { title: t("landing.step3Title"), body: t("landing.step3Body") },
    { title: t("landing.step4Title"), body: t("landing.step4Body") },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-[Inter,Noto_Sans_Kannada,ui-sans-serif,system-ui] selection:bg-teal-100 selection:text-teal-900">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-teal-950 py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <svg
              className="h-full w-full"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern
                  id="mandala"
                  x="0"
                  y="0"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="20"
                    cy="20"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-teal-200"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-teal-200"
                  />
                  <path
                    d="M20 5 L20 35 M5 20 L35 20"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-teal-200"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mandala)" />
            </svg>
          </div>
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-teal-800 opacity-40 blur-3xl" />
          <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-8 flex items-center gap-3 rounded-full bg-teal-900/50 px-4 py-1.5 ring-1 ring-teal-700/50 backdrop-blur-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                <span className="text-xs font-medium uppercase tracking-wide text-teal-100">
                  {t("landing.badge")}
                </span>
              </div>
              <h1
                style={{ fontFamily: "'Playfair Display', 'Noto Sans Kannada', serif" }}
                className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-7xl"
              >
                {t("landing.heroTitle")}{" "}
                <span className="text-amber-400">{t("landing.heroTitleHighlight")}</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-teal-100/80">
                {t("landing.heroSubtitle")}
              </p>
              <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
                <Link
                  to="/login"
                  className="group inline-flex items-center gap-2 overflow-hidden rounded-xl bg-amber-500 px-8 py-4 font-bold text-teal-950 shadow-2xl shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95"
                >
                  {t("landing.ctaFind")}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-900/30 px-8 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:bg-teal-800"
                >
                  {t("landing.ctaSignIn")}
                </Link>
              </div>
              <p className="mt-6 text-xs text-teal-200/70">{t("landing.freeNote")}</p>
            </div>
          </div>
        </section>

        {/* Feature Cards (overlapping) */}
        <section className="relative -mt-16 pb-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-3">
              <FeatureCard
                accent="teal"
                title={t("landing.feature1Title")}
                body={t("landing.feature1Body")}
                icon={<Search className="h-7 w-7" />}
              />
              <FeatureCard
                accent="amber"
                title={t("landing.feature2Title")}
                body={t("landing.feature2Body")}
                icon={<Sparkles className="h-7 w-7" />}
              />
              <FeatureCard
                accent="teal"
                title={t("landing.feature3Title")}
                body={t("landing.feature3Body")}
                icon={<ShieldCheck className="h-7 w-7" />}
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center">
              <h2
                style={{ fontFamily: "'Playfair Display', 'Noto Sans Kannada', serif" }}
                className="text-4xl font-bold text-teal-950"
              >
                {t("landing.stepsTitle")}
              </h2>
              <p className="mt-4 text-lg text-slate-600">{t("landing.stepsSubtitle")}</p>
            </div>

            <div className="relative mt-20">
              <div className="absolute top-10 left-0 hidden h-0.5 w-full -translate-y-1/2 bg-teal-100 lg:block" />
              <div className="relative grid gap-12 lg:grid-cols-4">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="relative flex flex-col items-center text-center">
                    <div
                      className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white text-2xl font-bold shadow-xl ${
                        i % 2 === 1 ? "bg-amber-500 text-teal-950" : "bg-teal-600 text-white"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <h4 className="mt-8 text-xl font-bold text-teal-950">{s.title}</h4>
                    <p className="mt-3 px-2 text-slate-600">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-slate-500">
          <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t("footer.disclaimer")}
          </span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: "teal" | "amber";
}) {
  const iconWrap =
    accent === "amber"
      ? "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white"
      : "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white";
  return (
    <div className="group relative flex flex-col rounded-3xl border border-slate-100 bg-white p-8 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
      <div
        className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${iconWrap}`}
      >
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-4 text-slate-600">{body}</p>
    </div>
  );
}
