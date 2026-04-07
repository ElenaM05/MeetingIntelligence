import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Zap, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Users, Activity } from "lucide-react";
import { getExtractionResult } from "../api/client";
import api from "../api/client";

// ─── API helpers ────────────────────────────────────────────────────────────
const getSentiment = (transcriptId) => api.get(`/sentiment/${transcriptId}`);
const clearSentiment = (transcriptId) => api.delete(`/sentiment/${transcriptId}`);

// ─── Sentiment config ────────────────────────────────────────────────────────
const SENTIMENT_CONFIG = {
  enthusiasm:  { color: "#10b981", bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", emoji: "🚀", label: "Enthusiasm" },
  agreement:   { color: "#3b82f6", bg: "bg-blue-500/15",    border: "border-blue-500/30",    text: "text-blue-400",    emoji: "🤝", label: "Agreement"  },
  neutral:     { color: "#78716c", bg: "bg-stone-500/15",   border: "border-stone-500/30",   text: "text-stone-400",   emoji: "😐", label: "Neutral"    },
  uncertainty: { color: "#f59e0b", bg: "bg-amber-500/15",   border: "border-amber-500/30",   text: "text-amber-400",   emoji: "🤔", label: "Uncertainty"},
  frustration: { color: "#f97316", bg: "bg-orange-500/15",  border: "border-orange-500/30",  text: "text-orange-400",  emoji: "😤", label: "Frustration"},
  conflict:    { color: "#ef4444", bg: "bg-red-500/15",     border: "border-red-500/30",     text: "text-red-400",     emoji: "⚡", label: "Conflict"   },
};

const VIBE_CONFIG = {
  positive: { color: "#10b981", label: "Positive",  icon: TrendingUp   },
  negative: { color: "#ef4444", label: "Negative",  icon: TrendingDown },
  neutral:  { color: "#78716c", label: "Neutral",   icon: Minus        },
  mixed:    { color: "#f59e0b", label: "Mixed",     icon: Activity     },
};

const getSentimentConfig = (s) => SENTIMENT_CONFIG[s] || SENTIMENT_CONFIG.neutral;
const scoreToPercent = (score) => Math.round(((score + 1) / 2) * 100);

// ─── Sub-components ──────────────────────────────────────────────────────────

function OverallVibeCard({ data }) {
  const cfg = VIBE_CONFIG[data.overall_vibe] || VIBE_CONFIG.neutral;
  const Icon = cfg.icon;
  const pct = scoreToPercent(data.overall_score);

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 flex items-center gap-6">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: cfg.color + "22", border: `1.5px solid ${cfg.color}44` }}
      >
        <Icon size={32} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Overall Meeting Vibe</p>
        <div className="flex items-baseline gap-3 mb-2">
          <h2 className="text-2xl font-bold text-stone-100" style={{ color: cfg.color }}>
            {cfg.label}
          </h2>
          <span className="text-sm text-stone-500">{pct}% positive energy</span>
        </div>
        <p className="text-stone-400 text-sm leading-relaxed">{data.summary}</p>
      </div>
    </div>
  );
}

function EmotionArcChart({ arc }) {
  const W = 800, H = 120, PAD = { t: 16, b: 28, l: 8, r: 8 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const points = arc.map((p) => {
    const x = PAD.l + p.position * innerW;
    const y = PAD.t + ((1 - (p.score + 1) / 2)) * innerH;
    return { x, y, label: p.label, score: p.score };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
  }, "");

  const fillD = points.length
    ? `${pathD} L ${points[points.length - 1].x} ${PAD.t + innerH} L ${points[0].x} ${PAD.t + innerH} Z`
    : "";

  const midY = PAD.t + innerH / 2;

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
      <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-4">Emotion Arc</p>
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
          <defs>
            <linearGradient id="arcFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1={PAD.l} y1={midY} x2={W - PAD.r} y2={midY}
            stroke="#44403c" strokeWidth="1" strokeDasharray="4 4" />
          {fillD && <path d={fillD} fill="url(#arcFill)" />}
          {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="#0a0a0a" strokeWidth="2" />
              <text x={p.x} y={H - 4} textAnchor="middle" fontSize="8" fill="#57534e"
                style={{ fontFamily: "monospace" }}>
                {p.label?.slice(0, 8)}
              </text>
            </g>
          ))}
          <text x={PAD.l} y={PAD.t + 8} fontSize="8" fill="#57534e">positive</text>
          <text x={PAD.l} y={PAD.t + innerH} fontSize="8" fill="#57534e">negative</text>
        </svg>
      </div>
    </div>
  );
}

