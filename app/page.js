"use client";
import { useEffect, useState, useCallback } from "react";
import { fmt, eligibility, daysUntil } from "../lib/eligibility";

const NAV = [
  { section: "Overview", items: [["dashboard", "📊", "Dashboard"]] },
  {
    section: "Manage",
    items: [
      ["clients", "👥", "Clients"],
      ["rules", "📋", "Loan Rules"],
      ["loans", "💵", "Loans"],
    ],
  },
  { section: "Setup", items: [["company", "🏢", "Company Setup"]] },
];
const ALL_TABS = [
  ["dashboard", "Dashboard"],
  ["clients", "Clients"],
  ["rules", "Loan Rules"],
  ["loans", "Loans"],
  ["company", "Company Setup"],
];
const EMPTY_RULES = { minIncome: 10000, maxMultiplier: 3, interestRatePct: 12, termMonths: 6, allowed: [] };

function badge(status) {
  const map = {
    pending: ["b-pending", "Pending"],
    approved: ["b-approved", "Approved"],
    active: ["b-active", "Active"],
    closed: ["b-closed", "Closed"],
    rejected: ["b-rejected", "Rejected"],
  };
  const [cls, label] = map[status] || ["b-pending", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function AdminApp() {
  const [page, setPage] = useState("dashboard");
  const [companyTab, setCompanyTab] = useState("profile");
  const [rules, setRules] = useState(EMPTY_RULES);
  const [clients, setClients] = useState([]);
  const [loans, setLoans] = useState([]);
  const [staff, setStaff] = useState([]);
  const [company, setCompany] = useState({});
  const [payments, setPayments] = useState({});
  const [activity, setActivity] = useState([]);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState("dark");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const refreshAll = useCallback(async () => {
    const [r, c, l, s, co, p, a] = await Promise.all([
      fetch("/api/rules").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/company").then((r) => r.json()),
      fetch("/api/payments").then((r) => r.json()),
      fetch("/api/activity").then((r) => r.json()),
    ]);
    setRules(r);
    setClients(c);
    setLoans(l);
    setStaff(s);
    setCompany(co);
    setPayments(p);
    setActivity(a);
  }, []);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lenda-theme")) || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    refreshAll();
  }, [refreshAll]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("lenda-theme", next);
    } catch (e) {}
  }

  async function addClient(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      nationalId: f.nationalId.value.trim(),
      income: Number(f.income.value) || 0,
      employment: f.employment.value,
    };
    if (!body.name || !body.phone) return showToast("Name and phone required");
    const res = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      f.reset();
      showToast("Client registered");
      refreshAll();
    } else showToast((await res.json()).error || "Failed");
  }

  async function saveRules(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      minIncome: Number(f.minIncome.value) || 0,
      maxMultiplier: Number(f.maxMultiplier.value) || 0,
      interestRatePct: Number(f.interestRatePct.value) || 0,
      termMonths: Number(f.termMonths.value) || 1,
      allowed: f.allowed.value.split(",").map((s) => s.trim()).filter(Boolean),
    };
    await fetch("/api/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Rules saved");
    refreshAll();
  }

  async function loanAction(id, action, amount) {
    const res = await fetch(`/api/loans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, amount }) });
    if (res.ok) {
      showToast("Updated");
      refreshAll();
    } else showToast((await res.json()).error || "Failed");
  }

  async function saveCompany(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      name: f.name.value.trim(),
      logoEmoji: f.logoEmoji.value.trim(),
      tagline: f.tagline.value.trim(),
      regNumber: f.regNumber.value.trim(),
      website: f.website.value.trim(),
      address: f.address.value.trim(),
      carePhone: f.carePhone.value.trim(),
      careEmail: f.careEmail.value.trim(),
      careWhatsapp: f.careWhatsapp.value.trim(),
    };
    await fetch("/api/company", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Company profile saved");
    refreshAll();
  }

  async function addStaff(e) {
    e.preventDefault();
    const f = e.target;
    const tabs = [...f.querySelectorAll(".s-tab:checked")].map((c) => c.value);
    const body = { name: f.name.value.trim(), email: f.email.value.trim(), role: f.role.value, tabs };
    if (!body.name || !body.email) return showToast("Name and email required");
    const res = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      f.reset();
      showToast("Staff member added");
      refreshAll();
    } else showToast((await res.json()).error || "Failed");
  }

  async function savePayments(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      mpesaPaybill: f.mpesaPaybill.value.trim(),
      mpesaAccount: f.mpesaAccount.value.trim(),
      mpesaInstructions: f.mpesaInstructions.value.trim(),
      bankName: f.bankName.value.trim(),
      bankAccountName: f.bankAccountName.value.trim(),
      bankAccountNumber: f.bankAccountNumber.value.trim(),
      bankBranch: f.bankBranch.value.trim(),
    };
    await fetch("/api/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Payment methods saved");
    refreshAll();
  }

  async function saveLanding(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      heroTitle: f.heroTitle.value.trim(),
      heroSubtitle: f.heroSubtitle.value.trim(),
      aboutText: f.aboutText.value.trim(),
      features: [0, 1, 2].map((i) => ({
        title: f[`f${i}t`].value.trim(),
        desc: f[`f${i}d`].value.trim(),
      })),
    };
    await fetch("/api/landing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Landing page saved");
  }

  const pageTitle = { dashboard: "Dashboard", clients: "Clients", rules: "Loan Rules", loans: "Loans", company: "Company Setup" }[page];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="company">{company.logoEmoji || "💠"} {company.name || "LENDA"}</div>
          <div className="powered">{company.tagline || "Microfinance Loan Admin"}</div>
        </div>
        {NAV.map((sec) => (
          <div key={sec.section}>
            <div className="nav-section">{sec.section}</div>
            {sec.items.map(([key, icon, label]) => (
              <button key={key} className={`nav-item ${page === key ? "active" : ""}`} onClick={() => setPage(key)}>
                <span className="icon">{icon}</span> {label}
              </button>
            ))}
          </div>
        ))}
        <div className="nav-section">Public pages</div>
        <a className="nav-item" href="/landing" target="_blank" rel="noreferrer"><span className="icon">🌐</span> Landing Page</a>
        <a className="nav-item" href="/portal" target="_blank" rel="noreferrer"><span className="icon">🙋</span> Client Portal</a>
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 12px" }}>Staff access shown, not yet enforced</div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="page-title">{pageTitle}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-ghost" onClick={toggleTheme} title="Toggle dark/light mode">
              {theme === "light" ? "☀️" : "🌙"}
            </button>
            <div className="user-chip"><span className="user-dot"></span> Staff</div>
          </div>
        </div>

        <div className="content">
          {page === "dashboard" && (
            <Dashboard clients={clients} loans={loans} activity={activity} rules={rules} setPage={setPage} />
          )}
          {page === "clients" && <Clients clients={clients} rules={rules} onAdd={addClient} />}
          {page === "rules" && <Rules rules={rules} onSave={saveRules} />}
          {page === "loans" && <Loans loans={loans} clients={clients} onAction={loanAction} />}
          {page === "company" && (
            <Company
              companyTab={companyTab}
              setCompanyTab={setCompanyTab}
              company={company}
              staff={staff}
              payments={payments}
              onSaveCompany={saveCompany}
              onAddStaff={addStaff}
              onSavePayments={savePayments}
              onSaveLanding={saveLanding}
            />
          )}
        </div>
      </div>

      <div className={`toast ${toast ? "show" : ""} success`}>{toast}</div>
    </div>
  );
}

function Dashboard({ clients, loans, activity, rules, setPage }) {
  const totalOut = loans.filter((l) => l.status === "active").reduce((s, l) => s + ((l.totalDue || 0) - (l.paidSoFar || 0)), 0);
  const totalDisbursed = loans.filter((l) => ["active", "closed"].includes(l.status)).reduce((s, l) => s + (l.amount || 0), 0);
  const overdue = loans.filter((l) => l.status === "active" && daysUntil(l.dueDate) < 0).length;
  const pending = loans.filter((l) => l.status === "pending").length;
  const counts = { pending: 0, approved: 0, active: 0, closed: 0, rejected: 0 };
  loans.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1));
  const total = loans.length || 1;
  const colors = { pending: "var(--gold)", approved: "var(--blue)", active: "var(--green)", closed: "var(--muted)", rejected: "var(--error)" };

  return (
    <>
      <div className="stats-grid">
        <div className="stat green"><div className="stat-label">Total Clients</div><div className="stat-value green">{clients.length}</div></div>
        <div className="stat blue"><div className="stat-label">Active Loans</div><div className="stat-value blue">{loans.filter((l) => l.status === "active").length}</div></div>
        <div className="stat gold"><div className="stat-label">Pending Review</div><div className="stat-value gold">{pending}</div></div>
        <div className="stat pink"><div className="stat-label">Overdue</div><div className="stat-value pink">{overdue}</div></div>
        <div className="stat muted"><div className="stat-label">Disbursed</div><div className="stat-value mono">{fmt(totalDisbursed)}</div></div>
        <div className="stat muted"><div className="stat-label">Outstanding</div><div className="stat-value mono">{fmt(totalOut)}</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">👥 Recent Clients</div><button className="card-action" onClick={() => setPage("clients")}>View all →</button></div>
          <div className="tablewrap"><table><tbody>
            <tr><th>Name</th><th>Phone</th><th>Income</th><th>Eligible</th></tr>
            {clients.length === 0 ? <tr><td colSpan={4} className="empty">No clients yet</td></tr> : clients.slice(0, 6).map((c) => {
              const e = eligibility(c, rules);
              return <tr key={c.id}><td>{c.name}</td><td className="mono">{c.phone}</td><td className="mono">{fmt(c.income)}</td><td>{e.qualifies ? `✅ ${fmt(e.maxLoan)}` : "❌"}</td></tr>;
            })}
          </tbody></table></div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">🥧 Loan Portfolio</div></div>
          {loans.length === 0 ? <div className="empty">No loans yet</div> : Object.entries(counts).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, minWidth: 70, textTransform: "capitalize" }}>{k}</div>
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${(v / total) * 100}%`, height: "100%", background: colors[k] }} />
              </div>
              <div className="mono" style={{ fontSize: 12, minWidth: 20, textAlign: "right" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">⚡ Recent Activity</div></div>
        {activity.length === 0 ? <div className="empty">No activity yet</div> : activity.map((a, i) => (
          <div className="activity-item" key={i}>
            <div className={`activity-icon ${a.cls}`}>{a.icon}</div>
            <div><div className="activity-text">{a.text}</div><div className="activity-time">{a.time}</div></div>
          </div>
        ))}
      </div>
      <div className="card" style={{ borderColor: "rgba(255,215,64,.3)" }}>
        <div className="card-title" style={{ color: "var(--gold)", marginBottom: 6 }}>⚠️ Deployment notice</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
          Data is stored in a JSON file on the server (<code>data/store.json</code>). This works well on Render (persistent disk) but resets between deploys on Vercel&apos;s serverless filesystem — for production on Vercel, swap <code>lib/store.js</code> for a real database (Postgres, Supabase, etc). Client portal login is a demo picker, not real authentication.
        </div>
      </div>
    </>
  );
}

