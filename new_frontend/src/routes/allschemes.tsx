import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSchemes, type SchemeCatalogItem } from "@/lib/api/recommendations";

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
              {visibleSchemes.map((scheme) => (
                <article
                  key={scheme.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {scheme.category && <Badge variant="secondary">{scheme.category}</Badge>}
                      <h2 className="mt-2 text-xl font-semibold text-slate-950">{scheme.name}</h2>
                      {scheme.ministry && (
                        <p className="mt-1 text-sm text-slate-500">{scheme.ministry}</p>
                      )}
                      {scheme.description && (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {scheme.description}
                        </p>
                      )}
                      {scheme.benefits && scheme.benefits !== scheme.description && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          <span className="font-semibold text-slate-800">Benefits: </span>
                          {scheme.benefits}
                        </p>
                      )}
                    </div>
                    {scheme.sourceUrl && (
                      <a
                        href={scheme.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
                      >
                        Official details <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </article>
              ))}
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
