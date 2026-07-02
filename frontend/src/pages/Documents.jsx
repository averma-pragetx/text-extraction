import { useState, useRef, useEffect } from "react";
import { 
  Upload, ScanLine, Brain, Database, CircleCheck, Check, Pencil, X, Eye, 
  RotateCcw, Table as TableIcon, LayoutGrid, FileText, Code, Building2, 
  Calendar, Hash, Phone, Receipt, DollarSign, ShoppingCart, Copy, CheckCheck,
  Save, Trash2, Loader2, MessageSquare, ExternalLink
} from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Chip } from "../components/common/Chip";
import { API_BASE } from "../utils/api";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function Documents() {
  const c = useC();
  const STAGES = [
    { id: "scanning", k: "Scanning Document", i: Upload, col: c.cyan }, 
    { id: "ocr", k: "Extracting Text", i: ScanLine, col: c.violet }, 
    { id: "mapping", k: "Mapping Layout", i: Brain, col: c.magenta }, 
    { id: "inferring", k: "Inferencing Engine", i: Database, col: c.blue }, 
    { id: "completed", k: "Ingestion Complete", i: CircleCheck, col: c.lime }
  ];
  
  const [stage, setStage] = useState(-1);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");
  const [currentFile, setCurrentFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [remarks, setRemarks] = useState([]);
  const [tempRemarksText, setTempRemarksText] = useState("");
  const [extractedFields, setExtractedFields] = useState(null);
  const [rawResult, setRawResult] = useState(null);
  const [docHistory, setDocHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [savingJson, setSavingJson] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewJson, setPreviewJson] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewingS3, setViewingS3] = useState(null);
  const [showRemarksDetail, setShowRemarksDetail] = useState(null);
  
  const [summary, setSummary] = useState(null);
  
  const ws = useRef(null);
  const fileInput = useRef(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/`);
      if (res.ok) {
        const data = await res.json();
        setDocHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const reset = () => {
    ws.current?.close();
    setStage(-1);
    setDone(false);
    setFileName("");
    setCurrentFile(null);
    setFileError("");
    setRemarks([]);
    setExtractedFields(null);
    setRawResult(null);
    setSummary(null);
    setCopied(false);
    setSavingJson(false);
    setSaveMessage("");
    setSavedRecordId(null);
  };

  const loadFromHistory = (item) => {
    setFileName(item.filename);
    setStage(4);
    setDone(true);
    setSavedRecordId(item.id);
    setSaveMessage("");
    setRemarks(Array.isArray(item.remarks) ? item.remarks : []);
    setCurrentFile(null);
    processExtractionResult(item.raw_json || item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openS3Document = async (e, item) => {
    e.stopPropagation();
    if (!item.id || viewingS3) return;
    setViewingS3(item.id);
    try {
      const res = await fetch(`${API_BASE}/documents/${item.id}/view`);
      if (!res.ok) throw new Error("Failed to get S3 URL");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Could not open S3 document");
    } finally {
      setViewingS3(null);
    }
  };

  const saveCurrentJson = async () => {
    if (!rawResult || savingJson || savedRecordId) return;
    if (!currentFile) {
      setSaveMessage("Original document is not available. Please re-upload the document before saving.");
      return;
    }
    setSavingJson(true);
    setSaveMessage("");

    try {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("filename", fileName || currentFile.name || rawResult?.metadata?.source || "processed_document");
      formData.append("original_name", currentFile.name || fileName || rawResult?.metadata?.source || "processed_document");
      formData.append("raw_json", JSON.stringify(rawResult));
      formData.append("remarks", JSON.stringify(remarks));

      const res = await fetch(`${API_BASE}/documents/save`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || "Failed to save document");
      }

      const saved = await res.json();
      setSavedRecordId(saved.id);
      setSaveMessage("Saved to Database");
      await fetchHistory();
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setSavingJson(false);
    }
  };

  const deleteHistoryItem = async (e, item) => {
    e.stopPropagation();
    if (!item.id || deletingId) return;
    setDeletingId(item.id);

    try {
      const res = await fetch(`${API_BASE}/documents/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || "Failed to delete record");
      }
      if (savedRecordId === item.id) {
        setSavedRecordId(null);
        setSaveMessage("");
      }
      await fetchHistory();
    } catch (err) {
      setFileError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const previewDocument = async (e, item) => {
    e.stopPropagation();
    if (!item.id) return;
    setPreviewLoading(item.id);
    setPreviewJson(null);
    setShowPreviewModal(true);

    try {
      const res = await fetch(`${API_BASE}/documents/get/${item.id}`);
      if (!res.ok) throw new Error("Failed to fetch preview");
      const data = await res.json();
      setPreviewJson(data);
    } catch (err) {
      console.error(err);
      setPreviewJson({ error: "Could not load JSON data" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateDocumentStatus = async (e, item, newStatus) => {
    e.stopPropagation();
    if (!item.id) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const copyRawJson = () => {

    const jsonStr = JSON.stringify(rawResult, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const processExtractionResult = (data) => {
    setRawResult(data);
    // Extract the fields — supports both direct shape and nested extraction shape
    const ef = data.extracted_fields || data.extraction?.extracted_fields || null;
    setExtractedFields(ef);
    setSummary(null);
  };

  const startProcessing = async (file) => {
    setFileName(file.name);
    setCurrentFile(file);
    setFileError("");
    setDone(false);
    setRemarks([]);
    setStage(0);
    setExtractedFields(null);
    setRawResult(null);
    setSaveMessage("");
    setSavedRecordId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { file_id } = await uploadRes.json();

      const wsUrl = `${API_BASE.replace("http", "ws")}/documents/ws/${file_id}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => ws.current.send("start");

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { status, result } = data;

        if (status === "scanning") setStage(0);
        else if (status === "ocr") setStage(1);
        else if (status === "structuring") setStage(2);
        else if (status === "inferring") setStage(3);
        else if (status === "completed") {
          setStage(4);
          setDone(true);
          if (result) processExtractionResult(result);
          ws.current.close();
          fetchHistory();
        } else if (status === "failed") {
          setFileError(data.message || "Processing failed");
          setStage(-1);
          ws.current.close();
        }
      };

      ws.current.onerror = () => {
        setFileError("WebSocket connection error");
        setStage(-1);
      };

    } catch (err) {
      setFileError(err.message);
      setStage(-1);
    }
  };

  const acceptFile = (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError("File exceeds the 50MB limit.");
      return;
    }
    if (stage >= 0 && !done) return;
    startProcessing(file);
  };

  const onFileChange = (e) => {
    acceptFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  useEffect(() => () => ws.current?.close(), []);

  const openRemarksModal = () => {
    setTempRemarksText(remarks.join(", "));
    setShowRemarksModal(true);
  };

  const saveRemarks = async () => {
    const parsed = tempRemarksText.split(",").map(r => r.trim()).filter(r => r.length > 0);
    setRemarks(parsed);
    setShowRemarksModal(false);

    // If the document is already saved, update the remarks in the backend
    if (savedRecordId) {
      try {
        const res = await fetch(`${API_BASE}/documents/${savedRecordId}/remarks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: parsed }),
        });
        if (!res.ok) throw new Error("Failed to update remarks");
        await fetchHistory();
      } catch (err) {
        console.error("Error updating remarks:", err);
        setSaveMessage("Failed to update remarks in database");
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input ref={fileInput} type="file" onChange={onFileChange} style={{ display: "none" }} />
      
      {/* Upload Zone */}
      <div
        className="rise glass"
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          padding: stage >= 0 ? 20 : 48, textAlign: "center", cursor: "pointer",
          border: `1.5px dashed ${dragging ? c.cyan : fileError ? c.red : c.glassBorder}`,
          background: dragging ? (c.isDark ? "rgba(34,211,238,0.06)" : "rgba(8,145,178,0.06)") : undefined,
          transition: "all .3s ease"
        }}
      >
        <div style={{ width: 50, height: 50, margin: "0 auto 14px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${c.cyan}22,${c.violet}22)`, border: `1px solid ${c.cyan}44` }}>
          <Upload size={22} color={c.cyan} />
        </div>
        <div className="disp" style={{ fontSize: 16, fontWeight: 600 }}>{fileName || "Drop a document or click to upload"}</div>
        {!fileName && (
          <>
            <div className="mono" style={{ fontSize: 11.5, color: c.dim, marginTop: 6 }}>Supported Format: PDF, JPG, JPEG, PNG</div>
            <span className="mono" style={{ fontSize: 10, color: c.dim }}>Max 50MB</span>
          </>
        )}
        {fileError && <div className="mono" style={{ fontSize: 12, color: c.red, marginTop: 10 }}>{fileError}</div>}
      </div>

      {/* Processing / Results Area */}
      {stage >= 0 && (
        <div className="rise glass" style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
               <FileText size={18} color={c.cyan} />
               <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Processing: {fileName}</span>
            </div>
            {done && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="gbtn" style={{ padding: "6px 12px", fontSize: 11 }} onClick={saveCurrentJson} disabled={!rawResult || savingJson || !!savedRecordId}>
                  {savingJson ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: "spin 1s linear infinite" }} /> : <Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                  {savedRecordId ? "Saved" : savingJson ? "Saving" : "Save Document"}
                </button>
                <button className="gbtn ghost" style={{ padding: "6px 12px", fontSize: 11 }} onClick={() => setShowRawJson(!showRawJson)}>
                  <Code size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  {showRawJson ? "Show Cards" : "Show raw JSON"}
                </button>
                <button className="gbtn ghost" style={{ padding: "6px 12px", fontSize: 11 }} onClick={reset}>
                  <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  Reset
                </button>
              </div>
            )}
          </div>
          {done && saveMessage && (
            <div className="mono" style={{ fontSize: 11, color: savedRecordId ? c.lime : c.red, marginBottom: 12 }}>
              {saveMessage}
            </div>
          )}

          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: done ? 30 : 0 }}>
            {STAGES.map((st, i) => {
              const Icon = st.i; const active = i === stage && !done; const fin = i < stage || done;
              return (
                <div key={st.k} style={{ display: "flex", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : "0 0 auto" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: fin || active ? st.col + "22" : c.track, border: `1.5px solid ${fin || active ? st.col : c.glassBorder}`, boxShadow: active ? `0 0 22px ${st.col}88` : "none", transition: "all .4s", animation: active ? "pulseGlow 1.4s infinite" : "none" }}>
                      {fin && !active ? <Check size={20} color={st.col} /> : <Icon size={20} color={fin || active ? st.col : c.dim} />}
                    </div>
                    <span className="mono" style={{ fontSize: 9.5, color: fin || active ? c.text : c.dim, whiteSpace: "nowrap" }}>{st.k}</span>
                  </div>
                  {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 8px -18px", borderRadius: 2, background: i < stage || done ? `linear-gradient(90deg,${st.col},${STAGES[i + 1].col})` : c.track, transition: "all .4s" }} />}
                </div>
              );
            })}
          </div>

          {done && !showRawJson && extractedFields && (() => {
            const ef = extractedFields;
            const items = ef.items || [];
            // Separate scalar fields from arrays/objects for card rendering
            const infoFields = Object.entries(ef).filter(([k, v]) => !Array.isArray(v) && typeof v !== 'object');
            // Group fields into categories for visual clarity
            const fieldMeta = {
              company_name: { label: "Company Name", icon: Building2, color: c.cyan },
              former_name: { label: "Former Name", icon: Building2, color: c.muted },
              licensee: { label: "Licensee / Brand", icon: Receipt, color: c.violet },
              address: { label: "Address", icon: Building2, color: c.blue },
              gst_id: { label: "GST / Tax ID", icon: Hash, color: c.magenta },
              contact_number: { label: "Contact Number", icon: Phone, color: c.cyan },
              customer_service_hotline: { label: "Service Hotline", icon: Phone, color: c.cyan },
              invoice_number: { label: "Invoice Number", icon: Receipt, color: c.violet },
              invoice_date: { label: "Invoice Date", icon: Calendar, color: c.blue },
              time_stamp: { label: "Time", icon: Calendar, color: c.blue },
              total_amount: { label: "Total Amount", icon: DollarSign, color: c.lime },
              total_rounded: { label: "Total (Rounded)", icon: DollarSign, color: c.lime },
              cash_tendered: { label: "Cash Tendered", icon: DollarSign, color: c.cyan },
              change: { label: "Change", icon: DollarSign, color: c.cyan },
              total_includes_gst: { label: "Incl. GST", icon: DollarSign, color: c.magenta },
              feedback_link: { label: "Feedback Link", icon: Receipt, color: c.muted },
              feedback_method: { label: "Feedback Method", icon: Receipt, color: c.muted },
            };
            const moneyFields = ["total_amount", "total_rounded", "cash_tendered", "change", "total_includes_gst"];
            const topFields = infoFields.filter(([k]) => !moneyFields.includes(k));
            const totalsFields = infoFields.filter(([k]) => moneyFields.includes(k));

            return (
              <div className="rise" style={{ marginTop: 26, borderTop: `1px solid ${c.glassBorder}`, paddingTop: 20 }}>
                {/* Section Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <LayoutGrid size={18} color={c.cyan} />
                    <span className="disp" style={{ fontWeight: 700, fontSize: 16 }}>Extracted Fields</span>
                  </div>
                  <div style={{ width: 1, height: 20, background: c.glassBorder, margin: "0 10px" }} />
                  <Chip color={c.lime}>{infoFields.length + (items.length > 0 ? 1 : 0)} sections detected</Chip>
                  {remarks.map((r, i) => <Chip key={i} color={c.cyan}>{r}</Chip>)}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    <button className={remarks.length > 0 ? "gbtn ghost" : "gbtn"} style={{ padding: "8px 14px", fontSize: 12 }} onClick={openRemarksModal}>
                      <Pencil size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                      {remarks.length > 0 ? "Edit Remarks" : "Add Remarks"}
                    </button>
                  </div>
                </div>

                {/* Info Cards Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {topFields.map(([key, value]) => {
                    const meta = fieldMeta[key] || { label: key.replace(/_/g, ' '), icon: FileText, color: c.dim };
                    const Icon = meta.icon;
                    return (
                      <div key={key} style={{
                        background: c.isDark ? "rgba(255,255,255,0.025)" : "#F5F7FC",
                        border: `1px solid ${c.glassBorder}`,
                        borderLeft: `3px solid ${meta.color}`,
                        borderRadius: 14,
                        padding: "14px 18px",
                        transition: "all .3s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <Icon size={13} color={meta.color} style={{ opacity: 0.7 }} />
                          <span className="mono" style={{ fontSize: 9, color: c.dim, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="disp" style={{ fontSize: 14, color: c.text, fontWeight: 600, wordBreak: "break-word", lineHeight: 1.5 }}>
                          {value === null || value === "" ? <span style={{ color: c.dim, fontStyle: "italic" }}>—</span> : String(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Line Items Table */}
                {items.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <ShoppingCart size={16} color={c.violet} />
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: c.dim }}>Line Items</span>
                      <Chip color={c.violet}>{items.length} items</Chip>
                    </div>
                    <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${c.glassBorder}` }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead style={{ background: c.isDark ? "rgba(255,255,255,0.02)" : "#F9FAFC" }}>
                          <tr>
                            <th className="mono" style={{ textAlign: "left", padding: "12px 16px", color: c.dim, fontSize: 10, textTransform: "uppercase", width: 50 }}>#</th>
                            <th className="mono" style={{ textAlign: "left", padding: "12px 16px", color: c.dim, fontSize: 10, textTransform: "uppercase" }}>Qty</th>
                            <th className="mono" style={{ textAlign: "left", padding: "12px 16px", color: c.dim, fontSize: 10, textTransform: "uppercase" }}>Item</th>
                            <th className="mono" style={{ textAlign: "right", padding: "12px 16px", color: c.dim, fontSize: 10, textTransform: "uppercase" }}>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} style={{ borderTop: `1px solid ${c.glassBorder}`, transition: "background 0.15s" }}>
                              <td className="mono" style={{ padding: "12px 16px", color: c.dim, fontSize: 11 }}>{idx + 1}</td>
                              <td style={{ padding: "12px 16px", color: c.text, fontWeight: 600 }}>{item.quantity}</td>
                              <td style={{ padding: "12px 16px", color: c.text, fontWeight: 500 }}>{item.item_name || item.name || item.description || "—"}</td>
                              <td className="mono" style={{ padding: "12px 16px", color: c.text, fontWeight: 700, textAlign: "right" }}>
                                {typeof item.price === 'number' ? item.price.toFixed(2) : item.price || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Financial Totals */}
                {totalsFields.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <DollarSign size={16} color={c.lime} />
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: c.dim }}>Totals</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                      {totalsFields.map(([key, value]) => {
                        const meta = fieldMeta[key] || { label: key.replace(/_/g, ' '), color: c.lime };
                        const isMainTotal = key === "total_amount";
                        return (
                          <div key={key} style={{
                            background: isMainTotal
                              ? `linear-gradient(135deg, ${c.lime}14, ${c.cyan}10)`
                              : (c.isDark ? "rgba(255,255,255,0.025)" : "#F5F7FC"),
                            border: `1px solid ${isMainTotal ? c.lime + "44" : c.glassBorder}`,
                            borderRadius: 14,
                            padding: "14px 18px",
                            transition: "all .3s",
                          }}>
                            <div className="mono" style={{ fontSize: 9, color: c.dim, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
                              {meta.label}
                            </div>
                            <div className="disp" style={{
                              fontSize: isMainTotal ? 22 : 17,
                              fontWeight: 700,
                              color: isMainTotal ? c.lime : c.text,
                              marginTop: 4,
                            }}>
                              {typeof value === 'number' ? value.toFixed(2) : value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* No Fields Fallback */}
          {done && !showRawJson && !extractedFields && (
            <div className="rise" style={{ marginTop: 26, borderTop: `1px solid ${c.glassBorder}`, paddingTop: 20, textAlign: "center" }}>
              <div className="mono" style={{ padding: 30, color: c.dim }}>No extracted fields found. Try viewing the raw JSON output.</div>
            </div>
          )}

          {/* Raw JSON View */}
          {done && showRawJson && (
            <div className="rise" style={{ marginTop: 26, borderTop: `1px solid ${c.glassBorder}`, paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Code size={16} color={c.cyan} />
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: c.dim }}>Raw JSON Output</span>
                </div>
                <button className="gbtn ghost" style={{ padding: "5px 12px", fontSize: 11 }} onClick={copyRawJson}>
                  {copied ? <CheckCheck size={14} style={{ marginRight: 5, verticalAlign: -2, color: c.lime }} /> : <Copy size={14} style={{ marginRight: 5, verticalAlign: -2 }} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre style={{ 
                background: c.isDark ? "rgba(0,0,0,0.6)" : "#f8f9fc", 
                padding: 20, 
                borderRadius: 14, 
                fontSize: 12, 
                overflow: "auto", 
                maxHeight: 500,
                color: c.isDark ? "#a5f3fc" : "#1e293b",
                border: `1px solid ${c.glassBorder}`,
                lineHeight: 1.6,
                tabSize: 2,
              }}>
                {JSON.stringify(rawResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Documents History Table */}
      <div className="rise glass" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
           <span className="disp" style={{ fontWeight: 700, fontSize: 16 }}>Extraction History</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              {["Document", "Type", "Source", "Remarks", "Created At", "Status", "Actions"].map((h) => (
                <th key={h} className="mono" style={{ textAlign: "left", color: c.dim, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", padding: "0 10px 12px 0", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docHistory.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: c.dim }} className="mono">No saved documents</td>
              </tr>
            ) : docHistory.map((r, i) => (
              <tr 
                key={r.id || i} 
                onClick={() => loadFromHistory(r)}
                style={{ borderTop: `1px solid ${c.glassBorder}`, cursor: "pointer", transition: "background 0.2s" }}
                className="hover-row"
              >
                <td style={{ padding: "14px 10px 14px 0", color: c.text, fontWeight: 500 }}>{r.filename}</td>
                <td style={{ padding: "14px 10px" }}><Chip color={c.cyan}>{r.type}</Chip></td>
                <td style={{ padding: "14px 10px" }}>
                  {r.s3?.key ? (
                    <button 
                      className="gbtn ghost" 
                      onClick={(e) => openS3Document(e, r)}
                      disabled={viewingS3 === r.id}
                      style={{ padding: "5px 8px", fontSize: 10, color: c.cyan, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      {viewingS3 === r.id ? <Loader2 size={12} className="spin" /> : <ExternalLink size={12} />}
                      View Document
                    </button>
                  ) : <span className="mono" style={{ color: c.dim }}>—</span>}
                </td>
                <td style={{ padding: "14px 10px" }}>
                  {Array.isArray(r.remarks) && r.remarks.length > 0 ? (
                    <button 
                      className="gbtn ghost" 
                      onClick={(e) => { e.stopPropagation(); setShowRemarksDetail(r); }}
                      style={{ padding: "5px 8px", fontSize: 10, color: c.violet, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <MessageSquare size={12} />
                      {r.remarks.length} Remarks
                    </button>
                  ) : <span className="mono" style={{ color: c.dim }}>—</span>}
                </td>
                <td className="mono" style={{ padding: "14px 10px", color: c.muted }}>{r.processed_at || r.created_at || "—"}</td>
                <td style={{ padding: "14px 10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: r.status === "Approved" ? c.cyan : r.status === "Rejected" ? c.red : c.lime, fontSize: 11.5 }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: "14px 10px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="gbtn ghost"
                      title="Preview JSON"
                      onClick={(e) => previewDocument(e, r)}
                      disabled={previewLoading === r.id}
                      style={{ padding: "7px 10px", fontSize: 11, color: c.cyan }}
                    >
                      {previewLoading === r.id ? <Loader2 size={14} style={{ verticalAlign: -2, animation: "spin 1s linear infinite" }} /> : <Eye size={14} style={{ verticalAlign: -2 }} />}
                    </button>
                    <button
                      className="gbtn ghost"
                      title="Approve"
                      onClick={(e) => updateDocumentStatus(e, r, "Approved")}
                      style={{ padding: "7px 10px", fontSize: 11, color: c.lime }}
                    >
                      <Check size={14} style={{ verticalAlign: -2 }} />
                    </button>
                    <button
                      className="gbtn ghost"
                      title="Reject"
                      onClick={(e) => updateDocumentStatus(e, r, "Rejected")}
                      style={{ padding: "7px 10px", fontSize: 11, color: c.red }}
                    >
                      <X size={14} style={{ verticalAlign: -2 }} />
                    </button>
                    <button
                      className="gbtn ghost"
                      title="Delete saved document"
                      onClick={(e) => deleteHistoryItem(e, r)}
                      disabled={deletingId === r.id}
                      style={{ padding: "7px 10px", fontSize: 11, color: c.red }}
                    >
                      {deletingId === r.id ? <Loader2 size={14} style={{ verticalAlign: -2, animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} style={{ verticalAlign: -2 }} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Remarks Detail Modal */}
      {showRemarksDetail && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: c.isDark ? "rgba(6, 8, 15, 0.7)" : "rgba(15, 20, 40, 0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "rise 0.3s ease-out" }}
          onClick={() => setShowRemarksDetail(null)}
        >
          <div className="glass" style={{ width: "100%", maxWidth: "420px", background: c.isDark ? c.bg2 : "#ffffff", padding: "28px", boxShadow: c.isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(15,20,40,0.12)", display: "flex", flexDirection: "column", gap: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MessageSquare size={20} color={c.violet} />
                <span className="disp" style={{ fontWeight: 700, fontSize: 18, color: c.text }}>Remarks Detail</span>
              </div>
              <button className="gbtn ghost" style={{ padding: "6px 10px", borderRadius: "10px" }} onClick={() => setShowRemarksDetail(null)}><X size={16} /></button>
            </div>
            
            <div className="mono" style={{ fontSize: 11, color: c.muted }}>Stored remarks for <span style={{ color: c.cyan }}>{showRemarksDetail.filename}</span></div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {showRemarksDetail.remarks.map((remark, idx) => (
                <div key={idx} style={{ 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  background: c.isDark ? "rgba(255,255,255,0.03)" : "#F9FAFC",
                  border: `1px solid ${c.glassBorder}`,
                  borderLeft: `3px solid ${c.violet}`,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: c.text
                }}>
                  {remark}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button className="gbtn" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => setShowRemarksDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Remarks Modal */}
      {showRemarksModal && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: c.isDark ? "rgba(6, 8, 15, 0.7)" : "rgba(15, 20, 40, 0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "rise 0.3s ease-out" }}
          onClick={() => setShowRemarksModal(false)}
        >
          <div className="glass" style={{ width: "100%", maxWidth: "480px", background: c.isDark ? c.bg2 : "#ffffff", padding: "28px", boxShadow: c.isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(15,20,40,0.12)", display: "flex", flexDirection: "column", gap: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 18, color: c.text }}>Document Remarks</span>
              <button className="gbtn ghost" style={{ padding: "6px 10px", borderRadius: "10px" }} onClick={() => setShowRemarksModal(false)}><X size={16} /></button>
            </div>
            <div className="mono" style={{ fontSize: 11, color: c.muted }}>Add remarks for <span style={{ color: c.cyan }}>{fileName}</span>. Separate multiple remarks with commas.</div>
            <textarea className="efield" style={{ minHeight: "100px", resize: "vertical", fontFamily: "inherit", fontSize: "13.5px", padding: "12px", lineHeight: "1.5" }} placeholder="e.g. Urgent Review, Verified by Mechanical, Mismatch Resolved" value={tempRemarksText} onChange={(e) => setTempRemarksText(e.target.value)} autoFocus />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="gbtn ghost" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => setShowRemarksModal(false)}>Cancel</button>
              <button className="gbtn" style={{ padding: "10px 18px", fontSize: 13 }} onClick={saveRemarks}>Save Remarks</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview JSON Modal */}
      {showPreviewModal && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: c.isDark ? "rgba(6, 8, 15, 0.7)" : "rgba(15, 20, 40, 0.45)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "rise 0.3s ease-out" }}
          onClick={() => setShowPreviewModal(false)}
        >
          <div className="glass" style={{ width: "100%", maxWidth: "800px", background: c.isDark ? c.bg2 : "#ffffff", padding: "28px", boxShadow: c.isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(15,20,40,0.12)", display: "flex", flexDirection: "column", gap: 16, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Code size={20} color={c.cyan} />
                <span className="disp" style={{ fontWeight: 700, fontSize: 18, color: c.text }}>JSON Preview</span>
              </div>
              <button className="gbtn ghost" style={{ padding: "6px 10px", borderRadius: "10px" }} onClick={() => setShowPreviewModal(false)}><X size={16} /></button>
            </div>
            
            <div style={{ flex: 1, overflow: "auto", borderRadius: 14, border: `1px solid ${c.glassBorder}`, background: c.isDark ? "rgba(0,0,0,0.2)" : "#f8f9fc" }}>
              {previewLoading ? (
                <div style={{ padding: 60, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Loader2 size={32} color={c.cyan} className="spin" />
                  <div className="mono" style={{ fontSize: 12, color: c.muted }}>Fetching stored JSON...</div>
                </div>
              ) : (
                <pre style={{ 
                  padding: 20, 
                  fontSize: 12, 
                  color: c.isDark ? "#a5f3fc" : "#1e293b",
                  lineHeight: 1.6,
                  tabSize: 2,
                  margin: 0
                }}>
                  {JSON.stringify(previewJson, null, 2)}
                </pre>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="gbtn" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => setShowPreviewModal(false)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
