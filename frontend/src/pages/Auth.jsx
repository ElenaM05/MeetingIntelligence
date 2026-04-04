import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/client";
import { Mic2, AlertCircle } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      let res;
      if (mode === "login") {
        res = await login(form.email, form.password);
      } else {
        if (!form.name.trim()) {
          setError("Name is required.");
          setLoading(false);
          return;
        }
        res = await register(form.email, form.password, form.name);
      }
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Mic2 size={20} className="text-stone-950" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-stone-100">cymonic</span>
        </div>

        {/* Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-stone-100 mb-1">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="text-stone-500 text-sm mb-6">
            {mode === "login"
              ? "Sign in to access your transcripts."
              : "Sign up to get started with cymonic."}
          </p>

          <div className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !form.email || !form.password}
            className="w-full mt-4 py-3 rounded-xl bg-emerald-500 text-stone-950 font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "login" ? "Signing in..." : "Creating account..."
              : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>

        {/* Toggle */}
        <p className="text-center text-sm text-stone-500 mt-4">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}