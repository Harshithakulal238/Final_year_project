import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SCHEMES, type Scheme } from "@/lib/schemes";
import { loadProfile, useBookmarks } from "@/lib/profile-store";
import { checkScheme } from "@/lib/eligibility";
import type { Profile } from "@/lib/eligibility";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  XCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/scheme/$id")({
  loader: ({ params }) => {
    const scheme = SCHEMES.find((s) => s.id === params.id);
    if (!scheme) throw notFound();
    return { scheme: scheme as Scheme };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.scheme.name} — Sahayak` : "Scheme — Sahayak" },
      {
        name: "description",
        content: loaderData?.scheme.description ?? "Scheme details on Sahayak.",
      },
      { property: "og:title", content: loaderData?.scheme.name ?? "Scheme — Sahayak" },
      { property: "og:description", content: loaderData?.scheme.description ?? "" },
    ],
  }),
  component: SchemePage,
});

function SchemePage() {
  const { scheme } = Route.useLoaderData();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { has, toggle } = useBookmarks();

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      navigate({ to: "/login" });
      return;
    }
    setProfile(p);
    setHydrated(true);
  }, [navigate]);

  const result = useMemo(
    () => (profile && profile.dob ? checkScheme(profile, scheme) : null),
    [profile, scheme],
  );
  const bookmarked = has(scheme.id);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <button
          onClick={() => navigate({ to: "/results" })}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("scheme.backToResults")}
        </button>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{scheme.category}</Badge>
              <span className="text-xs text-muted-foreground">{scheme.ministry}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {scheme.name}
            </h1>
            <p className="mt-3 text-muted-foreground">{scheme.description}</p>
          </div>
          <button
            onClick={() => toggle(scheme.id)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent/20"
          >
            {bookmarked ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-primary" /> {t("scheme.bookmarked")}
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" /> {t("scheme.bookmark")}
              </>
            )}
          </button>
        </div>

        {hydrated && result && (
          <div
            className={`mt-6 rounded-2xl border p-6 ${
              result.eligible
                ? "border-primary/30 bg-primary/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-3">
              {result.eligible ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive" />
              )}
              <div>
                <div className="font-semibold text-foreground">
                  {result.eligible ? t("scheme.eligibleTitle") : t("scheme.notEligibleTitle")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("scheme.matchScoreLine", {
                    score: result.score,
                    explanation: result.explanation,
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Panel title={t("scheme.keyBenefits")}>
            <p className="text-sm text-foreground">{scheme.benefits}</p>
          </Panel>
          <Panel title={t("scheme.requiredDocuments")}>
            <ul className="space-y-2">
              {scheme.documents.map((d: string) => (
                <li key={d} className="flex items-center gap-2 text-sm text-foreground">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {d}
                </li>
              ))}
            </ul>
          </Panel>

          {result && (
            <>
              <Panel title={t("scheme.whyMatches")}>
                {result.reasons.length ? (
                  <ul className="space-y-2">
                    {result.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("scheme.noCriteriaMatched")}</p>
                )}
              </Panel>
              <Panel title={t("scheme.gapsToAddress")}>
                {result.rejections.length ? (
                  <ul className="space-y-2">
                    {result.rejections.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("scheme.meetAllCriteria")}</p>
                )}
              </Panel>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-6">
          <div>
            <div className="text-sm font-medium text-foreground">{t("scheme.readyToApply")}</div>
            <div className="text-xs text-muted-foreground">{t("scheme.redirectNote")}</div>
          </div>
          <div className="flex gap-2">
            <Link to="/results">
              <Button variant="outline">{t("scheme.allSchemes")}</Button>
            </Link>
            <a href={scheme.applyUrl} target="_blank" rel="noreferrer">
              <Button>
                {t("scheme.applyNow")} <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
