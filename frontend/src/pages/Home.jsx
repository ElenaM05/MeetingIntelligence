import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { uploadTranscripts, listTranscripts, deleteTranscript, extractTranscripts } from "../api/client";
import { Upload, FileText, Trash2, Zap, AlertCircle, CheckCircle, Clock, Users, MessageSquare } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [transcripts, setTranscripts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState({});
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTranscripts = useCallback(async () => {
    try {
      const res = await listTranscripts();
      setTranscripts(res.data.transcripts || res.data || []);
    } catch {
      setError("Failed to load transcripts.");
    }
  }, []);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  const handleFiles = async (files) => {
    const valid = Array.from(files).filter((f) =>
      f.name.endsWith(".txt") || f.name.endsWith(".vtt")
    );
    if (!valid.length) {
      showToast("Only .txt and .vtt files are supported.", "error");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadTranscripts(valid);
      const { uploaded, errors } = res.data;
      if (uploaded.length) showToast(`Uploaded ${uploaded.length} file(s) successfully.`);
      if (errors.length) showToast(`${errors.length} file(s) failed to upload.`, "error");
      await loadTranscripts();
    } catch {
      setError("Upload failed. Make sure the backend is running.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleExtract = async (id) => {
    setExtracting((prev) => ({ ...prev, [id]: true }));
    try {
      await extractTranscripts([id]);
      showToast("Extraction complete.");
      navigate(`/results/${id}`);
    } catch {
      showToast("Extraction failed.", "error");
    } finally {
      setExtracting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTranscript(id);
      showToast("Transcript deleted.");
      await loadTranscripts();
    } catch {
      showToast("Failed to delete.", "error");
    }
  };

  const handleChat = async (id) => {
    try {
      const { startSession } = await import("../api/client");
      const res = await startSession([id]);
      navigate(`/chat/${res.data.session_id}`);
    } catch {
      showToast("Failed to start chat session.", "error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl transition-all ${
          toast.type === "error" ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
        }`}>
          {toast.type === "error" ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-stone-100 tracking-tight mb-2">
          Meeting Transcripts
        </h1>
        <p className="text-stone-400 text-sm">
          Upload .txt or .vtt transcript files to extract decisions, action items, and insights.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => document.getElementById("file-input").click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-8 ${
          dragOver
            ? "border-emerald-500 bg-emerald-500/5"
            : "border-stone-700 hover:border-stone-500 hover:bg-stone-900/50"
        }`}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".txt,.vtt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
          dragOver ? "bg-emerald-500/20" : "bg-stone-800"
        }`}>
          <Upload size={24} className={dragOver ? "text-emerald-400" : "text-stone-400"} />
        </div>
        {uploading ? (
          <p className="text-stone-300 font-medium">Uploading...</p>
        ) : (
          <>
            <p className="text-stone-300 font-medium mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-stone-500 text-sm">.txt and .vtt files supported</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Transcript List */}
      {transcripts.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No transcripts yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
            {transcripts.length} Transcript{transcripts.length !== 1 ? "s" : ""}
          </h2>
          {transcripts.map((t) => (
            <div
              key={t.id}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-stone-700 transition-colors group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-stone-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-stone-200 truncate">{t.filename}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-stone-500 flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(t.uploaded_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-stone-500">{t.word_count} words</span>
                    {t.speakers?.length > 0 && (
                      <span className="text-xs text-stone-500 flex items-center gap-1">
                        <Users size={11} />
                        {t.speakers.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleChat(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  <MessageSquare size={13} />
                  Chat
                </button>
                <button
                  onClick={() => navigate(`/results/${t.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  View
                </button>
                <button
                  onClick={() => handleExtract(t.id)}
                  disabled={extracting[t.id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  <Zap size={13} />
                  {extracting[t.id] ? "Extracting..." : "Extract"}
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
