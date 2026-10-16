import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, PageHeader } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Input";
import { PageLoader } from "../../components/ui/Spinner";
import { useSession } from "../../context/auth";
import { useDrug, useInvalidate, useSuppliers } from "../../hooks/useData";
import { api, ApiError } from "../../lib/api";
import { lagosToday } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { Drug } from "../../lib/types";

const FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Injection", "Cream", "Ointment", "Drops", "Inhaler", "Powder", "Device", "Other"];
const CATEGORIES = [
  "Analgesics", "Antibiotics", "Antimalarials", "Antihistamines", "Antidiabetics", "Cardiovascular", "Cough & Cold",
  "Dermatologicals", "Gastrointestinal", "Respiratory", "Vitamins & Supplements", "Medical Devices", "Other",
];

interface FormState {
  name: string;
  generic_name: string;
  brand: string;
  nafdac_number: string;
  category: string;
  form: string;
  strength: string;
  pack_size: string;
  barcode: string;
  cost_price: string;
  selling_price: string;
  vat_mode: "default" | "exempt" | "custom";
  tax_rate: string;
  reorder_level: string;
  preferred_supplier_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: string;
}

const EMPTY: FormState = {
  name: "", generic_name: "", brand: "", nafdac_number: "", category: "", form: "Tablet", strength: "", pack_size: "",
  barcode: "", cost_price: "", selling_price: "", vat_mode: "default", tax_rate: "", reorder_level: "10", preferred_supplier_id: "",
  batch_number: "", expiry_date: "", quantity: "",
};

function fromDrug(d: Drug): FormState {
  return {
    ...EMPTY,
    name: d.name, generic_name: d.generic_name ?? "", brand: d.brand ?? "", nafdac_number: d.nafdac_number ?? "",
    category: d.category ?? "", form: d.form ?? "", strength: d.strength ?? "", pack_size: d.pack_size ?? "", barcode: d.barcode ?? "",
    cost_price: String(d.cost_price), selling_price: String(d.selling_price),
    vat_mode: d.tax_rate === null ? "default" : d.tax_rate === 0 ? "exempt" : "custom",
    tax_rate: d.tax_rate === null ? "" : String(d.tax_rate),
    reorder_level: String(d.reorder_level), preferred_supplier_id: d.preferred_supplier_id ? String(d.preferred_supplier_id) : "",
  };
}

