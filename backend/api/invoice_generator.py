from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional
from jinja2 import Template
from datetime import datetime
import logging

router = APIRouter(prefix="/invoices", tags=["invoice-generator"])
logger = logging.getLogger(__name__)


class InvoiceLineItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0


class InvoiceGenerateRequest(BaseModel):
    # Seller / company details
    company_name: str
    company_address: Optional[str] = ""
    company_email: Optional[str] = ""
    company_phone: Optional[str] = ""
    company_gst: Optional[str] = ""

    # Client / bill-to details
    client_name: str
    client_address: Optional[str] = ""
    client_email: Optional[str] = ""
    client_phone: Optional[str] = ""
    client_gst: Optional[str] = ""

    # Invoice meta
    invoice_number: str
    invoice_date: str
    due_date: Optional[str] = ""
    po_number: Optional[str] = ""
    currency: str = "INR"

    # Line items
    line_items: List[InvoiceLineItem] = Field(default_factory=list)

    # Financials
    tax_rate: float = 0
    discount_rate: float = 0
    shipping_charges: float = 0

    # Payment & notes
    bank_name: Optional[str] = ""
    account_number: Optional[str] = ""
    ifsc_code: Optional[str] = ""
    payment_terms: Optional[str] = ""
    notes: Optional[str] = ""
    terms_and_conditions: Optional[str] = ""


CURRENCY_SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}

