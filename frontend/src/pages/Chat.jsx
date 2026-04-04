import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { askQuestion, listTranscripts, startSession } from "../api/client";
import { Send, Bot, User, Plus, FileText, ArrowLeft, Loader } from "lucide-react";

export default function Chat() {
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(urlSessionId || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    listTranscripts().then((res) => setTranscripts(res.data.transcripts || res.data || []))
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleStartSession = async () => {
    if (!selectedIds.length) return;
    setStarting(true);
    setError(null);
    try {
      const res = await startSession(selectedIds);
      setSessionId(res.data.session_id);
      navigate(`/chat/${res.data.session_id}`, { replace: true });
      setMessages([{
        role: "assistant",
        content: `Session started. I have access to ${selectedIds.length} transcript(s). Ask me anything about the meetings — decisions made, action items, what specific people said, or anything else you'd like to know.`,
      }]);
    } catch {
      setError("Failed to start session.");
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || loading) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await askQuestion(sessionId, question);
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTranscript = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Session setup screen
  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-stone-400 hover:text-stone-200 text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-100 tracking-tight mb-2">
            Start a Chat Session
          </h1>
          <p className="text-stone-400 text-sm">
            Select one or more transcripts to chat with.
          </p>
        </div>

        {transcripts.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No transcripts available. Upload some first.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              {transcripts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTranscript(t.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    selectedIds.includes(t.id)
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-stone-800 bg-stone-900 hover:border-stone-700"
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                    selectedIds.includes(t.id)
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-stone-600"
                  }`}>
                    {selectedIds.includes(t.id) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-200 truncate">{t.filename}</p>
                    <p className="text-xs text-stone-500">{t.word_count} words · {t.speakers?.join(", ") || "No speakers detected"}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            <button
              onClick={handleStartSession}
              disabled={!selectedIds.length || starting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-stone-950 font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={15} />
              {starting ? "Starting..." : `Start Chat${selectedIds.length ? ` (${selectedIds.length} transcript${selectedIds.length > 1 ? "s" : ""})` : ""}`}
            </button>
          </>
        )}
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === "user" ? "bg-emerald-500/20" : "bg-stone-800"
              }`}>
                {msg.role === "user"
                  ? <User size={14} className="text-emerald-400" />
                  : <Bot size={14} className="text-stone-400" />
                }
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-stone-200 rounded-tr-sm"
                  : "bg-stone-900 border border-stone-800 text-stone-300 rounded-tl-sm"
              }`}>
                {msg.content.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < msg.content.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-800 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-stone-400" />
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader size={14} className="text-stone-500 animate-spin" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-stone-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask anything about the meeting..."
            className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={15} className="text-stone-950" />
          </button>
        </div>
        <p className="text-center text-xs text-stone-600 mt-2">
          Session ID: {sessionId?.slice(0, 8)}...
        </p>
      </div>
    </div>
  );
}
