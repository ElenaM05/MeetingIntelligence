import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare, Clock, AlertCircle, Filter,
  ChevronRight, Check, ArrowLeft, Loader2, BarChart2,
  Calendar, Zap, Circle
} from "lucide-react";
import { listTranscripts, getExtractionResult, updateActionItemStatus } from "../api/client";

const PRIORITY_STYLES = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const STATUS_OPTIONS = ["all", "pending", "complete", "overdue"];
const PRIORITY_OPTIONS = ["all", "high", "medium", "low"];

const isOverdue = (byWhen, status) => {
  if (!byWhen || status === "complete") return false;
  const due = new Date(byWhen);
  return !isNaN(due) && due < new Date();
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadAll = async () => {
      try {
        const transcriptsRes = await listTranscripts();
        const transcripts = transcriptsRes.data?.transcripts || [];


        const results = await Promise.allSettled(
          transcripts.map((t) => getExtractionResult(t.id))
        );

        const items = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value?.data?.action_items) {
            const transcript = transcripts[i];
            r.value.data.action_items.forEach((item) => {
              items.push({
                ...item,
                transcriptId: transcript.id,
                transcriptName: transcript.filename || transcript.id,
                effectiveStatus: isOverdue(item.by_when, item.status)
                  ? "overdue"
                  : item.status || "pending",
              });
            });
          }
        });

        setAllItems(items);
      } catch (e) {
        setError("Failed to load action items.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const owners = useMemo(() => {
    const set = new Set(allItems.map((i) => i.who).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      if (statusFilter !== "all" && item.effectiveStatus !== statusFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (ownerFilter !== "all" && item.who !== ownerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.what?.toLowerCase().includes(q) &&
          !item.who?.toLowerCase().includes(q) &&
          !item.transcriptName?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allItems, statusFilter, priorityFilter, ownerFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const total = allItems.length;
    const complete = allItems.filter((i) => i.status === "complete").length;
    const overdue = allItems.filter((i) => isOverdue(i.by_when, i.status)).length;
    const pending = allItems.filter(
      (i) => i.status !== "complete" && !isOverdue(i.by_when, i.status)
    ).length;
    const completionRate = total ? Math.round((complete / total) * 100) : 0;
    return { total, complete, overdue, pending, completionRate };
  }, [allItems]);

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === "complete" ? "pending" : "complete";
    setUpdatingStatus(item.id + item.transcriptId);
    try {
      await updateActionItemStatus(item.transcriptId, item.id, newStatus);
      setAllItems((prev) =>
        prev.map((a) =>
          a.id === item.id && a.transcriptId === item.transcriptId
            ? {
                ...a,
                status: newStatus,
                effectiveStatus: isOverdue(a.by_when, newStatus)
                  ? "overdue"
                  : newStatus,
              }
            : a
        )
      );
    } catch {
      // silently fail
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-stone-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading action items...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Back */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-200 text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to transcripts
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-100 tracking-tight mb-1">
          Action Item Tracker
        </h1>
        <p className="text-stone-400 text-sm">
          All open tasks across every meeting, in one place.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Items",
            value: stats.total,
            icon: CheckSquare,
            color: "text-stone-400",
          },
          {
            label: "Pending",
            value: stats.pending,
            icon: Clock,
            color: "text-blue-400",
          },
          {
            label: "Overdue",
            value: stats.overdue,
            icon: AlertCircle,
            color: "text-red-400",
          },
          {
            label: "Complete",
            value: `${stats.completionRate}%`,
            icon: BarChart2,
            color: "text-emerald-400",
            sub: `${stats.complete} of ${stats.total}`,
          },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div
            key={label}
            className="bg-stone-900 border border-stone-800 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={15} className={color} />
              <span className="text-xs text-stone-500 font-medium uppercase tracking-widest">
                {label}
              </span>
            </div>
            <p className="text-3xl font-bold text-stone-100">{value}</p>
            {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Completion bar */}
      {stats.total > 0 && (
        <div className="mb-6">
          <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 mb-6 space-y-4">
        {/* Row 1: search + count + clear */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks or owners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl pl-8 pr-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-500 transition-colors"
            />
          </div>
          <span className="text-xs text-stone-600 ml-auto">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </span>
          {(statusFilter !== "all" || priorityFilter !== "all" || ownerFilter !== "all" || search) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setOwnerFilter("all");
                setSearch("");
              }}
              className="text-xs text-stone-500 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Row 2: pill filters */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-600 shrink-0">Status</span>
            <div className="flex bg-stone-800/60 rounded-lg p-0.5 gap-0.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                    statusFilter === s
                      ? "bg-stone-600 text-stone-100 shadow-sm"
                      : "text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-stone-800" />

          {/* Priority */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-600 shrink-0">Priority</span>
            <div className="flex bg-stone-800/60 rounded-lg p-0.5 gap-0.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                    priorityFilter === p
                      ? "bg-stone-600 text-stone-100 shadow-sm"
                      : "text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Owner */}
          {owners.length > 2 && (
            <>
              <div className="w-px h-4 bg-stone-800" />
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-600 shrink-0">Owner</span>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="bg-stone-800/60 border border-stone-700/50 rounded-lg px-2.5 py-1.5 text-xs text-stone-300 focus:outline-none focus:border-stone-500 transition-colors"
                >
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o === "all" ? "Everyone" : o}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-12 text-center">
          <Circle size={32} className="mx-auto mb-3 text-stone-700" />
          <p className="text-stone-500 text-sm">No action items match your filters.</p>
        </div>
      ) : (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-800">
                <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                  Task
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                  Owner
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                  Due
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                  Priority
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                  Status
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const isComplete = item.status === "complete";
                const overdue = isOverdue(item.by_when, item.status);
                const isUpdating = updatingStatus === item.id + item.transcriptId;

                return (
                  <tr
                    key={`${item.transcriptId}-${item.id}`}
                    className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${
                      i === filtered.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    {/* Task */}
                    <td
                      className={`px-5 py-4 text-sm max-w-xs transition-colors ${
                        isComplete ? "text-stone-500 line-through" : "text-stone-200"
                      }`}
                    >
                      {item.what}
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-stone-300">
                          {item.who?.[0] || "?"}
                        </div>
                        <span className="text-sm text-stone-300">
                          {item.who || "Unassigned"}
                        </span>
                      </span>
                    </td>

                    {/* Due */}
                    <td className="px-5 py-4">
                      <span
                        className={`flex items-center gap-1.5 text-sm ${
                          overdue ? "text-red-400" : "text-stone-400"
                        }`}
                      >
                        <Calendar size={12} />
                        {item.by_when || "—"}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${
                          PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium
                        }`}
                      >
                        {item.priority || "medium"}
                      </span>
                    </td>

                    {/* Status toggle */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border capitalize transition-colors disabled:opacity-50 ${
                          isComplete
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                            : overdue
                            ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                            : "bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700 hover:text-stone-200"
                        }`}
                      >
                        {isComplete && <Check size={11} />}
                        {isUpdating
                          ? "..."
                          : isComplete
                          ? "complete"
                          : overdue
                          ? "overdue"
                          : item.status || "pending"}
                      </button>
                    </td>

                    {/* Source transcript */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => navigate(`/results/${item.transcriptId}`)}
                        className="flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-400 transition-colors max-w-[140px] truncate"
                        title={item.transcriptName}
                      >
                        <Zap size={10} className="flex-shrink-0" />
                        <span className="truncate">{item.transcriptName}</span>
                        <ChevronRight size={10} className="flex-shrink-0" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}