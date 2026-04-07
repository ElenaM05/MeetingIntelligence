import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, CheckSquare, Zap, Trash2, ChevronRight,
  Loader2, TrendingUp, TrendingDown, Minus, Activity,
  FolderOpen, LayoutGrid, List, Search, Plus, X, Pencil, Check
} from "lucide-react";
import {
  listTranscripts, uploadTranscripts, deleteTranscript,
  getExtractionResult, extractTranscripts
} from "../api/client";
import api from "../api/client";

const getSentiment  = (id) => api.get(`/sentiment/${id}`).catch(() => null);
const renameProject = (oldName, newName) => api.patch(`/transcripts/project/rename`, { old_name: oldName, new_name: newName });
const deleteProject = (name) => api.delete(`/transcripts/project/${encodeURIComponent(name)}`);

const VIBE_CFG = {
  positive: { color: "#10b981", label: "Positive",  Icon: TrendingUp,   pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  negative: { color: "#ef4444", label: "Negative",  Icon: TrendingDown, pill: "bg-red-500/10 text-red-400 border-red-500/20" },
  neutral:  { color: "#78716c", label: "Neutral",   Icon: Minus,        pill: "bg-stone-500/10 text-stone-400 border-stone-600/30" },
  mixed:    { color: "#f59e0b", label: "Mixed",     Icon: Activity,     pill: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};
const getVibe = (v) => VIBE_CFG[v] || VIBE_CFG.neutral;

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const scoreToPercent = (s) => Math.round(((s + 1) / 2) * 100);

// ─── Global upload zone ───────────────────────────────────────────────────────
function UploadZone({ onUploaded }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [project, setProject]     = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef();

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      await uploadTranscripts(Array.from(files), project.trim() || "default");
      setProject(""); setShowInput(false);
      onUploaded();
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
        dragging ? "border-emerald-500 bg-emerald-500/5" : "border-stone-700 hover:border-stone-500 hover:bg-stone-900/50"
      }`}
    >
      <input ref={inputRef} type="file" multiple accept=".txt,.vtt,.srt,.md" className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={24} className="animate-spin text-emerald-500" />
          <p className="text-sm text-stone-400">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center">
            <Upload size={20} className="text-stone-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-300">Drop transcripts here</p>
            <p className="text-xs text-stone-600 mt-0.5">.txt, .vtt · click to browse</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowInput((p) => !p); }}
            className="text-xs text-stone-500 hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Plus size={11} /> {showInput ? "Hide" : "Set project name"}
          </button>
          {showInput && (
            <input autoFocus onClick={(e) => e.stopPropagation()}
              value={project} onChange={(e) => setProject(e.target.value)}
              placeholder="Project name (default)"
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-500 w-48" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline upload panel inside a project card ────────────────────────────────
function ProjectUploadPanel({ project, onUploaded, onClose }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      await uploadTranscripts(Array.from(files), project);
      onUploaded();
      onClose();
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  return (
    <div className="mt-3 border-t border-stone-800 pt-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          dragging ? "border-emerald-500 bg-emerald-500/5" : "border-stone-700 hover:border-stone-600"
        }`}
      >
        <input ref={inputRef} type="file" multiple accept=".txt,.vtt,.srt,.md" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-stone-400 text-xs">
            <Loader2 size={13} className="animate-spin text-emerald-500" /> Uploading to "{project}"...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-stone-500 text-xs">
            <Upload size={13} /> Drop files or click to add to "{project}"
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transcript row ───────────────────────────────────────────────────────────
function TranscriptRow({ transcript, onDelete, onExtract, extracting }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${transcript.filename}"?`)) return;
    setDeleting(true);
    try { await deleteTranscript(transcript.id); onDelete(transcript.id); }
    catch { setDeleting(false); }
  };

  return (
    <div onClick={() => navigate(`/results/${transcript.id}`)}
      className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-stone-800/50 cursor-pointer transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0">
        <FileText size={13} className="text-stone-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-300 truncate font-medium">{transcript.filename}</p>
        <p className="text-xs text-stone-600">{fmt(transcript.uploaded_at)}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onExtract(transcript.id); }} disabled={extracting}
          className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-500 hover:text-emerald-400 transition-colors" title="Extract">
          {extracting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-500 hover:text-red-400 transition-colors" title="Delete">
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
      <ChevronRight size={14} className="text-stone-700 group-hover:text-stone-500 transition-colors flex-shrink-0" />
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, transcripts, extractions, sentiments, onDelete, onDeleteProject, onRenameProject, onRefresh, view }) {
  const navigate = useNavigate();
  const [expanded, setExpanded]           = useState(false);
  const [extractingId, setExtractingId]   = useState(null);
  const [showUpload, setShowUpload]       = useState(false);
  const [renaming, setRenaming]           = useState(false);
  const [renameVal, setRenameVal]         = useState(project);
  const [renameBusy, setRenameBusy]       = useState(false);
  const [deletingProj, setDeletingProj]   = useState(false);
  const renameRef = useRef();

  useEffect(() => { if (renaming) renameRef.current?.focus(); }, [renaming]);

  const stats = (() => {
    let totalActions = 0, openActions = 0, sentScores = [];
    transcripts.forEach((t) => {
      const ex = extractions[t.id];
      if (ex) { totalActions += ex.action_items?.length || 0; openActions += ex.action_items?.filter((a) => a.status !== "complete").length || 0; }
      const sent = sentiments[t.id];
      if (sent?.overall_score != null) sentScores.push(sent.overall_score);
    });
    const avgSentiment = sentScores.length ? sentScores.reduce((a, b) => a + b, 0) / sentScores.length : null;
    const vibe = avgSentiment == null ? null : avgSentiment > 0.3 ? "positive" : avgSentiment < -0.2 ? "negative" : Math.abs(avgSentiment) < 0.1 ? "neutral" : "mixed";
    return { totalActions, openActions, avgSentiment, vibe, analyzed: sentScores.length };
  })();

  const handleExtract = async (id) => {
    setExtractingId(id);
    try { await extractTranscripts([id]); onRefresh(); } catch {} finally { setExtractingId(null); }
  };

  const handleRename = async () => {
    const newName = renameVal.trim();
    if (!newName || newName === project) { setRenaming(false); return; }
    setRenameBusy(true);
    try { await renameProject(project, newName); onRenameProject(project, newName); setRenaming(false); }
    catch { setRenameVal(project); setRenaming(false); }
    finally { setRenameBusy(false); }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`Delete project "${project}" and all ${transcripts.length} transcript(s)? This cannot be undone.`)) return;
    setDeletingProj(true);
    try { await deleteProject(project); onDeleteProject(project); }
    catch { setDeletingProj(false); }
  };

  const vCfg    = stats.vibe ? getVibe(stats.vibe) : null;
  const VibeIcon = vCfg?.Icon;
  const pct     = stats.avgSentiment != null ? scoreToPercent(stats.avgSentiment) : null;

  // Shared edit controls (upload / rename / delete project)
  const editControls = (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => { setShowUpload((p) => !p); setExpanded(true); }}
        className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-500 hover:text-emerald-400 transition-colors" title="Add transcript">
        <Upload size={13} />
      </button>

      {renaming ? (
        <>
          <input ref={renameRef} value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setRenaming(false); setRenameVal(project); } }}
            className="bg-stone-800 border border-stone-600 rounded-lg px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-emerald-500 w-28 mx-1" />
          <button onClick={handleRename} disabled={renameBusy}
            className="p-1.5 rounded-lg hover:bg-stone-700 text-emerald-400 transition-colors">
            {renameBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button onClick={() => { setRenaming(false); setRenameVal(project); }}
            className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-500 transition-colors">
            <X size={12} />
          </button>
        </>
      ) : (
        <button onClick={() => setRenaming(true)}
          className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-500 hover:text-stone-300 transition-colors" title="Rename project">
          <Pencil size={13} />
        </button>
      )}

      <button onClick={handleDeleteProject} disabled={deletingProj}
        className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-500 hover:text-red-400 transition-colors" title="Delete project">
        {deletingProj ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );

  // ── LIST view ───────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-stone-800/30 transition-colors"
          onClick={() => setExpanded((p) => !p)}>
          <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={15} className="text-stone-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-200 capitalize">{project}</p>
            <p className="text-xs text-stone-600">{transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-500">
            <span>{stats.totalActions} actions</span>
            {stats.openActions > 0 && <span className="text-amber-400">{stats.openActions} open</span>}
            {vCfg && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${vCfg.pill}`}>
                <VibeIcon size={10} /> {vCfg.label}
              </span>
            )}
          </div>
          {editControls}
          <ChevronRight size={14} className={`text-stone-600 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`} />
        </div>
        {expanded && (
          <div className="border-t border-stone-800 px-2 py-2">
            {transcripts.map((t) => (
              <TranscriptRow key={t.id} transcript={t} onDelete={onDelete}
                onExtract={handleExtract} extracting={extractingId === t.id} />
            ))}
            {showUpload && <ProjectUploadPanel project={project} onUploaded={onRefresh} onClose={() => setShowUpload(false)} />}
          </div>
        )}
      </div>
    );
  }

  // ── GRID view ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden flex flex-col hover:border-stone-700 transition-colors">
      <div className="h-1 w-full" style={{ backgroundColor: vCfg?.color || "#292524" }} />
      <div className="p-5 flex-1 flex flex-col">

        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0">
              <FolderOpen size={15} className="text-stone-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-200 capitalize leading-tight">{project}</h3>
              <p className="text-xs text-stone-600">{transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {vCfg && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs flex-shrink-0 ${vCfg.pill}`}>
              <VibeIcon size={10} /> {vCfg.label}
            </span>
          )}
        </div>

        {/* Edit controls */}
        <div className="mb-4">{editControls}</div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-stone-800/50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-stone-600 mb-0.5">Action Items</p>
            <p className="text-xl font-bold text-stone-100">{stats.totalActions}</p>
            {stats.openActions > 0 && <p className="text-xs text-amber-400">{stats.openActions} open</p>}
          </div>
          <div className="bg-stone-800/50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-stone-600 mb-0.5">Sentiment</p>
            {pct != null ? (
              <>
                <p className="text-xl font-bold" style={{ color: vCfg?.color || "#78716c" }}>{pct}%</p>
                <div className="mt-1 h-1 bg-stone-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: vCfg?.color }} />
                </div>
              </>
            ) : <p className="text-xs text-stone-600 mt-1">Not analyzed</p>}
          </div>
        </div>

        {/* Transcript preview */}
        <div className="flex-1 space-y-1 mb-4">
          {transcripts.slice(0, 3).map((t) => (
            <div key={t.id} onClick={() => navigate(`/results/${t.id}`)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-800 cursor-pointer transition-colors group">
              <FileText size={11} className="text-stone-600 flex-shrink-0" />
              <span className="text-xs text-stone-400 truncate group-hover:text-stone-200 transition-colors">{t.filename}</span>
            </div>
          ))}
          {transcripts.length > 3 && <p className="text-xs text-stone-600 pl-2">+{transcripts.length - 3} more</p>}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-2 pt-3 border-t border-stone-800">
          <button onClick={() => setExpanded((p) => !p)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-400 border border-stone-700 hover:bg-stone-800 hover:text-stone-200 transition-colors">
            <List size={12} /> {expanded ? "Hide" : "View all"}
          </button>
          <button onClick={() => navigate(`/dashboard`)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500 text-stone-950 font-semibold hover:bg-emerald-400 transition-colors">
            <CheckSquare size={12} /> Tasks
          </button>
        </div>

        {/* Expanded transcript list */}
        {expanded && (
          <div className="mt-3 border-t border-stone-800 pt-3 space-y-0.5">
            {transcripts.map((t) => (
              <TranscriptRow key={t.id} transcript={t} onDelete={onDelete}
                onExtract={handleExtract} extracting={extractingId === t.id} />
            ))}
            {showUpload && <ProjectUploadPanel project={project} onUploaded={onRefresh} onClose={() => setShowUpload(false)} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Global stats ─────────────────────────────────────────────────────────────
function GlobalStats({ transcripts, extractions, sentiments }) {
  const stats = (() => {
    let actions = 0;
    const scores = [];
    transcripts.forEach((t) => {
      const ex = extractions[t.id];
      if (ex) actions += ex.action_items?.length || 0;
      const sent = sentiments[t.id];
      if (sent?.overall_score != null) scores.push(sent.overall_score);
    });
    const avgSentiment = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { total: transcripts.length, actions, analyzed: scores.length, avgSentiment };
  })();

  const vCfg = stats.avgSentiment != null
    ? getVibe(stats.avgSentiment > 0.3 ? "positive" : stats.avgSentiment < -0.2 ? "negative" : "neutral")
    : null;

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {[
        { label: "Total Transcripts", value: stats.total,   icon: FileText,    color: "text-stone-400" },
        { label: "Action Items",      value: stats.actions, icon: CheckSquare, color: "text-emerald-400" },
        {
          label: "Avg. Sentiment",
          value: stats.avgSentiment != null ? `${scoreToPercent(stats.avgSentiment)}%` : "—",
          sub: stats.analyzed ? `${stats.analyzed} analyzed` : "No analysis yet",
          icon: vCfg?.Icon || Activity,
          color: vCfg ? "" : "text-stone-400",
          iconColor: vCfg?.color,
        },
      ].map(({ label, value, sub, icon: Icon, color, iconColor }) => (
        <div key={label} className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={15} className={color} style={iconColor ? { color: iconColor } : {}} />
            <span className="text-xs text-stone-500 font-medium uppercase tracking-widest">{label}</span>
          </div>
          <p className="text-3xl font-bold text-stone-100">{value}</p>
          {sub && <p className="text-xs text-stone-600 mt-1">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [transcripts, setTranscripts] = useState([]);
  const [extractions, setExtractions] = useState({});
  const [sentiments, setSentiments]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [view, setView]               = useState("grid");
  const [tick, setTick]               = useState(0);

  const refresh = useCallback(() => setTick((p) => p + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await listTranscripts();
        const txs = res.data?.transcripts || [];
        if (cancelled) return;
        setTranscripts(txs);
        if (!txs.length) return;

        const [exResults, sentResults] = await Promise.all([
          Promise.allSettled(txs.map((t) => getExtractionResult(t.id))),
          Promise.allSettled(txs.map((t) => getSentiment(t.id))),
        ]);
        if (cancelled) return;

        const extMap = {}, sentMap = {};
        txs.forEach((t, i) => {
          if (exResults[i].status === "fulfilled" && exResults[i].value?.data) extMap[t.id] = exResults[i].value.data;
          if (sentResults[i].status === "fulfilled" && sentResults[i].value?.data) sentMap[t.id] = sentResults[i].value.data;
        });
        setExtractions(extMap);
        setSentiments(sentMap);
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [tick]);

  const handleDelete = useCallback((id) => {
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
    setExtractions((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setSentiments((prev)  => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const handleDeleteProject = useCallback((projectName) => {
    setTranscripts((prev) => {
      const toRemove = prev.filter((t) => (t.project || "default") === projectName);
      setExtractions((e) => { const n = { ...e }; toRemove.forEach((t) => delete n[t.id]); return n; });
      setSentiments((s)  => { const n = { ...s }; toRemove.forEach((t) => delete n[t.id]); return n; });
      return prev.filter((t) => (t.project || "default") !== projectName);
    });
  }, []);

  const handleRenameProject = useCallback((oldName, newName) => {
    setTranscripts((prev) =>
      prev.map((t) => (t.project || "default") === oldName ? { ...t, project: newName } : t)
    );
  }, []);

  const grouped = transcripts
    .filter((t) => !search ||
      t.filename.toLowerCase().includes(search.toLowerCase()) ||
      (t.project || "default").toLowerCase().includes(search.toLowerCase()))
    .reduce((acc, t) => {
      const p = t.project || "default";
      if (!acc[p]) acc[p] = [];
      acc[p].push(t);
      return acc;
    }, {});

  const projects = Object.entries(grouped).sort((a, b) => {
    const latestA = Math.max(...a[1].map((t) => new Date(t.uploaded_at)));
    const latestB = Math.max(...b[1].map((t) => new Date(t.uploaded_at)));
    return latestB - latestA;
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 tracking-tight mb-1">Meeting Intelligence Hub</h1>
          <p className="text-stone-500 text-sm">
            {transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""} across {Object.keys(grouped).length || 0} project{Object.keys(grouped).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..."
              className="bg-stone-900 border border-stone-800 rounded-xl pl-8 pr-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-600 w-44 transition-colors" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex bg-stone-900 border border-stone-800 rounded-xl p-1 gap-0.5">
            <button onClick={() => setView("grid")}
              className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-stone-700 text-stone-100" : "text-stone-500 hover:text-stone-300"}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setView("list")}
              className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-stone-700 text-stone-100" : "text-stone-500 hover:text-stone-300"}`}>
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {!loading && transcripts.length > 0 && (
        <GlobalStats transcripts={transcripts} extractions={extractions} sentiments={sentiments} />
      )}

      <div className="mb-8"><UploadZone onUploaded={refresh} /></div>

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-2 text-stone-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={20} className="text-stone-600" />
          </div>
          {search ? (
            <>
              <p className="text-stone-400 mb-1">No projects match "{search}"</p>
              <button onClick={() => setSearch("")} className="text-xs text-stone-600 hover:text-stone-400 transition-colors">Clear search</button>
            </>
          ) : (
            <>
              <p className="text-stone-400 mb-1">No transcripts yet</p>
              <p className="text-stone-600 text-sm">Upload a transcript above to get started</p>
            </>
          )}
        </div>
      ) : (
        <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {projects.map(([project, txs]) => (
            <ProjectCard
              key={project}
              project={project}
              transcripts={txs}
              extractions={extractions}
              sentiments={sentiments}
              onDelete={handleDelete}
              onDeleteProject={handleDeleteProject}
              onRenameProject={handleRenameProject}
              onRefresh={refresh}
              view={view}
            />
          ))}
        </div>
      )}
    </div>
  );
}