function SegmentTimeline({ segments, onSelect, selectedId }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
      <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-4">
        Meeting Timeline
      </p>
      <div className="flex rounded-lg overflow-hidden h-3 mb-4 gap-0.5">
        {segments.map((seg) => {
          const cfg = getSentimentConfig(seg.sentiment);
          return (
            <div
              key={seg.id}
              className="flex-1 cursor-pointer transition-opacity hover:opacity-80"
              style={{ backgroundColor: cfg.color }}
              onClick={() => onSelect(seg.id === selectedId ? null : seg.id)}
              title={seg.label}
            />
          );
        })}
      </div>
      <div className="space-y-2">
        {segments.map((seg) => {
          const cfg = getSentimentConfig(seg.sentiment);
          const isSelected = seg.id === selectedId;
          return (
            <div
              key={seg.id}
              onClick={() => onSelect(seg.id === selectedId ? null : seg.id)}
              className={`rounded-xl border cursor-pointer transition-all ${cfg.bg} ${cfg.border} ${
                isSelected ? "ring-1 ring-offset-0" : "hover:opacity-90"
              }`}
              style={isSelected ? { ringColor: cfg.color } : {}}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-xs text-stone-600">{seg.label}</span>
                  </div>
                  <p className="text-sm text-stone-300 truncate">{seg.summary}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(seg.intensity * 100)}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                  {isSelected ? <ChevronUp size={14} className="text-stone-500" /> : <ChevronDown size={14} className="text-stone-500" />}
                </div>
              </div>
              {isSelected && seg.transcript_excerpt && (
                <div className="px-4 pb-4">
                  <div className="border-t border-stone-700/50 pt-3 mt-1">
                    <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-2">
                      Transcript Excerpt
                    </p>
                    <blockquote className="text-sm text-stone-300 leading-relaxed italic border-l-2 pl-3"
                      style={{ borderColor: cfg.color }}>
                      "{seg.transcript_excerpt}"
                    </blockquote>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeakerCard({ speaker }) {
  const cfg = getSentimentConfig(speaker.overall_sentiment);
  const pct = scoreToPercent(speaker.score);

  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: cfg.color + "33", color: cfg.color }}
        >
          {speaker.name?.[0] || "?"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-200 truncate">{speaker.name}</p>
          <p className={`text-xs ${cfg.text}`}>{cfg.emoji} {cfg.label}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-stone-500 mb-1">
          <span>Sentiment</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: cfg.color }}
          />
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-stone-500 mb-1">
          <span>Speaking share</span>
          <span>{Math.round(speaker.dominance * 100)}%</span>
        </div>
        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-stone-500 transition-all duration-700"
            style={{ width: `${Math.round(speaker.dominance * 100)}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-stone-400 italic mb-3">"{speaker.key_trait}"</p>

      {speaker.moments?.length > 0 && (
        <div className="space-y-1.5">
          {speaker.moments.slice(0, 2).map((m, i) => {
            const mc = getSentimentConfig(m.sentiment);
            return (
              <div key={i} className={`rounded-lg px-3 py-2 border ${mc.bg} ${mc.border}`}>
                <span className="text-xs mr-1">{mc.emoji}</span>
                <span className="text-xs text-stone-300 italic">"{m.quote}"</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HighlightsPanel({ highlights }) {
  const items = [
    { label: "Most Positive", icon: "🌟", value: highlights.most_positive_moment },
    { label: "Most Tense",    icon: "⚡", value: highlights.most_tense_moment },
    { label: "Turning Point", icon: "🔄", value: highlights.turning_point },
  ].filter((h) => h.value);

  if (!items.length) return null;

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
      <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-4">Key Moments</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="bg-stone-800/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span>{item.icon}</span>
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{item.label}</span>
            </div>
            <p className="text-sm text-stone-300 leading-relaxed">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VibeDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [filename, setFilename] = useState("");

  // Use a ref to trigger re-analysis without adding callbacks to deps
  const forceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (forceRef.current) {
          await clearSentiment(id);
          forceRef.current = false;
        }
        const res = await getSentiment(id);
        if (cancelled) return;
        setData(res.data);
        setFilename(res.data.source_filename || id);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || "Failed to load sentiment analysis.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReanalyzing(false);
        }
      }
    };

    // Also fetch filename from extraction result
    getExtractionResult(id)
      .then((r) => { if (!cancelled) setFilename(r.data?.source_filename || ""); })
      .catch(() => {});

    load();
    return () => { cancelled = true; };
  }, [id, reanalyzing]); // reanalyzing in deps so effect re-runs when user clicks Re-analyze

  const handleReanalyze = useCallback(() => {
    forceRef.current = true;
    setReanalyzing(true);
    setError(null);
  }, []);

  if (loading || reanalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-stone-500">
        <Loader2 size={24} className="animate-spin text-emerald-500" />
        <p className="text-sm">{reanalyzing ? "Re-analyzing meeting vibe..." : "Analyzing meeting sentiment..."}</p>
        <p className="text-xs text-stone-600">This may take a few seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <button onClick={() => navigate(`/results/${id}`)}
          className="flex items-center gap-2 text-stone-400 hover:text-stone-200 text-sm mb-8 transition-colors">
          <ArrowLeft size={15} /> Back to results
        </button>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-10 text-center">
          <p className="text-stone-400 mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); handleReanalyze(); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-stone-950 font-semibold text-sm hover:bg-emerald-400 transition-colors mx-auto"
          >
            <Zap size={15} /> Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <button onClick={() => navigate(`/results/${id}`)}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-200 text-sm mb-8 transition-colors">
        <ArrowLeft size={15} /> Back to results
      </button>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 tracking-tight mb-1">
            Meeting Vibe
          </h1>
          <p className="text-stone-500 text-sm">{filename}</p>
        </div>
        <button
          onClick={handleReanalyze}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-700 text-stone-400 text-sm hover:bg-stone-800 hover:text-stone-200 transition-colors flex-shrink-0"
        >
          <RefreshCw size={13} />
          Re-analyze
        </button>
      </div>

      <div className="space-y-5">
        <OverallVibeCard data={data} />

        {data.highlights && <HighlightsPanel highlights={data.highlights} />}

        {data.emotion_arc?.length > 0 && <EmotionArcChart arc={data.emotion_arc} />}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            {data.segments?.length > 0 && (
              <SegmentTimeline
                segments={data.segments}
                onSelect={setSelectedSegment}
                selectedId={selectedSegment}
              />
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 h-full">
              <div className="flex items-center gap-2 mb-4">
                <Users size={14} className="text-stone-500" />
                <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">
                  Speaker Breakdown
                </p>
              </div>
              <div className="space-y-4">
                {data.speakers?.map((speaker) => (
                  <SpeakerCard key={speaker.name} speaker={speaker} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}