function Clients({ clients, rules, onAdd }) {
  return (
    <>
      <div className="card">
        <div className="card-header"><div className="card-title">＋ Register New Client</div></div>
        <form onSubmit={onAdd}>
          <div className="form-grid">
            <div><label>Full name</label><input name="name" /></div>
            <div><label>Phone / login ID</label><input name="phone" /></div>
            <div><label>National ID No.</label><input name="nationalId" /></div>
            <div><label>Monthly income (KES)</label><input name="income" type="number" /></div>
          </div>
          <label>Employment type</label>
          <select name="employment">
            {["Employed", "Self-employed", "Business owner", "Unemployed"].map((o) => <option key={o}>{o}</option>)}
          </select>
          <button className="btn btn-green" type="submit">Register Client</button>
        </form>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">👥 All Clients</div></div>
        <div className="tablewrap"><table><tbody>
          <tr><th>Name</th><th>Phone</th><th>National ID</th><th>Income</th><th>Employment</th><th>Eligible Limit</th></tr>
          {clients.length === 0 ? <tr><td colSpan={6} className="empty">No clients registered yet</td></tr> : clients.map((c) => {
            const e = eligibility(c, rules);
            return (
              <tr key={c.id}>
                <td>{c.name}</td><td className="mono">{c.phone}</td><td className="mono">{c.nationalId || "—"}</td>
                <td className="mono">{fmt(c.income)}</td><td>{c.employment}</td>
                <td>{e.qualifies ? fmt(e.maxLoan) : <span style={{ color: "var(--error)" }}>Not eligible</span>}</td>
              </tr>
            );
          })}
        </tbody></table></div>
      </div>
    </>
  );
}