INVOICE_TEMPLATE = Template("""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice {{ inv.invoice_number }}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 44px; background: #ffffff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7C3AED; padding-bottom: 20px; margin-bottom: 28px; }
  .company-name { font-size: 22px; font-weight: 700; }
  .muted { color: #666; font-size: 12.5px; line-height: 1.6; }
  .invoice-title { font-size: 30px; font-weight: 800; color: #7C3AED; text-align: right; letter-spacing: 1px; }
  .meta-table { border-collapse: collapse; margin-top: 10px; }
  .meta-table td { padding: 2px 0; font-size: 12.5px; }
  .meta-table td:first-child { color: #666; padding-right: 14px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 28px; gap: 40px; }
  .party-block h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #7C3AED; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  table.items th { background: #f3f0fb; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #444; }
  table.items td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #eee; }
  table.items th:last-child, table.items td:last-child, table.items th:nth-child(3), table.items td:nth-child(3), table.items th:nth-child(4), table.items td:nth-child(4) { text-align: right; }
  .totals { width: 280px; margin-left: auto; }
  .totals table { width: 100%; border-collapse: collapse; }
  .totals td { padding: 5px 0; font-size: 13px; }
  .totals td:last-child { text-align: right; }
  .totals .grand td { font-size: 17px; font-weight: 800; color: #7C3AED; border-top: 2px solid #1a1a2e; padding-top: 10px; }
  .footer { margin-top: 36px; display: flex; justify-content: space-between; gap: 40px; font-size: 12px; color: #444; }
  .footer h4 { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #7C3AED; margin: 0 0 6px; }
  .stamp { margin-top: 30px; text-align: center; font-size: 10.5px; color: #999; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">{{ inv.company_name }}</div>
      <div class="muted">
        {% if inv.company_address %}{{ inv.company_address }}<br>{% endif %}
        {% if inv.company_email %}{{ inv.company_email }}{% if inv.company_phone %} &middot; {% endif %}{% endif %}{{ inv.company_phone }}<br>
        {% if inv.company_gst %}GSTIN: {{ inv.company_gst }}{% endif %}
      </div>
    </div>
    <div>
      <div class="invoice-title">INVOICE</div>
      <table class="meta-table">
        <tr><td>Invoice #</td><td>{{ inv.invoice_number }}</td></tr>
        <tr><td>Date</td><td>{{ inv.invoice_date }}</td></tr>
        {% if inv.due_date %}<tr><td>Due Date</td><td>{{ inv.due_date }}</td></tr>{% endif %}
        {% if inv.po_number %}<tr><td>PO #</td><td>{{ inv.po_number }}</td></tr>{% endif %}
      </table>
    </div>
  </div>

  <div class="parties">
    <div class="party-block">
      <h4>Bill To</h4>
      <div style="font-weight:600;">{{ inv.client_name }}</div>
      <div class="muted">
        {% if inv.client_address %}{{ inv.client_address }}<br>{% endif %}
        {% if inv.client_email %}{{ inv.client_email }}<br>{% endif %}
        {% if inv.client_phone %}{{ inv.client_phone }}<br>{% endif %}
        {% if inv.client_gst %}GSTIN: {{ inv.client_gst }}{% endif %}
      </div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr><th style="width:40px;">#</th><th>Description</th><th style="width:80px;">Qty</th><th style="width:110px;">Unit Price</th><th style="width:120px;">Amount</th></tr>
    </thead>
    <tbody>
      {% for item in inv.line_items %}
      <tr>
        <td>{{ loop.index }}</td>
        <td>{{ item.description }}</td>
        <td>{{ item.quantity }}</td>
        <td>{{ symbol }}{{ "%.2f"|format(item.unit_price) }}</td>
        <td>{{ symbol }}{{ "%.2f"|format(item.quantity * item.unit_price) }}</td>
      </tr>
      {% else %}
      <tr><td colspan="5" style="color:#999;">No line items added.</td></tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td>{{ symbol }}{{ "%.2f"|format(totals.subtotal) }}</td></tr>
      {% if inv.discount_rate %}<tr><td>Discount ({{ inv.discount_rate }}%)</td><td>-{{ symbol }}{{ "%.2f"|format(totals.discount_amount) }}</td></tr>{% endif %}
      {% if inv.tax_rate %}<tr><td>Tax ({{ inv.tax_rate }}%)</td><td>{{ symbol }}{{ "%.2f"|format(totals.tax_amount) }}</td></tr>{% endif %}
      {% if inv.shipping_charges %}<tr><td>Shipping</td><td>{{ symbol }}{{ "%.2f"|format(totals.shipping_charges) }}</td></tr>{% endif %}
      <tr class="grand"><td>Total Due</td><td>{{ symbol }}{{ "%.2f"|format(totals.total) }}</td></tr>
    </table>
  </div>

  {% if inv.bank_name or inv.account_number or inv.notes or inv.terms_and_conditions %}
  <div class="footer">
    {% if inv.bank_name or inv.account_number or inv.payment_terms %}
    <div>
      <h4>Payment Details</h4>
      {% if inv.bank_name %}Bank: {{ inv.bank_name }}<br>{% endif %}
      {% if inv.account_number %}Account #: {{ inv.account_number }}<br>{% endif %}
      {% if inv.ifsc_code %}IFSC: {{ inv.ifsc_code }}<br>{% endif %}
      {% if inv.payment_terms %}Terms: {{ inv.payment_terms }}{% endif %}
    </div>
    {% endif %}
    {% if inv.notes or inv.terms_and_conditions %}
    <div>
      {% if inv.notes %}<h4>Notes</h4><div>{{ inv.notes }}</div>{% endif %}
      {% if inv.terms_and_conditions %}<h4 style="margin-top:12px;">Terms &amp; Conditions</h4><div>{{ inv.terms_and_conditions }}</div>{% endif %}
    </div>
    {% endif %}
  </div>
  {% endif %}

  <div class="stamp">Generated by EPCFlow on {{ generated_at }}</div>
</body>
</html>""")


def compute_totals(payload: InvoiceGenerateRequest) -> dict:
    subtotal = sum(item.quantity * item.unit_price for item in payload.line_items)
    discount_amount = subtotal * (payload.discount_rate / 100)
    taxable_amount = subtotal - discount_amount
    tax_amount = taxable_amount * (payload.tax_rate / 100)
    total = taxable_amount + tax_amount + payload.shipping_charges
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "tax_amount": round(tax_amount, 2),
        "shipping_charges": round(payload.shipping_charges, 2),
        "total": round(total, 2),
    }


@router.post("/generate")
async def generate_invoice(payload: InvoiceGenerateRequest):
    """Renders a formatted, print-ready invoice document from user-supplied details."""
    totals = compute_totals(payload)
    symbol = CURRENCY_SYMBOLS.get(payload.currency, payload.currency)
    html = INVOICE_TEMPLATE.render(
        inv=payload,
        totals=totals,
        symbol=symbol,
        generated_at=datetime.utcnow().strftime("%d %b %Y, %H:%M UTC"),
    )
    logger.info(f"Generated invoice {payload.invoice_number} for client {payload.client_name}")
    return {"html": html, "totals": totals}
