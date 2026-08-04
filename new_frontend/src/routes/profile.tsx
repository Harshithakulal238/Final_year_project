import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser, loadProfile, saveProfile } from "@/lib/profile-store";
import type { Profile } from "@/lib/eligibility";
import { crossFieldIssues, getAge } from "@/lib/eligibility";
import { OCCUPATIONS } from "@/lib/schemes";
import { KARNATAKA_DISTRICTS, TALUKS_BY_DISTRICT, CITIES_BY_DISTRICT } from "@/lib/karnataka";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, Pencil, ArrowRight } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Sahayak" },
      { name: "description", content: "Tell us about you so we can match you with schemes." },
      { property: "og:title", content: "Your profile — Sahayak" },
      {
        property: "og:description",
        content: "DOB, income, ration card, caste, occupation, location.",
      },
    ],
  }),
  component: ProfilePage,
});

const CONDITIONS = [
  { id: "pregnant", labelKey: "profile.conditionPregnant" },
  { id: "widow", labelKey: "profile.conditionWidow" },
  { id: "disabled", labelKey: "profile.conditionDisabled" },
] as const satisfies { id: string; labelKey: TranslationKey }[];

const MINORITY_TYPES = [
  { value: "Muslim", labelKey: "profile.minorityMuslim" },
  { value: "Christian", labelKey: "profile.minorityChristian" },
  { value: "Sikh", labelKey: "profile.minoritySikh" },
  { value: "Jain", labelKey: "profile.minorityJain" },
  { value: "Buddhist", labelKey: "profile.minorityBuddhist" },
  { value: "Parsi", labelKey: "profile.minorityParsi" },
  { value: "Other", labelKey: "profile.minorityOther" },
] as const satisfies { value: string; labelKey: TranslationKey }[];

const CASTE_OPTIONS = [
  { value: "General", labelKey: "profile.casteGeneral" },
  { value: "OBC", labelKey: "profile.casteOBC" },
  { value: "SC", labelKey: "profile.casteSC" },
  { value: "ST", labelKey: "profile.casteST" },
  { value: "Minority", labelKey: "profile.casteMinority" },
] as const satisfies { value: string; labelKey: TranslationKey }[];

const GENDER_LABEL_KEYS = {
  female: "profile.genderFemale",
  male: "profile.genderMale",
  other: "profile.genderOther",
} as const satisfies Record<string, TranslationKey>;

function defaultProfile(): Profile {
  return {
    name: "",
    mobile: "",
    verified: false,
    dob: "",
    gender: "female",
    income: 150000,
    rationCard: "None",
    caste: "General",
    occupation: "",
    conditions: [],
    location: { state: "Karnataka", district: "", taluk: "", village: "", pincode: "" },
  };
}