function Rules({ rules, onSave }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">📋 Qualification &amp; Limit Rules</div></div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
        Max qualifying loan = monthly income × multiplier. A client must also meet the minimum income and be in an eligible employment category.
      </div>
      <form onSubmit={onSave}>
        <div className="form-grid">
          <div><label>Minimum monthly income (KES)</label><input name="minIncome" type="number" defaultValue={rules.minIncome} /></div>
          <div><label>Loan multiplier (× income)</label><input name="maxMultiplier" type="number" step="0.1" defaultValue={rules.maxMultiplier} /></div>
          <div><label>Interest rate (% flat / term)</label><input name="interestRatePct" type="number" step="0.1" defaultValue={rules.interestRatePct} /></div>
          <div><label>Loan term (months)</label><input name="termMonths" type="number" defaultValue={rules.termMonths} /></div>
        </div>
        <label>Eligible employment types (comma-separated)</label>
        <input name="allowed" defaultValue={(rules.allowed || []).join(", ")} />
        <button className="btn btn-green" type="submit">Save Rules</button>
      </form>
    </div>
  );
}

function Loans({ loans, clients, onAction }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">💵 All Loans</div></div>
      <div className="tablewrap"><table><tbody>
        <tr><th>Client</th><th>Amount</th><th>Status</th><th>Due</th><th>Paid / Total</th><th>Actions</th></tr>
        {loans.length === 0 ? <tr><td colSpan={6} className="empty">No loan applications yet</td></tr> : loans.map((l) => {
          const c = clients.find((x) => x.id === l.clientId);
          const d = daysUntil(l.dueDate);
          return (
            <tr key={l.id}>
              <td>{c ? c.name : "Unknown"}</td>
              <td className="mono">{fmt(l.amount)}</td>
              <td>{badge(l.status)}</td>
              <td>{l.dueDate ? l.dueDate + (d !== null ? ` (${d >= 0 ? d + "d left" : "overdue"})` : "") : "—"}</td>
              <td className="mono">{["pending", "rejected"].includes(l.status) ? "—" : `${fmt(l.paidSoFar)} / ${fmt(l.totalDue)}`}</td>
              <td>
                <div className="btn-row">
                  {l.status === "pending" && <>
                    <button className="btn btn-green" onClick={() => onAction(l.id, "approve")}>Approve</button>
                    <button className="btn btn-error" onClick={() => onAction(l.id, "reject")}>Reject</button>
                  </>}
                  {l.status === "approved" && <button className="btn btn-green" onClick={() => onAction(l.id, "disburse")}>Disburse</button>}
                  {l.status === "active" && <button className="btn btn-ghost" onClick={() => {
                    const amt = Number(prompt("Payment amount received (KES):"));
                    if (amt) onAction(l.id, "pay", amt);
                  }}>Record Payment</button>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody></table></div>
    </div>
  );
}

function Company({ companyTab, setCompanyTab, company, staff, payments, onSaveCompany, onAddStaff, onSavePayments, onSaveLanding }) {
  const tabs = [["profile", "Profile & Contact"], ["staff", "Staff & Access"], ["payments", "Payment Methods"], ["landing", "Landing Page Content"]];
  return (
    <>
      <div className="btn-row" style={{ marginBottom: 18 }}>
        {tabs.map(([k, l]) => (
          <button key={k} className={`btn ${companyTab === k ? "btn-green" : "btn-ghost"}`} onClick={() => setCompanyTab(k)}>{l}</button>
        ))}
      </div>

      {companyTab === "profile" && (
        <div className="card">
          <div className="card-header"><div className="card-title">🏢 Company Profile</div></div>
          <form onSubmit={onSaveCompany}>
            <div className="form-grid">
              <div><label>Company name</label><input name="name" defaultValue={company.name} /></div>
              <div><label>Logo emoji</label><input name="logoEmoji" defaultValue={company.logoEmoji} /></div>
              <div><label>Tagline</label><input name="tagline" defaultValue={company.tagline} /></div>
              <div><label>Registration number</label><input name="regNumber" defaultValue={company.regNumber} /></div>
              <div><label>Website</label><input name="website" placeholder="https://..." defaultValue={company.website} /></div>
              <div><label>Physical address</label><input name="address" defaultValue={company.address} /></div>
            </div>
            <div className="card-title" style={{ margin: "14px 0 10px", fontSize: 13 }}>Customer Care</div>
            <div className="form-grid">
              <div><label>Support phone</label><input name="carePhone" defaultValue={company.carePhone} /></div>
              <div><label>Support email</label><input name="careEmail" defaultValue={company.careEmail} /></div>
              <div><label>WhatsApp number</label><input name="careWhatsapp" defaultValue={company.careWhatsapp} /></div>
            </div>
            <button className="btn btn-green" type="submit">Save Company Profile</button>
          </form>
        </div>
      )}

      {companyTab === "staff" && (
        <>
          <div className="card">
            <div className="card-header"><div className="card-title">＋ Add Staff Member</div></div>
            <form onSubmit={onAddStaff}>
              <div className="form-grid">
                <div><label>Full name</label><input name="name" /></div>
                <div><label>Email</label><input name="email" /></div>
              </div>
              <label>Role</label>
              <select name="role">{["Admin", "Manager", "Loan Officer", "Support"].map((o) => <option key={o}>{o}</option>)}</select>
              <label>Tabs this staff member can access</label>
              <div className="btn-row" style={{ marginBottom: 12 }}>
                {ALL_TABS.map(([k, l]) => (
                  <label key={k} className="checkbox-chip"><input type="checkbox" className="s-tab" value={k} defaultChecked />{l}</label>
                ))}
              </div>
              <button className="btn btn-green" type="submit">Add Staff Member</button>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">👤 Staff Directory</div></div>
            <div className="tablewrap"><table><tbody>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th></tr>
              {staff.length === 0 ? <tr><td colSpan={4} className="empty">No staff added yet</td></tr> : staff.map((s) => (
                <tr key={s.id}><td>{s.name}</td><td className="mono">{s.email}</td><td>{s.role}</td>
                  <td>{(s.tabs || []).map((t) => (ALL_TABS.find((x) => x[0] === t) || [t, t])[1]).join(", ") || "—"}</td></tr>
              ))}
            </tbody></table></div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              Note: this is a directory only — tab access isn&apos;t enforced yet since there&apos;s no login system tying a signed-in user to a staff record.
            </div>
          </div>
        </>
      )}

      {companyTab === "payments" && (
        <form onSubmit={onSavePayments}>
          <div className="card">
            <div className="card-header"><div className="card-title">📱 M-Pesa</div></div>
            <div className="form-grid">
              <div><label>Paybill number</label><input name="mpesaPaybill" defaultValue={payments.mpesaPaybill} /></div>
              <div><label>Account name / reference format</label><input name="mpesaAccount" defaultValue={payments.mpesaAccount} /></div>
            </div>
            <label>Instructions shown to clients</label>
            <input name="mpesaInstructions" placeholder="e.g. Use your phone number as the account number" defaultValue={payments.mpesaInstructions} />
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">🏦 Bank Transfer</div></div>
            <div className="form-grid">
              <div><label>Bank name</label><input name="bankName" defaultValue={payments.bankName} /></div>
              <div><label>Account name</label><input name="bankAccountName" defaultValue={payments.bankAccountName} /></div>
              <div><label>Account number</label><input name="bankAccountNumber" defaultValue={payments.bankAccountNumber} /></div>
              <div><label>Branch</label><input name="bankBranch" defaultValue={payments.bankBranch} /></div>
            </div>
            <button className="btn btn-green" type="submit">Save Payment Methods</button>
          </div>
        </form>
      )}

      {companyTab === "landing" && <LandingForm onSave={onSaveLanding} />}
    </>
  );
}

function LandingForm({ onSave }) {
  const [landing, setLanding] = useState(null);
  useEffect(() => {
    fetch("/api/landing").then((r) => r.json()).then(setLanding);
  }, []);
  if (!landing) return <div className="empty">Loading…</div>;
  const f = landing.features || [{}, {}, {}];
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">🌐 Landing Page Content</div></div>
      <form onSubmit={onSave}>
        <label>Hero title</label><input name="heroTitle" defaultValue={landing.heroTitle} />
        <label>Hero subtitle</label><input name="heroSubtitle" defaultValue={landing.heroSubtitle} />
        <label>About paragraph</label><input name="aboutText" defaultValue={landing.aboutText} />
        <div className="card-title" style={{ margin: "14px 0 10px", fontSize: 13 }}>Highlights (3)</div>
        {[0, 1, 2].map((i) => (
          <div className="form-grid" key={i}>
            <div><label>Highlight {i + 1} title</label><input name={`f${i}t`} defaultValue={f[i]?.title} /></div>
            <div><label>Highlight {i + 1} description</label><input name={`f${i}d`} defaultValue={f[i]?.desc} /></div>
          </div>
        ))}
        <button className="btn btn-green" type="submit">Save Landing Content</button>
        <a className="card-action" style={{ marginLeft: 12 }} href="/landing" target="_blank" rel="noreferrer">Preview →</a>
      </form>
    </div>
  );
}
