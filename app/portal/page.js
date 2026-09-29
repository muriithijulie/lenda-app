"use client";
import { useEffect, useState } from "react";
import { fmt, eligibility, daysUntil } from "../../lib/eligibility";

export default function PortalPage() {
  const [clients, setClients] = useState([]);
  const [loans, setLoans] = useState([]);
  const [rules, setRules] = useState(null);
  const [currentId, setCurrentId] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [theme, setTheme] = useState("dark");

  const refresh = () => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/rules").then((r) => r.json()),
    ]).then(([c, l, r]) => {
      setClients(c);
      setLoans(l);
      setRules(r);
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("lenda-theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    refresh();
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("lenda-theme", next); } catch (e) {}
  }

  if (!rules) return <div className="landing-wrap"><div className="empty">Loading…</div></div>;

  const client = clients.find((c) => c.id === currentId);

  async function applyLoan(e) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, amount: Number(amount) }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("");
      setAmount("");
      refresh();
    } else {
      setMsg(data.error || "Could not submit application");
    }
  }

  return (
    <div className="landing-wrap">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn btn-ghost" onClick={toggleTheme}>{theme === "light" ? "☀️" : "🌙"}</button>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">🙋 Client Login (demo)</div></div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          Prototype login by selecting a registered profile — a live system needs real authentication.
        </div>
        <select value={currentId} onChange={(e) => setCurrentId(e.target.value)}>
          <option value="">-- select your profile --</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
        </select>
      </div>

      {!client && (
        <div className="card empty">{clients.length === 0 ? "Ask staff to register you first." : "Select your profile above."}</div>
      )}

      {client && (() => {
        const e = eligibility(client, rules);
        const loan = loans.filter((l) => l.clientId === client.id)[0];
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
                    {msg && <div style={{ color: "var(--error)", fontSize: 12.5, marginBottom: 10 }}>{msg}</div>}
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
  const stages = ["pending", "approved", "active", "closed"];
  const idx = loan.status === "rejected" ? -1 : stages.indexOf(loan.status);
  const bal = (loan.totalDue || 0) - (loan.paidSoFar || 0);
  const pct = loan.totalDue ? Math.min(100, Math.round((loan.paidSoFar / loan.totalDue) * 100)) : 0;
  const d = daysUntil(loan.dueDate);
  const labels = ["Applied", "Approved", "Disbursed & Repaying", "Closed"];

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
