import { useEffect, useState } from "react";
import { Check, X, ListTree, CircleCheck, Eye, Loader2, AlertTriangle, FileText, Database } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Chip } from "../components/common/Chip";
import { API_BASE } from "../utils/api";

const STATUS_COLOR_KEY = { Saved: "amber", Approved: "lime", Rejected: "red" };

export function Review() {
  const c = useC();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldsTarget, setFieldsTarget] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectRemarksText, setRejectRemarksText] = useState("");

  const fetchQueue = () => {
    setLoading(true);
    setError(null);
    return fetch(`${API_BASE}/review/queue`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load review queue");
        return res.json();
      })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load review queue"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const previewDocument = async (item) => {
    if (previewingId) return;
    setPreviewingId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/documents/${item.id}/view`);
      if (!res.ok) throw new Error("Document is not available in S3");
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setActionError(err.message || "Could not open the document");
    } finally {
      setPreviewingId(null);
    }
  };

  const decide = async (item, decision, remarks) => {
    if (actionId) return;
    setActionId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/review/${item.id}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: remarks && remarks.length ? remarks : null }),
      });
      if (!res.ok) throw new Error(`Failed to ${decision} document`);
      const data = await res.json();
      setItems((prev) => prev.map((it) => {
        if (it.id !== item.id) return it;
        const mergedRemarks = remarks && remarks.length
          ? Array.from(new Set([...(it.remarks || []), ...remarks]))
          : it.remarks;
        return { ...it, status: data.status, remarks: mergedRemarks };
      }));
      if (rejectTarget?.id === item.id) {
        setRejectTarget(null);
        setRejectRemarksText("");
      }
    } catch (err) {
      setActionError(err.message || `Failed to ${decision} document`);
    } finally {
      setActionId(null);
    }
  };

  const openRejectModal = (item) => {
    setActionError(null);
    setRejectRemarksText("");
    setRejectTarget(item);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const remarks = rejectRemarksText.split(",").map((r) => r.trim()).filter(Boolean);
    decide(rejectTarget, "reject", remarks);
  };

  const extractedFieldEntries = (item) => {
    const fields = item.extraction?.extracted_fields || {};
    return Object.entries(fields).filter(([, v]) => v !== null && typeof v !== "object");
  };

  const buildFlags = (item) => {
    const flags = [];
    if (!item.s3?.key) {
      flags.push(["Document not stored in database", c.amber]);
    }
    (item.remarks || []).forEach((r) => flags.push([r, c.violet]));
    return flags;
  };

  const pendingCount = items.filter((it) => (it.status || "Saved") === "Saved").length;

  const renderCard = (it, { keyPrefix, showActions }) => {
    const cardKey = `${keyPrefix}:${it.id}`;
    const flags = buildFlags(it);
    const status = it.status || "Saved";
    const decided = status !== "Saved";

    return (
      <div key={cardKey} className="rise glass" style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 50, height: 50, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${c.cyan}16, ${c.violet}16)`,
              border: `1.5px solid ${c.glassBorder}`,
              color: c.cyan,
              boxShadow: c.isDark ? `0 8px 24px -6px ${c.cyan}33` : "none",
            }}
          >
            <FileText size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setFieldsTarget(it)}>
            <div className="disp" style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {it.original_name || it.filename}
              <ListTree size={14} color={c.dim} />
            </div>
            <div className="mono" style={{ fontSize: 11, color: c.dim, marginTop: 2 }}>
              {it.type} · {it.processed_at ? new Date(it.processed_at).toLocaleString() : "unknown date"}
            </div>
            {flags.length > 0 && (
              <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap", fontSize: 12 }}>
                Remarks:
                {flags.map(([t, col], j) => <Chip key={j} color={col}>{t}</Chip>)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            <button
              className="gbtn ghost"
              style={{ padding: "8px 14px", fontSize: 12 }}
              onClick={() => previewDocument(it)}
              disabled={previewingId === it.id}
            >
              {previewingId === it.id
                ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: "spin 1s linear infinite" }} />
                : <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
              Preview Document
            </button>
            {showActions && !decided ? (
              <>
                <button
                  className="gbtn"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                  onClick={() => decide(it, "approve")}
                  disabled={actionId === it.id}
                >
                  {actionId === it.id
                    ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: "spin 1s linear infinite" }} />
                    : <Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                  Approve
                </button>
                <button
                  className="gbtn danger"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                  onClick={() => openRejectModal(it)}
                  disabled={actionId === it.id}
                >
                  {actionId === it.id
                    ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: "spin 1s linear infinite" }} />
                    : <X size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                  Reject
                </button>
              </>
            ) : (
              <Chip color={c[STATUS_COLOR_KEY[status] || "muted"]}>{status}</Chip>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="disp" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}>
          <Database size={15} color={c.cyan} />
          {loading ? "Loading review queue…" : `${pendingCount} of ${items.length} document${items.length === 1 ? "" : "s"} awaiting review`}
        </div>

        {error && (
          <div className="glass" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, color: c.red }}>
            <AlertTriangle size={16} />
            <span className="mono" style={{ fontSize: 12 }}>{error}</span>
          </div>
        )}

        {actionError && (
          <div className="glass" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, color: c.red }}>
            <AlertTriangle size={16} />
            <span className="mono" style={{ fontSize: 12 }}>{actionError}</span>
          </div>
        )}

        {items.filter((it) => (it.status || "Saved") === "Saved").map((it) => renderCard(it, { keyPrefix: "pending", showActions: true }))}

        {!loading && !error && pendingCount === 0 && (
          <div className="glass" style={{ padding: 48, textAlign: "center" }}>
            <CircleCheck size={32} color={c.lime} style={{ marginBottom: 10 }} />
            <div className="disp" style={{ fontWeight: 600 }}>Queue clear</div>
            <div className="mono" style={{ fontSize: 11, color: c.dim, marginTop: 4 }}>All documents reviewed</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Database size={15} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Saved Documents</span>
          <Chip color={c.cyan}>{items.length}</Chip>
        </div>

        {!loading && items.length === 0 && !error && (
          <div className="glass" style={{ padding: 40, textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 12, color: c.dim }}>No documents have been saved to the database yet.</div>
          </div>
        )}

        {items.map((it) => renderCard(it, { keyPrefix: "all", showActions: false }))}
      </div>

      {rejectTarget && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: c.isDark ? "rgba(6, 8, 15, 0.7)" : "rgba(15, 20, 40, 0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => (actionId ? null : setRejectTarget(null))}
        >
          <div className="glass" style={{ width: "100%", maxWidth: "480px", background: c.isDark ? c.bg2 : "#ffffff", padding: "28px", boxShadow: c.isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(15,20,40,0.12)", display: "flex", flexDirection: "column", gap: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 18, color: c.text }}>Reject Document</span>
              <button className="gbtn ghost" style={{ padding: "6px 10px", borderRadius: "10px" }} onClick={() => setRejectTarget(null)}><X size={16} /></button>
            </div>
            <div className="mono" style={{ fontSize: 11, color: c.muted }}>
              Add remarks for rejecting <span style={{ color: c.cyan }}>{rejectTarget.original_name || rejectTarget.filename}</span>. Separate multiple remarks with commas.
              <span style={{ display: "block", marginTop: 4, color: c.amber }}>* Adding remarks is optional</span>
            </div>
            <textarea
              className="efield"
              style={{ minHeight: "100px", resize: "vertical", fontFamily: "inherit", fontSize: "13.5px", padding: "12px", lineHeight: "1.5" }}
              placeholder="e.g. Vendor not recognized, PO reference missing"
              value={rejectRemarksText}
              onChange={(e) => setRejectRemarksText(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="gbtn ghost" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => setRejectTarget(null)} disabled={!!actionId}>Cancel</button>
              <button className="gbtn danger" style={{ padding: "10px 18px", fontSize: 13 }} onClick={confirmReject} disabled={!!actionId}>
                {actionId === rejectTarget.id
                  ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: "spin 1s linear infinite" }} />
                  : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {fieldsTarget && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: c.isDark ? "rgba(6, 8, 15, 0.7)" : "rgba(15, 20, 40, 0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setFieldsTarget(null)}
        >
          <div className="glass" style={{ width: "100%", maxWidth: "640px", maxHeight: "80vh", background: c.isDark ? c.bg2 : "#ffffff", padding: "28px", boxShadow: c.isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(15,20,40,0.12)", display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <ListTree size={20} color={c.cyan} />
                <span className="disp" style={{ fontWeight: 700, fontSize: 18, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fieldsTarget.original_name || fieldsTarget.filename}
                </span>
              </div>
              <button className="gbtn ghost" style={{ padding: "6px 10px", borderRadius: "10px", flexShrink: 0 }} onClick={() => setFieldsTarget(null)}><X size={16} /></button>
            </div>
            <div className="mono" style={{ fontSize: 11, color: c.muted }}>Extracted fields</div>
            <div style={{ overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingRight: 4 }}>
              {extractedFieldEntries(fieldsTarget).length > 0 ? extractedFieldEntries(fieldsTarget).map(([l, v]) => (
                <div key={l}>
                  <div className="mono" style={{ fontSize: 9.5, color: c.dim, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>{l.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 13, color: c.text, wordBreak: "break-word" }}>{String(v)}</div>
                </div>
              )) : (
                <div className="mono" style={{ fontSize: 12, color: c.dim, gridColumn: "1 / -1" }}>No extracted fields available for this document.</div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="gbtn" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => setFieldsTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
