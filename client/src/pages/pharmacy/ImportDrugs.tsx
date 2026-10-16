import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Title } from "react-head";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, PageHeader } from "../../components/ui/Card";
import { useInvalidate } from "../../hooks/useData";
import { api, ApiError, apiUrl } from "../../lib/api";
import { cn } from "../../lib/cn";

interface Chunk {
  token: string;
  total: number;
  processed: number;
  next_offset: number | null;
  done: boolean;
  created: number;
  updated: number;
  batches: number;
  errors: { row: number; message: string }[];
}

const COLUMNS = [
  ["name", "Required"],
  ["selling_price", "Required, ₦"],
  ["generic_name, brand, category, form, strength, pack_size", "Optional"],
  ["nafdac_number + pack_size", "Match key — re-importing updates instead of duplicating"],
  ["barcode, cost_price, tax_rate, reorder_level", "Optional (blank tax_rate = standard VAT)"],
  ["batch_number, expiry_date, quantity", "Optional opening stock (YYYY-MM-DD)"],
];

/**
 * CSV import (FR-2.7). The server processes 200 rows per request; this page
 * drives the loop and shows progress, so a 2,000-SKU catalogue never trips
 * shared-hosting time limits.
 */
export default function ImportDrugs() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; batches: number; errors: Chunk["errors"] } | null>(null);
  const [error, setError] = useState<string>();
  const invalidate = useInvalidate();

  const start = async () => {
    if (!file) return;
    setRunning(true);
    setError(undefined);
    setResult(null);
    const totals = { created: 0, updated: 0, batches: 0, errors: [] as Chunk["errors"] };
    try {
      const form = new FormData();
      form.append("file", file);
      let chunk = (await api<{ data: Chunk }>("/api/drugs/import", { method: "POST", body: form })).data;
      for (;;) {
        totals.created += chunk.created;
        totals.updated += chunk.updated;
        totals.batches += chunk.batches;
        totals.errors.push(...chunk.errors);
        setProgress({ processed: chunk.processed, total: chunk.total });
        if (chunk.done || chunk.next_offset === null) break;
        chunk = (await api<{ data: Chunk }>("/api/drugs/import", { method: "POST", body: { token: chunk.token, offset: chunk.next_offset } })).data;
      }
      setResult(totals);
      void invalidate("/api/drugs", "/api/dashboard", "/api/pos/search");
    } catch (err) {
      setError(err instanceof ApiError ? (err.field("file") ?? err.message) : "Import failed — check your connection and try again. Rows already imported are kept.");
      if (totals.created || totals.updated) setResult(totals);
    } finally {
      setRunning(false);
    }
  };

  const pct = progress ? Math.round((progress.processed / Math.max(1, progress.total)) * 100) : 0;

  return (
    <>
      <Title>Import catalogue · MediPharm</Title>
      <PageHeader
        back={
          <Link to="/inventory" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-fg-3 hover:text-fg">
            <ArrowLeft className="size-4" /> Inventory
          </Link>
        }
        title="Import catalogue from CSV"
        description="Bring in hundreds of drugs at once. Safe to re-run — existing items are updated, not duplicated."
        actions={
          <a href={apiUrl("/api/drugs/import/template")} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-canvas px-4 text-base font-medium text-fg-2 shadow-xs hover:bg-subtle">
            <Download className="size-4" /> Download template
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardBody>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
              className={cn(
                "flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                drag ? "border-brand-500 bg-brand-50" : "border-border hover:border-brand-300 hover:bg-muted",
              )}
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <FileSpreadsheet className="size-10 text-brand-500" />
              {file ? (
                <>
                  <p className="mt-3 text-md font-semibold">{file.name}</p>
                  <p className="text-sm text-fg-3">{(file.size / 1024).toFixed(0)} KB · click to choose another</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-md font-semibold">Drop your CSV here, or click to browse</p>
                  <p className="text-sm text-fg-3">Excel: File → Save As → CSV UTF-8. Up to 10 MB.</p>
                </>
              )}
            </label>

            {progress && (
              <div className="mt-5" aria-live="polite">
                <div className="mb-1.5 flex justify-between text-sm text-fg-3">
                  <span>{running ? "Importing…" : "Finished"}</span>
                  <span className="tabular">
                    {progress.processed} / {progress.total} rows
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-brand-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {error && <p className="mt-4 rounded-md bg-danger-50 px-3 py-2 text-base text-danger-600" role="alert">{error}</p>}

            {result && (
              <div className="mt-5 rounded-lg border border-success-500/30 bg-success-50 p-4">
                <p className="flex items-center gap-2 text-md font-semibold text-success-600">
                  <CheckCircle2 className="size-5" /> Import complete
                </p>
                <p className="mt-1 text-base text-fg-2">
                  {result.created} added · {result.updated} updated · {result.batches} opening batch{result.batches === 1 ? "" : "es"}
                  {result.errors.length > 0 && <span className="text-danger-600"> · {result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped</span>}
                </p>
                <ButtonLink to="/inventory" size="sm" className="mt-3">
                  View inventory
                </ButtonLink>
              </div>
            )}

            {result && result.errors.length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto rounded-md border border-border-subtle">
                <table className="w-full text-base">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-fg-3 uppercase">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e) => (
                      <tr key={e.row} className="border-t border-border-subtle">
                        <td className="tabular px-3 py-2 text-fg-3">{e.row}</td>
                        <td className="px-3 py-2 text-danger-600">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button size="lg" className="mt-5 w-full" icon={<Upload />} disabled={!file} loading={running} onClick={start}>
              {running ? `Importing ${pct}%` : "Start import"}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Columns" description="Header row must use these names. Extra columns are ignored." />
          <dl className="divide-y divide-border-subtle">
            {COLUMNS.map(([k, v]) => (
              <div key={k} className="px-5 py-3">
                <dt className="font-mono text-sm text-fg">{k}</dt>
                <dd className="text-sm text-fg-3">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