function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [p, setP] = useState<Profile>(defaultProfile);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"view" | "edit">("edit");

  useEffect(() => {
    const existing = loadProfile();
    if (!getCurrentUser()) {
      navigate({ to: "/login" });
      return;
    }
    if (existing) {
      const base = defaultProfile();
      const merged: Profile = {
        ...base,
        ...existing,
        location: { ...base.location, ...(existing.location ?? {}) },
      };
      setP(merged);
      const wantsEdit = typeof window !== "undefined" && window.location.hash === "#edit";
      if (merged.name && merged.dob && !wantsEdit) setMode("view");
    }
    setHydrated(true);
  }, [navigate]);

  if (!hydrated) return null;

  const issues = crossFieldIssues(p);
  const age = getAge(p.dob);

  function update<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  function updateLoc<K extends keyof Profile["location"]>(k: K, v: Profile["location"][K]) {
    setP((prev) => {
      const nextLoc = { ...prev.location, [k]: v } as Profile["location"];
      // When district changes, clear dependent taluk/village so users pick fresh
      if (k === "district") {
        nextLoc.taluk = "";
        nextLoc.village = "";
      }
      return { ...prev, location: nextLoc };
    });
  }

  function toggleCondition(id: string) {
    setP((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(id)
        ? prev.conditions.filter((c) => c !== id)
        : [...prev.conditions, id],
    }));
  }

  async function submit() {
    const errs: Record<string, string> = {};
    if (!p.name.trim()) errs.name = t("profile.errName");
    const a = getAge(p.dob);
    if (!p.dob) errs.dob = t("profile.errDobRequired");
    else if (a < 1 || a > 120) errs.dob = t("profile.errDobInvalid");
    if (!/^[6-9]\d{9}$/.test(p.mobile)) errs.mobile = t("profile.errMobile");
    if (p.income < 0 || p.income > 100000000) errs.income = t("profile.errIncome");
    if (!p.occupation) errs.occupation = t("profile.errOccupation");
    if (!p.rationCard || p.rationCard === "None") errs.rationCard = t("profile.errRationCard");
    if (p.caste === "Minority" && !p.minorityType) errs.minorityType = t("profile.errMinorityType");
    if (!p.location.district.trim()) errs.district = t("profile.errDistrict");
    if (!p.location.taluk.trim()) errs.taluk = t("profile.errTaluk");
    if (!p.location.village.trim()) errs.village = t("profile.errVillage");
    if (!/^\d{6}$/.test(p.location.pincode)) errs.pincode = t("profile.errPincode");
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(t("profile.toastFixFields"));
      return;
    }
    const wasFirstTime = !(loadProfile()?.name && loadProfile()?.dob);
    try {
      await saveProfile(p);
      toast.success(t("profile.toastUpdated"));
      if (wasFirstTime) navigate({ to: "/results" });
      else setMode("view");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your profile");
    }
  }

  if (mode === "view") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t("profile.title")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("profile.viewSubtitle")}</p>
              {p.verified ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("profile.verifiedMobile", { mobile: p.mobile })}
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {t("profile.guestSessionPrefix")}{" "}
                  <Link to="/login" className="underline">
                    {t("profile.verifyToBoost")}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("edit")}>
                <Pencil className="mr-2 h-4 w-4" /> {t("profile.editProfileBtn")}
              </Button>
              <Button onClick={() => navigate({ to: "/results" })}>
                {t("profile.viewSchemesBtn")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 md:p-8">
            <ViewSection title={t("profile.sectionBasicDetails")}>
              <Row k={t("profile.rowFullName")} v={p.name} />
              <Row
                k={t("profile.rowDob")}
                v={`${new Date(p.dob).toLocaleDateString()} · ${t("common.years", { n: age })}`}
              />
              <Row k={t("profile.rowGender")} v={t(GENDER_LABEL_KEYS[p.gender])} />
              <Row k={t("profile.rowMobile")} v={p.mobile ? `+91 ${p.mobile}` : "—"} />
            </ViewSection>
            <ViewSection title={t("profile.sectionEconomicStatus")}>
              <Row k={t("profile.rowIncome")} v={`₹${p.income.toLocaleString("en-IN")}`} />
              <Row k={t("profile.rowRationCard")} v={p.rationCard} />
            </ViewSection>
            <ViewSection title={t("profile.sectionCategoryOccupation")}>
              <Row
                k={t("profile.rowCategory")}
                v={t(
                  CASTE_OPTIONS.find((c) => c.value === p.caste)?.labelKey ??
                    "profile.casteGeneral",
                )}
              />
              {p.caste === "Minority" && (
                <Row
                  k={t("profile.rowMinorityType")}
                  v={
                    p.minorityType
                      ? t(
                          MINORITY_TYPES.find((m) => m.value === p.minorityType)?.labelKey ??
                            "profile.minorityOther",
                        )
                      : "—"
                  }
                />
              )}
              <Row k={t("profile.rowOccupation")} v={p.occupation} />
            </ViewSection>
            <ViewSection title={t("profile.sectionLocation")}>
              <Row k={t("profile.rowState")} v={p.location.state} />
              <Row k={t("profile.rowDistrict")} v={p.location.district} />
              <Row k={t("profile.rowTaluk")} v={p.location.taluk} />
              <Row k={t("profile.rowVillage")} v={p.location.village} />
              <Row k={t("profile.rowPincode")} v={p.location.pincode} />
            </ViewSection>
            {p.conditions.length > 0 && (
              <ViewSection title={t("profile.sectionSpecialConditions")}>
                <Row
                  k={t("profile.rowSpecialApplies")}
                  v={p.conditions
                    .map((cid) => {
                      const c = CONDITIONS.find((x) => x.id === cid);
                      return c ? t(c.labelKey) : cid;
                    })
                    .join(", ")}
                />
              </ViewSection>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t("profile.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.requiredNote")}</p>
          {p.verified ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("profile.verifiedMobile", { mobile: p.mobile })}
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {t("profile.guestSessionPrefix")}{" "}
              <Link to="/login" className="underline">
                {t("profile.verifyToBoost")}
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
          <Section title={t("profile.sectionBasicDetails")}>
            <Field label={t("profile.rowFullName")} required error={errors.name}>
              <Input
                value={p.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder={t("profile.fieldFullNamePlaceholder")}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("profile.rowDob")} required error={errors.dob}>
                <Input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={p.dob}
                  onChange={(e) => update("dob", e.target.value)}
                />
                {p.dob && age > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("profile.ageLabel", { age })}
                  </p>
                )}
              </Field>
              <Field label={t("profile.fieldGenderLabel")} required>
                <RadioGroup
                  value={p.gender}
                  onValueChange={(v) => update("gender", v as Profile["gender"])}
                  className="flex gap-4 pt-2"
                >
                  {(["female", "male", "other"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={g} /> {t(GENDER_LABEL_KEYS[g])}
                    </label>
                  ))}
                </RadioGroup>
              </Field>
            </div>
            <Field label={t("profile.fieldMobileLabel")} required error={errors.mobile}>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  +91
                </span>
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  className="rounded-l-none"
                  placeholder={t("profile.fieldMobilePlaceholder")}
                  value={p.mobile}
                  onChange={(e) => update("mobile", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </Field>
          </Section>

          <Section title={t("profile.sectionEconomicStatus")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("profile.fieldIncomeLabel")} required error={errors.income}>
                <Input
                  type="number"
                  min={0}
                  value={p.income || ""}
                  onChange={(e) => update("income", parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label={t("profile.fieldRationCardLabel")} required error={errors.rationCard}>
                <Select
                  value={p.rationCard}
                  onValueChange={(v) => update("rationCard", v as Profile["rationCard"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("profile.rationCardPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APL">{t("profile.rationApl")}</SelectItem>
                    <SelectItem value="BPL">{t("profile.rationBpl")}</SelectItem>
                    <SelectItem value="AAY">{t("profile.rationAay")}</SelectItem>
                    <SelectItem value="None">{t("profile.rationNone")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <Section title={t("profile.sectionCategoryOccupation")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("profile.fieldCasteCategoryLabel")} required>
                <Select
                  value={p.caste}
                  onValueChange={(v) => update("caste", v as Profile["caste"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASTE_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(c.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("profile.fieldOccupationLabel")} required error={errors.occupation}>
                <Select value={p.occupation} onValueChange={(v) => update("occupation", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("profile.occupationPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPATIONS.map((o) => (
                      <SelectItem key={o} value={o} className="capitalize">
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {p.caste === "Minority" && (
              <Field
                label={t("profile.fieldMinorityTypeLabel")}
                required
                error={errors.minorityType}
              >
                <Select
                  value={p.minorityType ?? ""}
                  onValueChange={(v) => update("minorityType", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("profile.minorityTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {MINORITY_TYPES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </Section>

          <Section title={t("profile.sectionLocation")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("profile.fieldStateLabel")} required>
                <Input
                  value={p.location.state}
                  onChange={(e) => updateLoc("state", e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profile.fieldStateDefaultNote")}
                </p>
              </Field>
              <Field label={t("profile.fieldDistrictLabel")} required error={errors.district}>
                <Combobox
                  value={p.location.district}
                  onChange={(v) => updateLoc("district", v)}
                  options={KARNATAKA_DISTRICTS}
                  placeholder={t("profile.districtPlaceholder")}
                />
              </Field>
              <Field label={t("profile.fieldTalukLabel")} required error={errors.taluk}>
                <Combobox
                  value={p.location.taluk}
                  onChange={(v) => updateLoc("taluk", v)}
                  options={TALUKS_BY_DISTRICT[p.location.district] ?? []}
                  placeholder={
                    p.location.district
                      ? t("profile.talukPlaceholder")
                      : t("profile.talukPlaceholderDisabled")
                  }
                  disabled={!p.location.district}
                />
              </Field>
              <Field label={t("profile.fieldVillageLabel")} required error={errors.village}>
                <Combobox
                  value={p.location.village}
                  onChange={(v) => updateLoc("village", v)}
                  options={CITIES_BY_DISTRICT[p.location.district] ?? []}
                  placeholder={
                    p.location.district
                      ? t("profile.villagePlaceholder")
                      : t("profile.villagePlaceholderDisabled")
                  }
                  disabled={!p.location.district}
                />
              </Field>
              <Field label={t("profile.fieldPincodeLabel")} required error={errors.pincode}>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={p.location.pincode}
                  onChange={(e) => updateLoc("pincode", e.target.value.replace(/\D/g, ""))}
                  placeholder={t("profile.pincodePlaceholder")}
                />
              </Field>
            </div>
          </Section>

          <Section
            title={t("profile.sectionSpecialConditions")}
            hint={t("profile.specialConditionsHint")}
          >
            <div className="grid gap-3 md:grid-cols-3">
              {CONDITIONS.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3 hover:bg-accent/10"
                >
                  <Checkbox
                    checked={p.conditions.includes(c.id)}
                    onCheckedChange={() => toggleCondition(c.id)}
                  />
                  <span className="text-sm">{t(c.labelKey)}</span>
                </label>
              ))}
            </div>
          </Section>

          {issues.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {t("profile.crossFieldWarnings")}
              </div>
              <ul className="mt-2 list-disc pl-8 text-sm text-destructive/90">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {loadProfile()?.name && loadProfile()?.dob ? (
              <Button variant="outline" onClick={() => setMode("view")}>
                {t("profile.cancel")}
              </Button>
            ) : (
              <Link to="/">
                <Button variant="outline">{t("profile.cancel")}</Button>
              </Link>
            )}
            <Button size="lg" onClick={submit}>
              {t("profile.saveAndFind")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <dl className="grid gap-3 md:grid-cols-2">{children}</dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm capitalize text-foreground">{v || "—"}</dd>
    </div>
  );
}
