"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, eligibility, daysUntil } from "../../lib/eligibility";
import { getSupabaseBrowser } from "../../lib/supabaseBrowser";
import { applyTheme, DEFAULT_PORTAL_THEME } from "../../lib/theme";

export default function PortalPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [session, setSession] = useState(null);
  const [client, setClient] = useState(null);
  const [meError, setMeError] = useState("");
  const [loans, setLoans] = useState([]);
  const [rules, setRules] = useState(null);
  const [amount, setAmount] = useState("");
  const [applyError, setApplyError] = useState("");
  const [orgTheme, setOrgTheme] = useState(DEFAULT_PORTAL_THEME);
  const [modeOverride, setModeOverride] = useState(null);

  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("lenda-portal-mode");
    } catch (e) {}
    setModeOverride(saved);

    fetch("/api/theme")
      .then((r) => r.json())
      .then((t) => {
        if (t?.portal) setOrgTheme(t.portal);
      })
      .catch(() => {});

    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (err) {
      setMeError(err.message);
      setLoadingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const effectiveTheme = { ...orgTheme, mode: modeOverride || orgTheme.mode };

  useEffect(() => {
    applyTheme(document.documentElement, effectiveTheme, { cardStyleTarget: document.body });
    if (effectiveTheme.backgroundImage) {
      document.body.style.backgroundImage = `url('${effectiveTheme.backgroundImage}')`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgTheme, modeOverride]);

  useEffect(() => {
    if (session) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function authedFetch(url, opts = {}) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : "" },
    });
  }

  async function refresh() {
    setMeError("");
    try {
      const [meRes, loansRes, rulesRes] = await Promise.all([
        authedFetch("/api/me"),
        authedFetch("/api/loans"),
        authedFetch("/api/rules"),
      ]);
      if (meRes.ok) {
        setClient(await meRes.json());
      } else {
        const d = await meRes.json().catch(() => ({}));
        setMeError(d.error || "Could not load your profile");
        setClient(null);
      }
      setLoans(loansRes.ok ? await loansRes.json() : []);
      setRules(rulesRes.ok ? await rulesRes.json() : null);
    } catch (err) {
      setMeError("Could not reach the server. Please try again shortly.");
    }
  }

  function toggleTheme() {
    const next = effectiveTheme.mode === "light" ? "dark" : "light";
    setModeOverride(next);
    try {
      localStorage.setItem("lenda-portal-mode", next);
    } catch (e) {}
  }

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/landing");
  }

  async function applyLoan(e) {
    e.preventDefault();
    setApplyError("");
    const res = await authedFetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    const data = await res.json();
    if (res.ok) {
      setAmount("");
      refresh();
    } else {
      setApplyError(data.error || "Could not submit application");
    }
  }

  if (loadingAuth) {
    return (
      <div className="landing-wrap">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="landing-wrap">
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title" style={{ marginBottom: 10 }}>You need to sign in</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 16 }}>
            {meError || "Sign up or log in from the landing page to see your loan status."}
          </div>
          <a className="btn btn-green" href="/landing#auth-panel">Go to Sign In / Sign Up</a>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-wrap">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <button className="btn btn-ghost" onClick={toggleTheme}>{effectiveTheme.mode === "light" ? "☀️" : "🌙"}</button>
        <button className="btn btn-ghost" onClick={signOut}>Log Out</button>
      </div>

      {meError ? (
        <div className="card empty">{meError} — please contact support if this doesn&apos;t resolve.</div>
      ) : !client || !rules ? (
        <div className="empty">Loading your account…</div>
      ) : (() => {
        const e = eligibility(client, rules);
        const loan = loans[0]; // already scoped to this client, most recent first
        return (
          <>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Welcome, {client.name}</div>
              <div className="stat-row"><span>Monthly income</span><b>{fmt(client.income)}</b></div>
              <div className="stat-row"><span>Employment</span><b>{client.employment}</b></div>
              <div className="stat-row"><span>Your qualifying limit</span><b>{e.qualifies ? fmt(e.maxLoan) : "Not eligible"}</b></div>
            </div>

            {!loan ? (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Apply for a Loan</div>
                {e.qualifies ? (
                  <form onSubmit={applyLoan}>
                    <label>Amount requested (max {fmt(e.maxLoan)})</label>
                    <input type="number" max={e.maxLoan} value={amount} onChange={(ev) => setAmount(ev.target.value)} />
                    {applyError && <div style={{ color: "var(--error)", fontSize: 12.5, marginBottom: 10 }}>{applyError}</div>}
                    <button className="btn btn-green" type="submit">Submit Application</button>
                  </form>
                ) : (
                  <div className="empty">
                    Not currently eligible. Requires min income {fmt(rules.minIncome)} and employment in: {rules.allowed.join(", ")}.
                  </div>
                )}
              </div>
            ) : (
              <LoanStatus loan={loan} />
            )}
          </>
        );
      })()}
    </div>
  );
}

function LoanStatus({ loan }) {
  const stages = ["pending", "reviewing", "approved", "active", "closed"];
  const idx = loan.status === "rejected" ? -1 : stages.indexOf(loan.status);
  const bal = (loan.totalDue || 0) - (loan.paidSoFar || 0);
  const pct = loan.totalDue ? Math.min(100, Math.round((loan.paidSoFar / loan.totalDue) * 100)) : 0;
  const d = daysUntil(loan.dueDate);
  const labels = ["Applied", "In Review", "Awarded", "Disbursed & Repaying", "Paid"];

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 6 }}>Your Loan</div>
      {loan.status === "rejected" ? (
        <p><span className="badge b-rejected">Rejected</span> Your application for {fmt(loan.amount)} was not approved.</p>
      ) : (
        <>
          <div className="stepper">
            {labels.map((l, i) => (
              <div key={l} className={`step ${i <= idx ? "done" : ""} ${i === idx ? "now" : ""}`}>{l}</div>
            ))}
          </div>
          <div className="stat-row"><span>Amount requested</span><b>{fmt(loan.amount)}</b></div>
          {loan.status !== "pending" ? (
            <>
              <div className="stat-row"><span>Total repayable</span><b>{fmt(loan.totalDue)}</b></div>
              <div className="stat-row"><span>Paid so far</span><b>{fmt(loan.paidSoFar)}</b></div>
              <div className="stat-row"><span>Balance remaining</span><b>{fmt(bal)}</b></div>
              <div className="stat-row"><span>Due date</span><b>{loan.dueDate}{d !== null ? ` (${d >= 0 ? d + " days left" : "overdue"})` : ""}</b></div>
              <div className="progress"><div style={{ width: `${pct}%` }} /></div>
              <div className="empty" style={{ padding: 4 }}>{pct}% repaid</div>
            </>
          ) : (
            <div className="empty">Pending staff review.</div>
          )}
        </>
      )}
    </div>
  );
}