export default function DrugFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const { tenant } = useSession();
  const { data, isLoading } = useDrug(id);
  const { data: suppliers } = useSuppliers();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const invalidate = useInvalidate();

  useEffect(() => {
    if (data?.data) setForm(fromDrug(data.data));
  }, [data]);

  if (editing && isLoading) return <PageLoader />;

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => error?.field(k);

  const cost = Number(form.cost_price) || 0;
  const price = Number(form.selling_price) || 0;
  const margin = price > 0 ? ((price - cost) / price) * 100 : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      name: form.name,
      generic_name: form.generic_name || null,
      brand: form.brand || null,
      nafdac_number: form.nafdac_number || null,
      category: form.category || null,
      form: form.form || null,
      strength: form.strength || null,
      pack_size: form.pack_size || null,
      barcode: form.barcode || null,
      cost_price: form.cost_price === "" ? 0 : Number(form.cost_price),
      selling_price: Number(form.selling_price),
      tax_rate: form.vat_mode === "default" ? null : form.vat_mode === "exempt" ? 0 : Number(form.tax_rate),
      reorder_level: Number(form.reorder_level || 0),
      preferred_supplier_id: form.preferred_supplier_id ? Number(form.preferred_supplier_id) : null,
    };
    if (!editing && form.quantity) {
      body.opening_batch = {
        batch_number: form.batch_number,
        expiry_date: form.expiry_date,
        quantity: Number(form.quantity),
        cost_price: body.cost_price,
      };
    }
    try {
      const res = await api<{ data: Drug }>(editing ? `/api/drugs/${id}` : "/api/drugs", { method: editing ? "PATCH" : "POST", body });
      toast.success(editing ? "Changes saved" : `${res.data.name} added`);
      void invalidate("/api/drugs", "/api/dashboard", "/api/pos/search");
      navigate(`/inventory/${res.data.id}`);
    } catch (e2) {
      if (e2 instanceof ApiError) {
        setError(e2);
        if (!Object.keys(e2.errors).length) toast.error(e2.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Title>{editing ? "Edit drug" : "Add drug"} · MediPharm</Title>
      <PageHeader
        back={
          <Link to={editing ? `/inventory/${id}` : "/inventory"} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-fg-3 hover:text-fg">
            <ArrowLeft className="size-4" /> Back
          </Link>
        }
        title={editing ? `Edit ${data?.data.name ?? "drug"}` : "Add drug"}
      />

      <form onSubmit={submit} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" noValidate>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Product" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required error={err("name")} className="sm:col-span-2">
                {(fid) => <Input id={fid} value={form.name} onChange={set("name")} autoFocus={!editing} invalid={!!err("name")} placeholder="e.g. Paracetamol 500mg Tablets" />}
              </Field>
              <Field label="Generic name" error={err("generic_name")}>
                {(fid) => <Input id={fid} value={form.generic_name} onChange={set("generic_name")} />}
              </Field>
              <Field label="Brand / manufacturer" error={err("brand")}>
                {(fid) => <Input id={fid} value={form.brand} onChange={set("brand")} />}
              </Field>
              <Field label="Category" error={err("category")}>
                {(fid) => (
                  <Select id={fid} value={form.category} onChange={set("category")}>
                    <option value="">—</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Form" error={err("form")}>
                {(fid) => (
                  <Select id={fid} value={form.form} onChange={set("form")}>
                    {FORMS.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Strength" error={err("strength")}>
                {(fid) => <Input id={fid} value={form.strength} onChange={set("strength")} placeholder="500mg" />}
              </Field>
              <Field label="Pack size" error={err("pack_size")}>
                {(fid) => <Input id={fid} value={form.pack_size} onChange={set("pack_size")} placeholder="10x10" />}
              </Field>
              <Field label="NAFDAC number" error={err("nafdac_number")}>
                {(fid) => <Input id={fid} value={form.nafdac_number} onChange={set("nafdac_number")} className="font-mono" placeholder="A4-1234" />}
              </Field>
              <Field label="Barcode" error={err("barcode")} hint="Scan it straight into this box">
                {(fid) => <Input id={fid} value={form.barcode} onChange={set("barcode")} className="font-mono" onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />}
              </Field>
            </CardBody>
          </Card>

          {!editing && (
            <Card>
              <CardHeader title="Opening stock" description="Optional. You can also add batches later, or receive them on a purchase order." />
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Batch number" error={err("opening_batch.batch_number")}>
                  {(fid) => <Input id={fid} value={form.batch_number} onChange={set("batch_number")} className="font-mono" />}
                </Field>
                <Field label="Expiry date" error={err("opening_batch.expiry_date")}>
                  {(fid) => <Input id={fid} type="date" min={lagosToday(1)} value={form.expiry_date} onChange={set("expiry_date")} />}
                </Field>
                <Field label="Quantity" error={err("opening_batch.quantity")}>
                  {(fid) => <Input id={fid} type="number" min={1} value={form.quantity} onChange={set("quantity")} />}
                </Field>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pricing" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cost price (₦)" error={err("cost_price")}>
                  {(fid) => <Input id={fid} type="number" min={0} step="0.01" value={form.cost_price} onChange={set("cost_price")} />}
                </Field>
                <Field label="Selling price (₦)" required error={err("selling_price")}>
                  {(fid) => <Input id={fid} type="number" min={0} step="0.01" value={form.selling_price} onChange={set("selling_price")} invalid={!!err("selling_price")} />}
                </Field>
              </div>
              {margin !== null && (
                <p className="text-sm text-fg-3">
                  Margin <span className={margin < 0 ? "font-semibold text-danger-600" : "font-semibold text-fg-2"}>{margin.toFixed(1)}%</span> ·{" "}
                  {formatNaira(price - cost)} per unit
                </p>
              )}
              <Field label="VAT" error={err("tax_rate")}>
                {(fid) => (
                  <Select id={fid} value={form.vat_mode} onChange={set("vat_mode")}>
                    <option value="default">Standard ({tenant.vat_rate}%)</option>
                    <option value="exempt">Exempt (0%)</option>
                    <option value="custom">Custom rate</option>
                  </Select>
                )}
              </Field>
              {form.vat_mode === "custom" && (
                <Field label="Custom VAT %" error={err("tax_rate")}>
                  {(fid) => <Input id={fid} type="number" min={0} max={100} step="0.01" value={form.tax_rate} onChange={set("tax_rate")} />}
                </Field>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Reordering" />
            <CardBody className="space-y-4">
              <Field label="Reorder level" error={err("reorder_level")} hint="Flagged as low stock at or below this quantity">
                {(fid) => <Input id={fid} type="number" min={0} value={form.reorder_level} onChange={set("reorder_level")} />}
              </Field>
              <Field label="Preferred supplier" error={err("preferred_supplier_id")}>
                {(fid) => (
                  <Select id={fid} value={form.preferred_supplier_id} onChange={set("preferred_supplier_id")}>
                    <option value="">—</option>
                    {suppliers?.data.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </CardBody>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" size="lg" className="flex-1" loading={busy}>
              {editing ? "Save changes" : "Add drug"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
