"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

export default function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function switchMode(next) {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const f = e.target;
    try {
      const email = f.email.value.trim();
      const password = f.password.value;
      const name = f.name.value.trim();
      const phone = f.phone.value.trim();
      const income = Number(f.income.value) || 0;
      const employment = f.employment.value;

      const supabase = getSupabaseBrowser();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      const authId = data.user?.id;
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, income, employment, authId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not create your client profile");
      }

      if (data.session) {
        router.push("/portal");
      } else {
        setInfo("Account created! Check your email to confirm it, then log in below.");
        setMode("signin");
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const f = e.target;
    try {
      const email = f.email.value.trim();
      const password = f.password.value;
      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/portal");
    } catch (err) {
      setError(err.message || "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" id="auth-panel">
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button type="button" className={`btn ${mode === "signup" ? "btn-green" : "btn-ghost"}`} onClick={() => switchMode("signup")}>
          Sign Up
        </button>
        <button type="button" className={`btn ${mode === "signin" ? "btn-green" : "btn-ghost"}`} onClick={() => switchMode("signin")}>
          Log In
        </button>
      </div>

      {error && <div style={{ color: "var(--error)", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      {info && <div style={{ color: "var(--green)", fontSize: 12.5, marginBottom: 10 }}>{info}</div>}

      {mode === "signup" ? (
        <form onSubmit={handleSignUp}>
          <div className="form-grid">
            <div><label>Full name</label><input name="name" required /></div>
            <div><label>Phone</label><input name="phone" required /></div>
            <div><label>Email</label><input name="email" type="email" required /></div>
            <div><label>Password</label><input name="password" type="password" minLength={6} required /></div>
            <div><label>Monthly income (KES)</label><input name="income" type="number" required /></div>
            <div>
              <label>Employment type</label>
              <select name="employment">
                {["Employed", "Self-employed", "Business owner", "Unemployed"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-green" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignIn}>
          <label>Email</label>
          <input name="email" type="email" required />
          <label>Password</label>
          <input name="password" type="password" required />
          <button className="btn btn-green" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>
        </form>
      )}
    </div>
  );
}
