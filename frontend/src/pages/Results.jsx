import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getExtractionResult, extractTranscripts, exportCSV, exportPDF, exportJSON, updateActionItemStatus, getDraftEmail } from "../api/client";
import { ArrowLeft, Download, Zap, CheckSquare, Lightbulb, Users, Calendar, AlertCircle, MessageSquare, ChevronDown, Check, Mail, Copy, X } from "lucide-react";

const PRIORITY_STYLES = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const isOverdue = (byWhen, status) => {
  if (!byWhen || status === "complete") return false;
  const due = new Date(byWhen);
  return !isNaN(due) && due < new Date();
};

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("actions");
  const [exportOpen, setExportOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getExtractionResult(id);
        setResult(res.data);
      } catch {
        setError("No extraction result found. Run extraction first.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      const res = await extractTranscripts([id]);
      setResult(res.data);
    } catch {
      setError("Extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  const handleChat = async () => {
    const { startSession } = await import("../api/client");
    const res = await startSession([id]);
    navigate(`/chat/${res.data.session_id}`);
  };

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === "complete" ? "pending" : "complete";
    setUpdatingStatus(item.id);
    try {
      await updateActionItemStatus(id, item.id, newStatus);
      setResult((prev) => ({
        ...prev,
        action_items: prev.action_items.map((a) =>
          a.id === item.id ? { ...a, status: newStatus } : a
        ),
      }));
    } catch {
      // silently fail
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDraftEmail = async () => {
    setEmailModal(true);
    if (emailDraft) return;
    setEmailLoading(true);
    try {
      const res = await getDraftEmail(id);
      setEmailDraft(res.data);
    } catch (e) {
      console.error("Draft email error:", e.response?.data);  // add this
      setEmailDraft({ 
        subject: "Error", 
        body: e.response?.data?.detail || "Failed to generate email. Please try again." 
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCopy = () => {
    const text = `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-200 text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to transcripts
      </button>

      {error && !result && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-10 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-stone-600" />
          <p className="text-stone-400 mb-4">{error}</p>
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-stone-950 font-semibold text-sm hover:bg-emerald-400 transition-colors mx-auto disabled:opacity-50"
          >
            <Zap size={15} />
            {extracting ? "Extracting..." : "Run Extraction"}
          </button>
        </div>
      )}

      {result && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-stone-100 tracking-tight mb-1">
                {result.source_filename || "Extraction Results"}
              </h1>
              <p className="text-stone-400 text-sm leading-relaxed max-w-2xl">
                {result.summary}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleChat}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm font-medium hover:bg-stone-800 transition-colors"
              >
                <MessageSquare size={14} />
                Chat
              </button>
              <button
                onClick={handleDraftEmail}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm font-medium hover:bg-stone-800 transition-colors"
              >
                <Mail size={14} />
                Draft Email
              </button>
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                <Zap size={14} />
                {extracting ? "Re-extracting..." : "Re-extract"}
              </button>

              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-stone-950 text-sm font-semibold hover:bg-emerald-400 transition-colors"
                >
                  <Download size={14} />
                  Export
                  <ChevronDown size={13} className={`transition-transform ${exportOpen ? "rotate-180" : ""}`} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-stone-800 border border-stone-700 rounded-xl overflow-hidden shadow-xl z-20 min-w-32">
                    <button
                      onClick={() => { exportCSV(id); setExportOpen(false); }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-700 hover:text-stone-100 transition-colors"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => { exportPDF(id); setExportOpen(false); }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-700 hover:text-stone-100 transition-colors"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => { exportJSON(id); setExportOpen(false); }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-700 hover:text-stone-100 transition-colors"
                    >
                      JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Action Items", value: result.action_items?.length || 0, icon: CheckSquare, color: "text-emerald-400" },
              { label: "Decisions", value: result.decisions?.length || 0, icon: Lightbulb, color: "text-amber-400" },
              { label: "Participants", value: [...new Set(result.action_items?.map(a => a.who) || [])].length, icon: Users, color: "text-blue-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={15} className={color} />
                  <span className="text-xs text-stone-500 font-medium uppercase tracking-widest">{label}</span>
                </div>
                <p className="text-3xl font-bold text-stone-100">{value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-stone-900 border border-stone-800 rounded-xl p-1 w-fit">
            {["actions", "decisions"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-stone-700 text-stone-100"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                {tab === "actions" ? "Action Items" : "Decisions"}
              </button>
            ))}
          </div>

          {/* Action Items Table */}
          {activeTab === "actions" && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-800">
                    <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Task</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Owner</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Due</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Priority</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.action_items?.map((item, i) => {
                    const isComplete = item.status === "complete";
                    const isUpdating = updatingStatus === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${
                          i === result.action_items.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        <td className={`px-5 py-4 text-sm max-w-xs transition-colors ${isComplete ? "text-stone-500 line-through" : "text-stone-200"}`}>
                          {item.what}
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-stone-300">
                              {item.who?.[0] || "?"}
                            </div>
                            <span className="text-sm text-stone-300">{item.who || "Unassigned"}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-sm text-stone-400">
                            <Calendar size={12} />
                            {item.by_when || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium}`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleToggleStatus(item)}
                            disabled={isUpdating}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border capitalize transition-colors disabled:opacity-50 ${
                              isComplete
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                : isOverdue(item.by_when, item.status)
                                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                : "bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700 hover:text-stone-200"
                            }`}
                          >
                            {isComplete && <Check size={11} />}
                            {isUpdating ? "..." : isComplete ? "complete" : isOverdue(item.by_when, item.status) ? "overdue" : item.status || "pending"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Decisions */}
          {activeTab === "decisions" && (
            <div className="space-y-3">
              {result.decisions?.map((d) => (
                <div key={d.id} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 hover:border-stone-700 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Lightbulb size={14} className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-stone-200 font-medium text-sm mb-2">{d.description}</p>
                      {d.context && (
                        <p className="text-stone-500 text-xs mb-3">{d.context}</p>
                      )}
                      {d.participants?.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users size={11} className="text-stone-600" />
                          <div className="flex gap-1.5 flex-wrap">
                            {d.participants.map((p) => (
                              <span key={p} className="text-xs px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 border border-stone-700">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Email Draft Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-stone-400" />
                <span className="text-sm font-semibold text-stone-200">Follow-up Email Draft</span>
              </div>
              <button
                onClick={() => setEmailModal(false)}
                className="text-stone-500 hover:text-stone-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {emailLoading ? (
                <div className="flex items-center justify-center h-32 text-stone-500 text-sm">
                  Drafting email...
                </div>
              ) : emailDraft ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Subject</p>
                    <p className="text-stone-200 text-sm font-medium bg-stone-800 px-4 py-2.5 rounded-xl border border-stone-700">
                      {emailDraft.subject}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Body</p>
                    <pre className="text-stone-300 text-sm whitespace-pre-wrap font-sans bg-stone-800 px-4 py-4 rounded-xl border border-stone-700 leading-relaxed">
                      {emailDraft.body}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>

            {emailDraft && !emailLoading && (
              <div className="px-6 py-4 border-t border-stone-800 flex justify-end">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-stone-950 text-sm font-semibold hover:bg-emerald-400 transition-colors"
                >
                  <Copy size={14} />
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}