import { useState } from "react";
import useSWR from "swr";
import { Search } from "lucide-react";
import { useDebounce } from "../hooks/useDebounce";
import { qs, type Paginated } from "../lib/api";
import { formatNaira } from "../lib/money";
import type { Drug } from "../lib/types";
import { Input } from "./ui/Input";

/** Type-ahead drug picker used on purchase orders. */
export function DrugSearchSelect({ onPick, exclude = [] }: { onPick: (d: Drug) => void; exclude?: number[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const query = useDebounce(q.trim(), 200);
  const { data } = useSWR<Paginated<Drug>>(query ? `/api/drugs${qs({ search: query, per_page: 8 })}` : null, { keepPreviousData: true });
  const results = (data?.data ?? []).filter((d) => !exclude.includes(d.id));

  const pick = (d: Drug) => {
    onPick(d);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        leading={<Search />}
        placeholder="Add an item — search by name or barcode"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); if (results[hi]) pick(results[hi]); }
        }}
        aria-label="Search drugs to add"
        role="combobox"
        aria-expanded={open && results.length > 0}
      />
      {open && query && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border-subtle bg-canvas py-1 shadow-lg" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-base text-fg-3">No matching drugs</li>
          ) : (
            results.map((d, i) => (
              <li key={d.id} role="option" aria-selected={i === hi}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(d)}
                  onMouseEnter={() => setHi(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${i === hi ? "bg-brand-50" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-md font-medium">{d.name} <span className="font-normal text-fg-3">{d.strength}</span></span>
                    <span className="text-sm text-fg-3">{d.pack_size} · {d.stock_on_hand} on hand</span>
                  </span>
                  <span className="tabular text-sm text-fg-3">cost {formatNaira(d.cost_price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
