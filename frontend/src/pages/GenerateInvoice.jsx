import { useState } from "react";
import {
  Building2, User, Receipt, Percent, Landmark, MessageSquare, Plus, Trash2,
  Loader2, AlertTriangle, Eye, Printer, X, FileSignature
} from "lucide-react";
import { useC } from "../context/ThemeContext";
import { API_BASE } from "../utils/api";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

const emptyLineItem = () => ({ description: "", quantity: 1, unit_price: 0 });

const initialForm = {
  company_name: "",
  company_address: "",
  company_email: "",
  company_phone: "",
  company_gst: "",
  client_name: "",
  client_address: "",
  client_email: "",
  client_phone: "",
  client_gst: "",
  invoice_number: "",
  invoice_date: "",
  due_date: "",
  po_number: "",
  currency: "INR",
  tax_rate: 0,
  discount_rate: 0,
  shipping_charges: 0,
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  payment_terms: "",
  notes: "",
  terms_and_conditions: "",
};

function Section({ icon: Icon, title, children, c }) {
  return (
    <div className="rise glass" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Icon size={16} color={c.cyan} />
        <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, span, children }) {
  const c = useC();
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className="mono" style={{ display: "block", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6, color: c.dim }}>
        {label}{required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

export function GenerateInvoice() {
  const c = useC();
  const [form, setForm] = useState(initialForm);
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { html, totals }

  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
  const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 };
  const labelStyle = { display: "block", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6, color: c.dim };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setLineItem = (idx, key) => (e) => {
    const value = key === "description" ? e.target.value : Number(e.target.value);
    setLineItems((items) => items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const addLineItem = () => setLineItems((items) => [...items, emptyLineItem()]);
  const removeLineItem = (idx) => setLineItems((items) => items.length > 1 ? items.filter((_, i) => i !== idx) : items);

  const lineTotal = (item) => (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  const subtotal = lineItems.reduce((sum, it) => sum + lineTotal(it), 0);

  const isValid = form.company_name.trim() && form.client_name.trim() && form.invoice_number.trim() && form.invoice_date.trim()
    && lineItems.some((it) => it.description.trim() && Number(it.unit_price) >= 0 && Number(it.quantity) > 0);

  const generateInvoice = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        tax_rate: Number(form.tax_rate) || 0,
        discount_rate: Number(form.discount_rate) || 0,
        shipping_charges: Number(form.shipping_charges) || 0,
        line_items: lineItems
          .filter((it) => it.description.trim())
          .map((it) => ({ description: it.description, quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 })),
      };
      const res = await fetch(`${API_BASE}/invoices/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to generate invoice");
      }
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError(err.message || "Failed to generate invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const printInvoice = () => {
    if (!preview?.html) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(preview.html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const currencySymbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[form.currency] || form.currency;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="mono" style={{ fontSize: 12, color: c.muted, display: "flex", alignItems: "center", gap: 8 }}>
        <FileSignature size={14} color={c.cyan} />
        Fill in the details below to generate a formatted, print-ready invoice
      </div>

      {error && (
        <div className="glass" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, color: c.red }}>
          <AlertTriangle size={16} />
          <span className="mono" style={{ fontSize: 12 }}>{error}</span>
        </div>
      )}

      <Section icon={Building2} title="Your Company Details" c={c}>
        <div style={grid2}>
          <Field label="Company Name" required><input className="efield" value={form.company_name} onChange={setField("company_name")} placeholder="Acme Corp" /></Field>
          <Field label="GSTIN / Tax ID"><input className="efield" value={form.company_gst} onChange={setField("company_gst")} placeholder="27AACCA1234A1Z5" /></Field>
          <Field label="Address"><input className="efield" value={form.company_address} onChange={setField("company_address")} placeholder="Street, City, State, PIN" /></Field>
          <Field label="Email"><input className="efield" type="email" value={form.company_email} onChange={setField("company_email")} placeholder="billing@company.com" /></Field>
          <Field label="Phone"><input className="efield" value={form.company_phone} onChange={setField("company_phone")} placeholder="+91 90000 00000" /></Field>
        </div>
      </Section>

      <Section icon={User} title="Bill To (Client Details)" c={c}>
        <div style={grid2}>
          <Field label="Client Name" required><input className="efield" value={form.client_name} onChange={setField("client_name")} placeholder="Globex Inc" /></Field>
          <Field label="GSTIN / Tax ID"><input className="efield" value={form.client_gst} onChange={setField("client_gst")} placeholder="Client GST number" /></Field>
          <Field label="Address"><input className="efield" value={form.client_address} onChange={setField("client_address")} placeholder="Street, City, State, PIN" /></Field>
          <Field label="Email"><input className="efield" type="email" value={form.client_email} onChange={setField("client_email")} placeholder="accounts@client.com" /></Field>
          <Field label="Phone"><input className="efield" value={form.client_phone} onChange={setField("client_phone")} placeholder="+91 90000 00000" /></Field>
        </div>
      </Section>

      <Section icon={Receipt} title="Invoice Details" c={c}>
        <div style={grid3}>
          <Field label="Invoice Number" required><input className="efield" value={form.invoice_number} onChange={setField("invoice_number")} placeholder="INV-2026-001" /></Field>
          <Field label="Invoice Date" required><input className="efield" type="date" value={form.invoice_date} onChange={setField("invoice_date")} /></Field>
          <Field label="Due Date"><input className="efield" type="date" value={form.due_date} onChange={setField("due_date")} /></Field>
          <Field label="PO Number"><input className="efield" value={form.po_number} onChange={setField("po_number")} placeholder="PO-1029" /></Field>
          <Field label="Currency">
            <select className="efield" value={form.currency} onChange={setField("currency")}>
              {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section icon={Receipt} title="Line Items" c={c}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 130px 36px", gap: 10 }}>
            {["Description", "Qty", "Unit Price", "Amount", ""].map((h) => (
              <div key={h} className="mono" style={{ ...labelStyle, marginBottom: 0 }}>{h}</div>
            ))}
          </div>
          {lineItems.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 130px 36px", gap: 10, alignItems: "center" }}>
              <input className="efield" value={item.description} onChange={setLineItem(idx, "description")} placeholder="Item or service description" />
              <input className="efield" type="number" min="0" step="1" value={item.quantity} onChange={setLineItem(idx, "quantity")} />
              <input className="efield" type="number" min="0" step="0.01" value={item.unit_price} onChange={setLineItem(idx, "unit_price")} />
              <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{currencySymbol}{lineTotal(item).toFixed(2)}</div>
              <button className="gbtn ghost" style={{ padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => removeLineItem(idx)} disabled={lineItems.length === 1} title="Remove line item">
                <Trash2 size={14} color={c.red} />
              </button>
            </div>
          ))}
          <button className="gbtn ghost" style={{ padding: "8px 14px", fontSize: 12, alignSelf: "flex-start" }} onClick={addLineItem}>
            <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Add Line Item
          </button>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 12, color: c.dim }}>Subtotal: </span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: c.cyan }}>{currencySymbol}{subtotal.toFixed(2)}</span>
          </div>
        </div>
      </Section>

      <Section icon={Percent} title="Charges" c={c}>
        <div style={grid3}>
          <Field label="Tax Rate (%)"><input className="efield" type="number" min="0" step="0.01" value={form.tax_rate} onChange={setField("tax_rate")} /></Field>
          <Field label="Discount Rate (%)"><input className="efield" type="number" min="0" step="0.01" value={form.discount_rate} onChange={setField("discount_rate")} /></Field>
          <Field label="Shipping Charges"><input className="efield" type="number" min="0" step="0.01" value={form.shipping_charges} onChange={setField("shipping_charges")} /></Field>
        </div>
      </Section>

      <Section icon={Landmark} title="Payment Details" c={c}>
        <div style={grid3}>
          <Field label="Bank Name"><input className="efield" value={form.bank_name} onChange={setField("bank_name")} placeholder="HDFC Bank" /></Field>
          <Field label="Account Number"><input className="efield" value={form.account_number} onChange={setField("account_number")} placeholder="000123456789" /></Field>
          <Field label="IFSC Code"><input className="efield" value={form.ifsc_code} onChange={setField("ifsc_code")} placeholder="HDFC0001234" /></Field>
          <Field label="Payment Terms" span={3}><input className="efield" value={form.payment_terms} onChange={setField("payment_terms")} placeholder="Net 15 days" /></Field>
        </div>
      </Section>

      <Section icon={MessageSquare} title="Notes & Terms" c={c}>
        <div style={grid2}>
          <Field label="Notes"><textarea className="efield" style={{ minHeight: 80, resize: "vertical" }} value={form.notes} onChange={setField("notes")} placeholder="Thank you for your business." /></Field>
          <Field label="Terms & Conditions"><textarea className="efield" style={{ minHeight: 80, resize: "vertical" }} value={form.terms_and_conditions} onChange={setField("terms_and_conditions")} placeholder="Payment due within 15 days of invoice date." /></Field>
        </div>
      </Section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="gbtn" style={{ padding: "12px 22px", fontSize: 13.5 }} onClick={generateInvoice} disabled={!isValid || submitting}>
          {submitting
            ? <Loader2 size={15} style={{ marginRight: 8, verticalAlign: -2, animation: "spin 1s linear infinite" }} />
            : <Eye size={15} style={{ marginRight: 8, verticalAlign: -2 }} />}
          {submitting ? "Generating..." : "Generate & Preview Invoice"}
        </button>
      </div>

      {preview && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: c.isDark ? "rgba(6, 8, 15, 0.7)" : "rgba(15, 20, 40, 0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setPreview(null)}
        >
          <div className="glass" style={{ width: "100%", maxWidth: "880px", maxHeight: "90vh", background: c.isDark ? c.bg2 : "#ffffff", padding: "24px", boxShadow: c.isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(15,20,40,0.12)", display: "flex", flexDirection: "column", gap: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Receipt size={20} color={c.cyan} />
                <span className="disp" style={{ fontWeight: 700, fontSize: 18, color: c.text }}>Invoice Preview</span>
              </div>
              <button className="gbtn ghost" style={{ padding: "6px 10px", borderRadius: "10px" }} onClick={() => setPreview(null)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, minHeight: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${c.glassBorder}` }}>
              <iframe title="Invoice preview" srcDoc={preview.html} style={{ width: "100%", height: "65vh", border: "none", background: "#fff" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="gbtn ghost" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => setPreview(null)}>Close</button>
              <button className="gbtn" style={{ padding: "10px 18px", fontSize: 13 }} onClick={printInvoice}>
                <Printer size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
