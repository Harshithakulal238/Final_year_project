import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gift,
  Search,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSchemes, type SchemeCatalogItem } from "@/lib/api/recommendations";
import { useLanguage } from "@/lib/i18n";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/allschemes")({
  head: () => ({
    meta: [
      { title: "All schemes — Sahayak" },
      { name: "description", content: "Search government schemes in the Sahayak database." },
    ],
  }),
  component: AllSchemesPage,
});

function AllSchemesPage() {
  const { lang, t } = useLanguage();
  const isKannada = lang === "kn";
  const [schemes, setSchemes] = useState<SchemeCatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSchemes()
      .then((response) => {
        if (active) setSchemes(response.schemes);
      })
      .catch((requestError) => {
        console.error("Unable to load schemes:", requestError);
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to contact the scheme server.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredSchemes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return schemes;

    return schemes
      .filter((scheme) =>
        [scheme.name, scheme.description, scheme.benefits, scheme.category, scheme.ministry]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
      )
      .sort((first, second) => {
        const firstStartsWithQuery = first.name.toLocaleLowerCase().startsWith(query);
        const secondStartsWithQuery = second.name.toLocaleLowerCase().startsWith(query);
        return Number(secondStartsWithQuery) - Number(firstStartsWithQuery);
      });
  }, [schemes, search]);

  const pageCount = Math.ceil(filteredSchemes.length / PAGE_SIZE);
  const visibleSchemes = filteredSchemes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstVisible = filteredSchemes.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastVisible = Math.min(page * PAGE_SIZE, filteredSchemes.length);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-teal-700">
            Scheme directory
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">All schemes</h1>
          <p className="mt-2 text-sm text-slate-600">
            Search the schemes available in our database.
          </p>
        </div>

        <div className="mt-6 max-w-xl">
          <label htmlFor="scheme-search" className="sr-only">
            Search schemes
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="scheme-search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by scheme name, category, or keyword"
              className="bg-white pl-10"
            />
          </div>
        </div>

        {loading && <p className="mt-8 text-sm text-slate-600">Loading schemes…</p>}
        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-semibold">Could not load schemes</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <>
            <p className="mt-6 text-sm text-slate-600" aria-live="polite">
              {filteredSchemes.length
                ? `Showing ${firstVisible}–${lastVisible} of ${filteredSchemes.length} schemes`
                : "No schemes match your search."}
            </p>

            <div className="mt-4 grid gap-4">
              {visibleSchemes.map((scheme) => {
                const kannada = scheme.translations?.kn;
                const name = isKannada ? kannada?.scheme_name || "" : scheme.name;
                const category = isKannada
                  ? kannada?.category || kannada?.scheme_category || kannada?.scheme_type || ""
                  : scheme.category;
                const ministry = isKannada
                  ? kannada?.ministry || kannada?.implementing_agency || ""
                  : scheme.ministry;
                const description = isKannada
                  ? kannada?.objective ||
                    kannada?.description ||
                    kannada?.overview ||
                    kannada?.benefits ||
                    ""
                  : scheme.description;
                const benefits = isKannada ? kannada?.benefits || "" : scheme.benefits;
                const eligibility = isKannada
                  ? kannada?.eligibility || kannada?.eligibility_criteria || ""
                  : scheme.eligibility;
                const documents = isKannada
                  ? kannada?.documents_required || kannada?.required_documents || ""
                  : scheme.documents;
                const applicationProcess = isKannada
                  ? kannada?.application_process || kannada?.how_to_apply || kannada?.process || ""
                  : scheme.applicationProcess;

                return (
                  <article
                    key={scheme.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-teal-50 to-white px-6 py-5">
                      <div className="min-w-0">
                        {category && (
                          <Badge className="border border-teal-200 bg-white text-teal-800 hover:bg-white">
                            {category}
                          </Badge>
                        )}
                        {name && (
                          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                            {name}
                          </h2>
                        )}
                        {ministry && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
                            {ministry}
                          </p>
                        )}
                      </div>
                      {scheme.sourceUrl && (
                        <a
                          href={scheme.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-50"
                        >
                          {t("allschemes.officialDetails")} <ArrowUpRight className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <div className="grid gap-4 p-5 sm:p-6">
                      {description && (
                        <SchemeSection title={t("allschemes.summary")} icon={<FileText />}>
                          <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                            {description}
                          </p>
                        </SchemeSection>
                      )}
                      {benefits && benefits !== description && (
                        <SchemeSection title={t("allschemes.benefits")} icon={<Gift />}>
                          <ContentList content={benefits} />
                        </SchemeSection>
                      )}
                      {eligibility && (
                        <SchemeSection title={t("allschemes.eligibility")} icon={<CheckCircle2 />}>
                          <ContentList content={eligibility} />
                        </SchemeSection>
                      )}
                      {documents && (
                        <SchemeSection title={t("allschemes.documents")} icon={<ClipboardList />}>
                          <ContentList content={documents} splitCommas />
                        </SchemeSection>
                      )}
                      {applicationProcess && (
                        <SchemeSection title={t("allschemes.application")} icon={<ArrowUpRight />}>
                          <ApplicationSteps content={applicationProcess} />
                        </SchemeSection>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {pageCount > 1 && (
              <nav
                className="mt-8 flex items-center justify-center gap-4"
                aria-label="Scheme pages"
              >
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600" aria-live="polite">
                  Page {page} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page === pageCount}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SchemeSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-teal-700 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ContentList({ content, splitCommas = false }: { content: string; splitCommas?: boolean }) {
  const items = content
    .split(splitCommas ? /[,;\n•]+/ : /[;\n•]+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((item) => item.trim().replace(/^[\s\-*]+/, ""))
    .filter(Boolean);

  if (items.length < 2) {
    return <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{content}</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item, index) => (
        <li
          key={`${index}-${item}`}
          className="flex items-start gap-2 text-sm leading-6 text-slate-700"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ApplicationSteps({ content }: { content: string }) {
  const modes = content
    .split(/(?=(?:Offline|Online):\s*)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const grouped = modes.map((mode) => {
    const label = mode.match(/^(Offline|Online):\s*/i)?.[1];
    const body = mode.replace(/^(?:Offline|Online):\s*/i, "").replace(/\s*\|\s*/g, " ");
    const steps = body
      .split(/(?=Step\s+\d+\s*:|\d+\.\s+)/i)
      .map((step) => step.trim().replace(/^(?:Step\s+\d+\s*:\s*|\d+\.\s*)/i, ""))
      .filter(Boolean);

    return { label, steps: steps.length ? steps : [body] };
  });

  return (
    <div className="space-y-4">
      {grouped.map((group, groupIndex) => (
        <div key={`${group.label || "steps"}-${groupIndex}`}>
          {group.label && (
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
              {group.label}
            </h4>
          )}
          <ol className="space-y-3">
            {group.steps.map((step, index) => (
              <li key={`${index}-${step}`} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-6 text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
