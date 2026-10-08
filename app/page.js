"use client";
import { useEffect, useState, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fmt, eligibility, daysUntil } from "../lib/eligibility";
import { downloadCSV } from "../lib/csv";
import { ACCENT_OPTIONS, FONT_OPTIONS, MODE_OPTIONS, CARD_STYLE_OPTIONS, BACKGROUND_PRESETS, parseBackgroundImage, buildBackgroundImage, DEFAULT_ADMIN_THEME, DEFAULT_PORTAL_THEME, applyTheme } from "../lib/theme";
import { SMS_PROVIDERS, FIELD_LABELS } from "../lib/sms";
import { ALL_TABS } from "../lib/tabs";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

// Attaches the signed-in staff member's Supabase session token to every
// request, so the API routes behind it can verify who's actually asking.
async function api(url, opts = {}) {
  let token = "";
  try {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || "";
  } catch (e) {}
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : "" } });
}

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
  {
    section: "Insights",
    items: [
      ["reports", "📈", "Reports"],
      ["risk", "⚠️", "Risk"],
    ],
  },
  { section: "Engage", items: [["comms", "📨", "Communications"]] },
  { section: "Setup", items: [["company", "🏢", "Company Setup"]] },
];
const EMPTY_RULES = { minIncome: 10000, maxMultiplier: 3, interestRatePct: 12, termMonths: 6, allowed: [] };
const STATUS_COLORS = { pending: "#FFD740", reviewing: "#FF4081", approved: "#40C4FF", active: "#00E676", closed: "#5C7A99", rejected: "#FF5252" };

function badge(status) {
  const map = {
    pending: ["b-pending", "Pending"],
    reviewing: ["b-reviewing", "In Review"],
    approved: ["b-approved", "Awarded"],
    active: ["b-active", "Active"],
    closed: ["b-closed", "Paid"],
    rejected: ["b-rejected", "Rejected"],
  };
  const [cls, label] = map[status] || ["b-pending", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

// A client's current loan is whichever one isn't in a closed/rejected end
// state, or failing that their most recent one — used for the Clients page
// inline status column.
function currentLoanFor(clientId, loans) {
  const mine = loans.filter((l) => l.clientId === clientId);
  if (mine.length === 0) return null;
  const open = mine.find((l) => !["closed", "rejected"].includes(l.status));
  return open || mine[0];
}

function AdminApp({ me, onSignOut }) {
  const myTabs = me.tabs && me.tabs.length ? me.tabs : ALL_TABS.map(([k]) => k);
  const [page, setPage] = useState(myTabs.includes("dashboard") ? "dashboard" : myTabs[0] || "dashboard");
  const [companyTab, setCompanyTab] = useState("profile");
  const [reportsTab, setReportsTab] = useState("company");
  const [rules, setRules] = useState(EMPTY_RULES);
  const [clients, setClients] = useState([]);
  const [loans, setLoans] = useState([]);
  const [staff, setStaff] = useState([]);
  const [company, setCompany] = useState({});
  const [payments, setPayments] = useState({});
  const [activity, setActivity] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [commsPrefillClientId, setCommsPrefillClientId] = useState(null);
  const [clientModal, setClientModal] = useState(null); // { clientId, mode: "view"|"edit" } | null
  const [toast, setToast] = useState(null);
  const [adminTheme, setAdminTheme] = useState(DEFAULT_ADMIN_THEME);
  const [portalTheme, setPortalTheme] = useState(DEFAULT_PORTAL_THEME);
  const [smsConfig, setSmsConfig] = useState({ provider: "", apiKey: "", username: "", senderId: "" });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const refreshAll = useCallback(async () => {
    const [r, c, l, s, co, p, a, cm, sms, th] = await Promise.all([
      api("/api/rules").then((r) => r.json()),
      api("/api/clients").then((r) => r.json()),
      api("/api/loans").then((r) => r.json()),
      api("/api/staff").then((r) => r.json()),
      api("/api/company").then((r) => r.json()),
      api("/api/payments").then((r) => r.json()),
      api("/api/activity").then((r) => r.json()),
      api("/api/communications").then((r) => r.json()),
      api("/api/sms-settings").then((r) => r.json()),
      api("/api/theme").then((r) => r.json()),
    ]);
    setRules(r);
    setClients(c);
    setLoans(l);
    setStaff(s);
    setCompany(co);
    setPayments(p);
    setActivity(a);
    setCommunications(cm);
    setSmsConfig(sms);
    if (th?.admin) setAdminTheme(th.admin);
    if (th?.portal) setPortalTheme(th.portal);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    applyTheme(document.documentElement, adminTheme);
  }, [adminTheme]);

  function quickToggleTheme() {
    const next = { ...adminTheme, mode: adminTheme.mode === "light" ? "dark" : "light" };
    setAdminTheme(next);
    saveTheme({ admin: next, portal: portalTheme });
  }

  async function saveTheme(next) {
    const res = await api("/api/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (res.ok) {
      const data = await res.json();
      if (data?.admin) setAdminTheme(data.admin);
      if (data?.portal) setPortalTheme(data.portal);
      showToast("Theme saved");
    } else showToast("Could not save theme");
  }

  async function saveSmsConfig(next) {
    const res = await api("/api/sms-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (res.ok) {
      setSmsConfig(await res.json());
      showToast("SMS provider settings saved");
    } else showToast("Could not save SMS settings");
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
    const res = await api("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      f.reset();
      showToast("Client registered");
      refreshAll();
    } else showToast((await res.json()).error || "Failed");
  }

  // res.json() throws if the body isn't valid JSON (a 404 page, a gateway
  // timeout, etc.) — without this, that throw was unhandled and the whole
  // action failed completely silently. This guarantees there's always a
  // readable message instead of nothing happening.
  async function safeErrorMessage(res, fallback) {
    try {
      const data = await res.json();
      return data?.error || fallback;
    } catch (e) {
      return `${fallback} (server returned ${res.status} ${res.statusText || ""})`;
    }
  }

  async function updateClient(id, patch) {
    try {
      const res = await api(`/api/clients/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (res.ok) {
        showToast("Client updated");
        refreshAll();
        return true;
      }
      showToast(await safeErrorMessage(res, "Could not update client"));
      return false;
    } catch (err) {
      showToast(`Could not reach the server: ${err.message}`);
      return false;
    }
  }

  async function deleteClient(id) {
    try {
      const res = await api(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Client deleted");
        refreshAll();
        return true;
      }
      showToast(await safeErrorMessage(res, "Could not delete client"));
      return false;
    } catch (err) {
      showToast(`Could not reach the server: ${err.message}`);
      return false;
    }
  }

  async function uploadClientDocument(clientId, file, label) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", label || file.name);
      const res = await api(`/api/clients/${clientId}/documents`, { method: "POST", body: formData });
      if (res.ok) {
        showToast("Document uploaded");
        refreshAll();
        return true;
      }
      showToast(await safeErrorMessage(res, "Upload failed"));
      return false;
    } catch (err) {
      showToast(`Could not reach the server: ${err.message}`);
      return false;
    }
  }

  async function deleteClientDocument(clientId, docId) {
    try {
      const res = await api(`/api/clients/${clientId}/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Document removed");
        refreshAll();
      } else {
        showToast(await safeErrorMessage(res, "Could not remove document"));
      }
    } catch (err) {
      showToast(`Could not reach the server: ${err.message}`);
    }
  }

  async function viewClientDocument(clientId, docId) {
    try {
      const res = await api(`/api/clients/${clientId}/documents/${docId}`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        showToast(await safeErrorMessage(res, "Could not open document"));
      }
    } catch (err) {
      showToast(`Could not reach the server: ${err.message}`);
    }
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
    await api("/api/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Rules saved");
    refreshAll();
  }

  async function loanAction(id, action, amount) {
    const res = await api(`/api/loans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, amount }) });
    if (res.ok) {
      showToast("Updated");
      refreshAll();
    } else showToast((await res.json()).error || "Failed");
  }

  async function sendComms(clientIds, message, template) {
    const res = await api("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds, message, template }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Reminder sent to ${data.sent} client${data.sent === 1 ? "" : "s"}`);
      refreshAll();
    } else {
      showToast(data.error || "Could not send reminder");
    }
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
    await api("/api/company", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Company profile saved");
    refreshAll();
  }

  async function addStaff(e) {
    e.preventDefault();
    const f = e.target;
    const tabs = [...f.querySelectorAll(".s-tab:checked")].map((c) => c.value);
    const body = { name: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value, role: f.role.value, tabs };
    if (!body.name || !body.email || !body.password) return showToast("Name, email and password required");
    const res = await api("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      f.reset();
      showToast("Staff member added — share their email and password with them so they can log in");
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
    await api("/api/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    await api("/api/landing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    showToast("Landing page saved");
  }

  const pageTitle = { dashboard: "Dashboard", clients: "Clients", rules: "Loan Rules", loans: "Loans", reports: "Reports", risk: "Risk", comms: "Communications", company: "Company Setup" }[page];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="company">{company.logoEmoji || "💠"} {company.name || "LENDA"}</div>
          <div className="powered">{company.tagline || "Microfinance Loan Admin"}</div>
        </div>
        {NAV.map((sec) => {
          const items = sec.items.filter(([key]) => myTabs.includes(key));
          if (items.length === 0) return null;
          return (
            <div key={sec.section}>
              <div className="nav-section">{sec.section}</div>
              {items.map(([key, icon, label]) => (
                <button key={key} className={`nav-item ${page === key ? "active" : ""}`} onClick={() => setPage(key)}>
                  <span className="icon">{icon}</span> {label}
                </button>
              ))}
            </div>
          );
        })}
        <div className="nav-section">Public pages</div>
        <a className="nav-item" href="/landing" target="_blank" rel="noreferrer"><span className="icon">🌐</span> Landing Page</a>
        <a className="nav-item" href="/portal" target="_blank" rel="noreferrer"><span className="icon">🙋</span> Client Portal</a>
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 12px" }}>Signed in as {me.role}</div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="page-title">{pageTitle}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-ghost" onClick={quickToggleTheme} title="Toggle dark/light mode">
              {adminTheme.mode === "light" ? "☀️" : "🌙"}
            </button>
            <div className="user-chip"><span className="user-dot"></span> {me.name}</div>
            <button className="btn btn-ghost" onClick={onSignOut}>Sign Out</button>
          </div>
        </div>

        <div className="content">
          {!myTabs.includes(page) ? <div className="card empty">You don&apos;t have access to this section.</div> : <>
          {page === "dashboard" && (
            <Dashboard clients={clients} loans={loans} activity={activity} rules={rules} setPage={setPage} />
          )}
          {page === "clients" && (
            <Clients
              clients={clients}
              loans={loans}
              rules={rules}
              onAdd={addClient}
              clientModal={clientModal}
              setClientModal={setClientModal}
              onUpdate={updateClient}
              onDelete={deleteClient}
              onUpload={uploadClientDocument}
              onDeleteDoc={deleteClientDocument}
              onViewDoc={viewClientDocument}
            />
          )}
          {page === "rules" && <Rules rules={rules} onSave={saveRules} />}
          {page === "loans" && <Loans loans={loans} clients={clients} onAction={loanAction} />}
          {page === "reports" && (
            <Reports
              clients={clients}
              loans={loans}
              rules={rules}
              company={company}
              reportsTab={reportsTab}
              setReportsTab={setReportsTab}
            />
          )}
          {page === "risk" && (
            <Risk
              clients={clients}
              loans={loans}
              onGoToComms={(clientId) => {
                setCommsPrefillClientId(clientId);
                setPage("comms");
              }}
            />
          )}
          {page === "comms" && (
            <Communications
              clients={clients}
              loans={loans}
              communications={communications}
              onSend={sendComms}
              prefillClientId={commsPrefillClientId}
              clearPrefill={() => setCommsPrefillClientId(null)}
            />
          )}
          {page === "company" && (
            <Company
              companyTab={companyTab}
              setCompanyTab={setCompanyTab}
              company={company}
              staff={staff}
              payments={payments}
              smsConfig={smsConfig}
              adminTheme={adminTheme}
              portalTheme={portalTheme}
              onSaveCompany={saveCompany}
              onAddStaff={addStaff}
              onSavePayments={savePayments}
              onSaveLanding={saveLanding}
              onSaveSms={saveSmsConfig}
              onSaveTheme={saveTheme}
            />
          )}
          </>}
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
  const counts = { pending: 0, reviewing: 0, approved: 0, active: 0, closed: 0, rejected: 0 };
  loans.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1));
  const pieData = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: badgeLabel(k), key: k, value: v }));

  const byMonth = {};
  loans.forEach((l) => {
    const m = (l.appliedDate || "").slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { month: m, amount: 0, count: 0 };
    byMonth[m].amount += l.amount || 0;
    byMonth[m].count += 1;
  });
  const barData = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

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
          {pieData.length === 0 ? <div className="empty">No loans yet</div> : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">📊 Disbursements, Last 6 Months</div></div>
        {barData.length === 0 ? <div className="empty">No loan history yet</div> : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => fmt(v)}
                />
                <Bar dataKey="amount" fill="#00E676" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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
    </>
  );
}

function badgeLabel(status) {
  const map = { pending: "Pending", reviewing: "In Review", approved: "Awarded", active: "Active", closed: "Paid", rejected: "Rejected" };
  return map[status] || status;
}

function Clients({ clients, loans, rules, onAdd, clientModal, setClientModal, onUpdate, onDelete, onUpload, onDeleteDoc, onViewDoc }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = !q
    ? clients
    : clients.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.nationalId || "").toLowerCase().includes(q)
      );

  const modalClient = clientModal ? clients.find((c) => c.id === clientModal.clientId) : null;

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
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or national ID…"
        />
        <div className="tablewrap"><table><tbody>
          <tr><th>Name</th><th>Phone</th><th>Income</th><th>Eligible Limit</th><th>Loan Status</th><th>Amount Awarded</th><th>Paid So Far</th><th>Amount Due</th><th>Actions</th></tr>
          {filtered.length === 0 ? (
            <tr><td colSpan={9} className="empty">{clients.length === 0 ? "No clients registered yet" : "No clients match your search"}</td></tr>
          ) : filtered.map((c) => {
            const e = eligibility(c, rules);
            const loan = currentLoanFor(c.id, loans);
            const awarded = loan && loan.totalDue ? loan.amount : null;
            const due = loan && loan.totalDue ? loan.totalDue - (loan.paidSoFar || 0) : null;
            return (
              <tr key={c.id}>
                <td>{c.name}</td><td className="mono">{c.phone}</td>
                <td className="mono">{fmt(c.income)}</td>
                <td>{e.qualifies ? fmt(e.maxLoan) : <span style={{ color: "var(--error)" }}>Not eligible</span>}</td>
                <td>{loan ? badge(loan.status) : <span className="mono" style={{ color: "var(--muted)" }}>No loan</span>}</td>
                <td className="mono">{awarded !== null ? fmt(awarded) : "—"}</td>
                <td className="mono">{loan && loan.totalDue ? fmt(loan.paidSoFar || 0) : "—"}</td>
                <td className="mono">{due !== null ? fmt(due) : "—"}</td>
                <td>
                  <div className="btn-row">
                    <button className="btn btn-ghost" onClick={() => setClientModal({ clientId: c.id, mode: "view" })}>View</button>
                    <button className="btn btn-ghost" onClick={() => setClientModal({ clientId: c.id, mode: "edit" })}>Edit</button>
                    <button
                      className="btn btn-error"
                      onClick={() => {
                        if (confirm(`Delete ${c.name}? This can't be undone.`)) onDelete(c.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody></table></div>
      </div>

      {modalClient && (
        <ClientModal
          client={modalClient}
          mode={clientModal.mode}
          onClose={() => setClientModal(null)}
          onSave={async (patch) => {
            const ok = await onUpdate(modalClient.id, patch);
            if (ok) setClientModal({ clientId: modalClient.id, mode: "view" });
          }}
          onDelete={async () => {
            if (confirm(`Delete ${modalClient.name}? This can't be undone.`)) {
              const ok = await onDelete(modalClient.id);
              if (ok) setClientModal(null);
            }
          }}
          onEdit={() => setClientModal({ clientId: modalClient.id, mode: "edit" })}
          onCancelEdit={() => setClientModal({ clientId: modalClient.id, mode: "view" })}
          onUpload={(file, label) => onUpload(modalClient.id, file, label)}
          onDeleteDoc={(docId) => onDeleteDoc(modalClient.id, docId)}
          onViewDoc={(docId) => onViewDoc(modalClient.id, docId)}
        />
      )}
    </>
  );
}

function ClientModal({ client, mode, onClose, onSave, onDelete, onEdit, onCancelEdit, onUpload, onDeleteDoc, onViewDoc }) {
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file, uploadLabel);
    setUploadLabel("");
    setUploading(false);
    e.target.value = "";
  }

  function handleSave(e) {
    e.preventDefault();
    const f = e.target;
    onSave({
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      nationalId: f.nationalId.value.trim(),
      income: Number(f.income.value) || 0,
      employment: f.employment.value,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title">{mode === "edit" ? `Edit ${client.name}` : client.name}</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        {mode === "edit" ? (
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div><label>Full name</label><input name="name" defaultValue={client.name} /></div>
              <div><label>Phone</label><input name="phone" defaultValue={client.phone} /></div>
              <div><label>Email</label><input name="email" type="email" defaultValue={client.email} /></div>
              <div><label>National ID No.</label><input name="nationalId" defaultValue={client.nationalId} /></div>
              <div><label>Monthly income (KES)</label><input name="income" type="number" defaultValue={client.income} /></div>
            </div>
            <label>Employment type</label>
            <select name="employment" defaultValue={client.employment}>
              {["Employed", "Self-employed", "Business owner", "Unemployed"].map((o) => <option key={o}>{o}</option>)}
            </select>
            <div className="btn-row">
              <button className="btn btn-green" type="submit">Save Changes</button>
              <button className="btn btn-ghost" type="button" onClick={onCancelEdit}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div className="stat-row"><span>Phone</span><b>{client.phone}</b></div>
            <div className="stat-row"><span>Email</span><b>{client.email || "—"}</b></div>
            <div className="stat-row"><span>National ID</span><b>{client.nationalId || "—"}</b></div>
            <div className="stat-row"><span>Monthly income</span><b>{fmt(client.income)}</b></div>
            <div className="stat-row"><span>Employment</span><b>{client.employment}</b></div>
            <div className="stat-row"><span>Client since</span><b>{client.dateJoined || "—"}</b></div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-green" onClick={onEdit}>Edit Client</button>
              <button className="btn btn-error" onClick={onDelete}>Delete Client</button>
            </div>
          </>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="card-title" style={{ marginBottom: 10 }}>📎 Documents</div>
          {(client.documents || []).length === 0 ? (
            <div className="empty" style={{ padding: 10 }}>No documents uploaded yet</div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {client.documents.map((d) => (
                <div className="doc-item" key={d.id}>
                  <div>
                    <div>{d.label || d.fileName}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(d.uploadedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-ghost" onClick={() => onViewDoc(d.id)}>View</button>
                    <button className="btn btn-error" onClick={() => onDeleteDoc(d.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <label>Document label (e.g. National ID Front, Proof of Income)</label>
          <input value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} placeholder="What is this document?" />
          <input type="file" onChange={handleFileChange} disabled={uploading} accept="image/*,application/pdf" />
          {uploading && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Uploading…</div>}
        </div>
      </div>
    </div>
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
              <td className="mono">{["pending", "reviewing", "rejected"].includes(l.status) ? "—" : `${fmt(l.paidSoFar)} / ${fmt(l.totalDue)}`}</td>
              <td>
                <div className="btn-row">
                  {l.status === "pending" && <button className="btn btn-ghost" onClick={() => onAction(l.id, "review")}>Start Review</button>}
                  {(l.status === "pending" || l.status === "reviewing") && <>
                    <button className="btn btn-green" onClick={() => onAction(l.id, "approve")}>Award</button>
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

function Reports({ clients, loans, rules, company, reportsTab, setReportsTab }) {
  return (
    <>
      <div className="btn-row no-print" style={{ marginBottom: 18 }}>
        <button className={`btn ${reportsTab === "company" ? "btn-green" : "btn-ghost"}`} onClick={() => setReportsTab("company")}>Company Reports</button>
        <button className={`btn ${reportsTab === "client" ? "btn-green" : "btn-ghost"}`} onClick={() => setReportsTab("client")}>Client Reports</button>
      </div>
      {reportsTab === "company" ? (
        <CompanyReport clients={clients} loans={loans} company={company} />
      ) : (
        <ClientReport clients={clients} loans={loans} rules={rules} company={company} />
      )}
    </>
  );
}

function CompanyReport({ clients, loans, company }) {
  const disbursed = loans.filter((l) => ["active", "closed"].includes(l.status));
  const totalDisbursed = disbursed.reduce((s, l) => s + (l.amount || 0), 0);
  const totalCollected = loans.reduce((s, l) => s + (l.paidSoFar || 0), 0);
  const totalOutstanding = loans.filter((l) => l.status === "active").reduce((s, l) => s + ((l.totalDue || 0) - (l.paidSoFar || 0)), 0);
  const interestEarned = loans.filter((l) => l.status === "closed").reduce((s, l) => s + ((l.totalDue || 0) - (l.amount || 0)), 0);
  const interestExpected = loans.filter((l) => l.status === "active").reduce((s, l) => s + ((l.totalDue || 0) - (l.amount || 0)), 0);
  const overdue = loans.filter((l) => l.status === "active" && daysUntil(l.dueDate) < 0);
  const overdueAmount = overdue.reduce((s, l) => s + ((l.totalDue || 0) - (l.paidSoFar || 0)), 0);
  const avgLoan = disbursed.length ? Math.round(totalDisbursed / disbursed.length) : 0;

  const counts = { pending: 0, reviewing: 0, approved: 0, active: 0, closed: 0, rejected: 0 };
  loans.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1));
  const pieData = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: badgeLabel(k), key: k, value: v }));

  const byMonth = {};
  loans.forEach((l) => {
    const m = (l.appliedDate || "").slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { month: m, count: 0, amount: 0 };
    byMonth[m].count += 1;
    byMonth[m].amount += l.amount || 0;
  });
  const barData = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

  function exportCompanyCSV() {
    const rows = [["Client", "Phone", "Amount", "Status", "Applied", "Due Date", "Paid", "Balance"]];
    loans.forEach((l) => {
      const c = clients.find((x) => x.id === l.clientId);
      rows.push([
        c ? c.name : "Unknown",
        c ? c.phone : "",
        l.amount,
        l.status,
        l.appliedDate || "",
        l.dueDate || "",
        l.paidSoFar || 0,
        (l.totalDue || 0) - (l.paidSoFar || 0),
      ]);
    });
    downloadCSV(`${(company.name || "lenda").replace(/\s+/g, "_")}_loan_report.csv`, rows);
  }

  return (
    <>
      <div className="card no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print</button>
        <button className="btn btn-green" onClick={exportCompanyCSV}>⬇️ Export CSV</button>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div className="card-title" style={{ fontSize: 18 }}>{company.name || "LENDA"} — Portfolio Report</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Generated {new Date().toLocaleString()}</div>
      </div>

      <div className="stats-grid">
        <div className="stat green"><div className="stat-label">Total Disbursed</div><div className="stat-value mono">{fmt(totalDisbursed)}</div></div>
        <div className="stat blue"><div className="stat-label">Total Collected</div><div className="stat-value mono">{fmt(totalCollected)}</div></div>
        <div className="stat gold"><div className="stat-label">Outstanding</div><div className="stat-value mono">{fmt(totalOutstanding)}</div></div>
        <div className="stat pink"><div className="stat-label">Overdue</div><div className="stat-value pink">{overdue.length} ({fmt(overdueAmount)})</div></div>
        <div className="stat muted"><div className="stat-label">Interest Earned</div><div className="stat-value mono">{fmt(interestEarned)}</div></div>
        <div className="stat muted"><div className="stat-label">Interest Expected</div><div className="stat-value mono">{fmt(interestExpected)}</div></div>
        <div className="stat muted"><div className="stat-label">Avg. Loan Size</div><div className="stat-value mono">{fmt(avgLoan)}</div></div>
        <div className="stat muted"><div className="stat-label">Total Clients</div><div className="stat-value">{clients.length}</div></div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Loan Portfolio by Status</div></div>
        {pieData.length === 0 ? <div className="empty">No loans yet</div> : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Loans Disbursed by Month</div></div>
        {barData.length === 0 ? <div className="empty">No loan history yet</div> : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => fmt(v)}
                />
                <Bar dataKey="amount" fill="#00E676" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}

function ClientReport({ clients, loans, rules, company }) {
  const [clientId, setClientId] = useState("");
  const client = clients.find((c) => c.id === clientId);
  const clientLoans = client ? loans.filter((l) => l.clientId === client.id) : [];

  function exportClientCSV() {
    const rows = [["Amount", "Status", "Applied", "Due Date", "Total Due", "Paid", "Balance"]];
    clientLoans.forEach((l) => {
      rows.push([l.amount, l.status, l.appliedDate || "", l.dueDate || "", l.totalDue || 0, l.paidSoFar || 0, (l.totalDue || 0) - (l.paidSoFar || 0)]);
    });
    downloadCSV(`${(client?.name || "client").replace(/\s+/g, "_")}_loan_history.csv`, rows);
  }

  const totalBorrowed = clientLoans.reduce((s, l) => s + (l.amount || 0), 0);
  const totalRepaid = clientLoans.reduce((s, l) => s + (l.paidSoFar || 0), 0);
  const e = client ? eligibility(client, rules) : null;

  return (
    <>
      <div className="card no-print">
        <div className="card-header"><div className="card-title">Select a Client</div></div>
        <select value={clientId} onChange={(ev) => setClientId(ev.target.value)}>
          <option value="">-- choose a client --</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
        </select>
      </div>

      {!client ? (
        <div className="card empty">Select a client above to generate their report.</div>
      ) : (
        <>
          <div className="card no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print</button>
            <button className="btn btn-green" onClick={exportClientCSV}>⬇️ Export CSV</button>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div className="card-title" style={{ fontSize: 18 }}>{company.name || "LENDA"} — Client Report</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Generated {new Date().toLocaleString()}</div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>{client.name}</div>
            <div className="stat-row"><span>Phone</span><b>{client.phone}</b></div>
            <div className="stat-row"><span>National ID</span><b>{client.nationalId || "—"}</b></div>
            <div className="stat-row"><span>Monthly income</span><b>{fmt(client.income)}</b></div>
            <div className="stat-row"><span>Employment</span><b>{client.employment}</b></div>
            <div className="stat-row"><span>Client since</span><b>{client.dateJoined || "—"}</b></div>
            <div className="stat-row"><span>Current qualifying limit</span><b>{e.qualifies ? fmt(e.maxLoan) : "Not eligible"}</b></div>
          </div>

          <div className="stats-grid">
            <div className="stat green"><div className="stat-label">Total Borrowed</div><div className="stat-value mono">{fmt(totalBorrowed)}</div></div>
            <div className="stat blue"><div className="stat-label">Total Repaid</div><div className="stat-value mono">{fmt(totalRepaid)}</div></div>
            <div className="stat muted"><div className="stat-label">Loans Taken</div><div className="stat-value">{clientLoans.length}</div></div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Loan History</div></div>
            <div className="tablewrap"><table><tbody>
              <tr><th>Amount</th><th>Status</th><th>Applied</th><th>Due</th><th>Total Due</th><th>Paid</th><th>Balance</th></tr>
              {clientLoans.length === 0 ? <tr><td colSpan={7} className="empty">No loans on record</td></tr> : clientLoans.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{fmt(l.amount)}</td>
                  <td>{badge(l.status)}</td>
                  <td>{l.appliedDate || "—"}</td>
                  <td>{l.dueDate || "—"}</td>
                  <td className="mono">{l.totalDue ? fmt(l.totalDue) : "—"}</td>
                  <td className="mono">{l.paidSoFar ? fmt(l.paidSoFar) : "—"}</td>
                  <td className="mono">{l.totalDue ? fmt((l.totalDue || 0) - (l.paidSoFar || 0)) : "—"}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        </>
      )}
    </>
  );
}

const STALE_PAYMENT_DAYS = 30;
const DUE_SOON_DAYS = 7;

function riskInfo(loan) {
  const d = daysUntil(loan.dueDate);
  const balance = (loan.totalDue || 0) - (loan.paidSoFar || 0);
  const overdue = loan.status === "active" && d !== null && d < 0 && balance > 0;
  const dueSoon = loan.status === "active" && d !== null && d >= 0 && d <= DUE_SOON_DAYS && balance > 0;
  const lastPayment = loan.payments && loan.payments.length ? loan.payments[loan.payments.length - 1].date : null;
  const daysSinceLastPayment = lastPayment ? Math.floor((new Date() - new Date(lastPayment)) / 86400000) : null;
  const daysSinceDisbursed = loan.disbursedDate ? Math.floor((new Date() - new Date(loan.disbursedDate)) / 86400000) : null;
  const stopped =
    loan.status === "active" &&
    balance > 0 &&
    ((lastPayment === null && daysSinceDisbursed !== null && daysSinceDisbursed > STALE_PAYMENT_DAYS) ||
      (daysSinceLastPayment !== null && daysSinceLastPayment > STALE_PAYMENT_DAYS));
  return { overdue, dueSoon, stopped, daysOverdue: d !== null && d < 0 ? -d : 0, daysSinceLastPayment, balance };
}

function Risk({ clients, loans, onGoToComms }) {
  const rows = loans
    .filter((l) => l.status === "active")
    .map((l) => ({ loan: l, client: clients.find((c) => c.id === l.clientId), risk: riskInfo(l) }))
    .filter((r) => r.client);

  const overdue = rows.filter((r) => r.risk.overdue);
  const dueSoon = rows.filter((r) => r.risk.dueSoon);
  const stopped = rows.filter((r) => r.risk.stopped);

  function Section({ title, icon, items, note }) {
    return (
      <div className="card">
        <div className="card-header"><div className="card-title">{icon} {title} ({items.length})</div></div>
        {note && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{note}</div>}
        {items.length === 0 ? <div className="empty">None right now</div> : (
          <div className="tablewrap"><table><tbody>
            <tr><th>Client</th><th>Phone</th><th>Amount Due</th><th>Detail</th><th>Action</th></tr>
            {items.map(({ loan, client, risk }) => (
              <tr key={loan.id}>
                <td>{client.name}</td>
                <td className="mono">{client.phone}</td>
                <td className="mono">{fmt(risk.balance)}</td>
                <td style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {risk.overdue && `${risk.daysOverdue} day${risk.daysOverdue === 1 ? "" : "s"} overdue`}
                  {!risk.overdue && risk.dueSoon && `Due ${loan.dueDate}`}
                  {!risk.overdue && !risk.dueSoon && risk.stopped && (
                    risk.daysSinceLastPayment !== null
                      ? `No payment in ${risk.daysSinceLastPayment} days`
                      : "No payment received yet"
                  )}
                </td>
                <td><button className="btn btn-ghost" onClick={() => onGoToComms(client.id)}>Send Reminder</button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>
    );
  }

  return (
    <>
      <Section title="Overdue" icon="🔴" items={overdue} />
      <Section title="Due Soon" icon="🟡" items={dueSoon} note={`Due within the next ${DUE_SOON_DAYS} days.`} />
      <Section
        title="Stopped Paying"
        icon="🚩"
        items={stopped}
        note={`No payment recorded in over ${STALE_PAYMENT_DAYS} days, based on the payment log. Loans awarded before this feature was added won't have a payment history yet, so this list will fill in as new payments are recorded.`}
      />
    </>
  );
}

const REMINDER_TEMPLATES = {
  due_soon: (client, loan) =>
    `Hi ${client.name}, this is a reminder that your loan payment of ${fmt((loan?.totalDue || 0) - (loan?.paidSoFar || 0))} is due on ${loan?.dueDate || "your due date"}. Please make your payment on time to stay in good standing.`,
  overdue: (client, loan) =>
    `Hi ${client.name}, your loan payment of ${fmt((loan?.totalDue || 0) - (loan?.paidSoFar || 0))} was due on ${loan?.dueDate || "your due date"} and is now overdue. Please make your payment as soon as possible.`,
  custom: () => "",
};

function Communications({ clients, loans, communications, onSend, prefillClientId, clearPrefill }) {
  const [audience, setAudience] = useState("single");
  const [clientId, setClientId] = useState("");
  const [template, setTemplate] = useState("due_soon");
  const [message, setMessage] = useState(REMINDER_TEMPLATES.due_soon({ name: "there" }, null));

  useEffect(() => {
    if (prefillClientId) {
      setAudience("single");
      setClientId(prefillClientId);
      clearPrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillClientId]);

  function applyTemplate(key, forClient) {
    setTemplate(key);
    const client = forClient || clients.find((c) => c.id === clientId) || { name: "there" };
    const loan = currentLoanFor(client.id, loans);
    setMessage(REMINDER_TEMPLATES[key](client, loan));
  }

  function targetClientIds() {
    if (audience === "single") return clientId ? [clientId] : [];
    if (audience === "overdue") return loans.filter((l) => l.status === "active" && daysUntil(l.dueDate) < 0).map((l) => l.clientId);
    if (audience === "dueSoon") return loans.filter((l) => l.status === "active" && daysUntil(l.dueDate) >= 0 && daysUntil(l.dueDate) <= DUE_SOON_DAYS).map((l) => l.clientId);
    if (audience === "active") return loans.filter((l) => l.status === "active").map((l) => l.clientId);
    return [];
  }

  function handleSend(e) {
    e.preventDefault();
    const ids = [...new Set(targetClientIds())];
    if (ids.length === 0) return;
    onSend(ids, message, template);
  }

  const recipientCount = new Set(targetClientIds()).size;

  return (
    <>
      <div className="card">
        <div className="card-header"><div className="card-title">📨 Send a Reminder</div></div>
        <form onSubmit={handleSend}>
          <label>Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="single">Single client</option>
            <option value="overdue">All overdue clients</option>
            <option value="dueSoon">All clients due soon (next {DUE_SOON_DAYS} days)</option>
            <option value="active">All clients with an active loan</option>
          </select>

          {audience === "single" && (
            <>
              <label>Client</label>
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); applyTemplate(template, clients.find((c) => c.id === e.target.value)); }}>
                <option value="">-- choose a client --</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            </>
          )}

          <label>Template</label>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button type="button" className={`btn ${template === "due_soon" ? "btn-green" : "btn-ghost"}`} onClick={() => applyTemplate("due_soon")}>Payment Due Soon</button>
            <button type="button" className={`btn ${template === "overdue" ? "btn-green" : "btn-ghost"}`} onClick={() => applyTemplate("overdue")}>Payment Overdue</button>
            <button type="button" className={`btn ${template === "custom" ? "btn-green" : "btn-ghost"}`} onClick={() => { setTemplate("custom"); setMessage(""); }}>Custom</button>
          </div>

          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, color: "var(--text)", fontFamily: "'DM Sans',sans-serif", fontSize: 13, marginBottom: 10 }}
          />

          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            Will send to {recipientCount} client{recipientCount === 1 ? "" : "s"}. This logs the reminder here — it doesn&apos;t yet dispatch a real SMS/email/WhatsApp message (see README to wire up a provider).
          </div>
          <button className="btn btn-green" type="submit" disabled={recipientCount === 0 || !message.trim()}>Send Reminder</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📜 Reminder Log</div></div>
        {communications.length === 0 ? <div className="empty">No reminders sent yet</div> : (
          <div className="tablewrap"><table><tbody>
            <tr><th>Client</th><th>Template</th><th>Message</th><th>Sent</th></tr>
            {communications.map((c) => (
              <tr key={c.id}>
                <td>{c.clientName}</td>
                <td style={{ textTransform: "capitalize" }}>{(c.template || "custom").replace("_", " ")}</td>
                <td style={{ maxWidth: 320, whiteSpace: "normal" }}>{c.message}</td>
                <td className="mono">{new Date(c.sentAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>
    </>
  );
}

function Company({ companyTab, setCompanyTab, company, staff, payments, smsConfig, adminTheme, portalTheme, onSaveCompany, onAddStaff, onSavePayments, onSaveLanding, onSaveSms, onSaveTheme }) {
  const tabs = [
    ["profile", "Profile & Contact"],
    ["staff", "Staff & Access"],
    ["payments", "Payment Methods"],
    ["landing", "Landing Page Content"],
    ["sms", "SMS Provider"],
    ["adminTheme", "Admin Theme"],
    ["portalTheme", "Portal Theme"],
  ];
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
                <div><label>Email</label><input name="email" type="email" /></div>
              </div>
              <label>Temporary Password (share this with them to log in)</label>
              <input name="password" type="text" minLength={6} placeholder="At least 6 characters" />
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
              Each staff member signs in with the email and password set here, and only sees the tabs checked above. Note: this is enforced in the dashboard itself — a signed-in staff member can still reach any staff-only API route directly regardless of their tabs, since that's a coarser check (any staff vs. no staff) rather than per-tab.
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

      {companyTab === "sms" && <SmsProviderForm smsConfig={smsConfig} onSave={onSaveSms} />}

      {companyTab === "adminTheme" && (
        <ThemeForm
          title="🖥️ Admin Panel Theme"
          theme={adminTheme}
          showBackground={false}
          showCardStyle={false}
          showLogo={false}
          onSave={(next) => onSaveTheme({ admin: next, portal: portalTheme })}
        />
      )}

      {companyTab === "portalTheme" && (
        <ThemeForm
          title="🌐 Landing Page & Client Portal Theme"
          theme={portalTheme}
          showBackground={true}
          showCardStyle={true}
          showLogo={true}
          onSave={(next) => onSaveTheme({ admin: adminTheme, portal: next })}
        />
      )}
    </>
  );
}

function SmsProviderForm({ smsConfig, onSave }) {
  const [provider, setProvider] = useState(smsConfig.provider || "");
  const [apiKey, setApiKey] = useState(smsConfig.apiKey || "");
  const [username, setUsername] = useState(smsConfig.username || "");
  const [senderId, setSenderId] = useState(smsConfig.senderId || "");

  useEffect(() => {
    setProvider(smsConfig.provider || "");
    setApiKey(smsConfig.apiKey || "");
    setUsername(smsConfig.username || "");
    setSenderId(smsConfig.senderId || "");
  }, [smsConfig]);

  const meta = SMS_PROVIDERS.find((p) => p.key === provider);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ provider, apiKey, username, senderId });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
        <div className="card-header"><div className="card-title">📱 SMS Provider</div></div>
        <label>Select SMS Provider</label>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 16 }}>
          {SMS_PROVIDERS.map((p) => (
            <div
              key={p.key}
              onClick={() => setProvider(p.key)}
              style={{
                cursor: "pointer",
                textAlign: "center",
                padding: "16px 10px",
                borderRadius: 10,
                border: `1.5px solid ${provider === p.key ? "var(--accent)" : "var(--border)"}`,
                background: "var(--surface2)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{p.name}</div>
              {p.recommended && <span className="badge b-approved">Recommended</span>}
              {p.wired ? (
                <div style={{ fontSize: 10.5, color: "var(--accent)", marginTop: 4 }}>✓ Live sending</div>
              ) : (
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>Not yet wired to send</div>
              )}
            </div>
          ))}
        </div>

        {provider && FIELD_LABELS[provider]?.note && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
            {FIELD_LABELS[provider].note}
          </div>
        )}

        {provider && (
          <>
            <div className="form-grid">
              <div><label>{FIELD_LABELS[provider]?.apiKey || "API Key"}</label><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></div>
              <div><label>{FIELD_LABELS[provider]?.username || "Username"}</label><input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            </div>
            <label>{FIELD_LABELS[provider]?.senderId || "Sender ID"}</label>
            <input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="e.g. HAMBILOANS" />
            {!meta?.wired && (
              <div style={{ fontSize: 12, color: "var(--gold)", marginBottom: 10 }}>
                {meta?.name} isn&apos;t connected to a live sending integration yet — reminders will still be logged on the Communications page, just not delivered by SMS until this is wired up.
              </div>
            )}
            <button className="btn btn-green" type="submit">Save SMS Settings</button>
          </>
        )}
      </div>
    </form>
  );
}

function ThemeForm({ title, theme, showBackground, showCardStyle, showLogo, onSave }) {
  const initialBg = parseBackgroundImage(theme.backgroundImage || "");
  const [mode, setMode] = useState(theme.mode);
  const [accent, setAccent] = useState(theme.accent);
  const [font, setFont] = useState(theme.font);
  const [backgroundColor, setBackgroundColor] = useState(theme.backgroundColor || "");
  const [bgPreset, setBgPreset] = useState(initialBg.presetKey);
  const [bgCustomUrl, setBgCustomUrl] = useState(initialBg.customUrl);
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl || "");
  const [cardStyle, setCardStyle] = useState(theme.cardStyle || "default");

  useEffect(() => {
    const bg = parseBackgroundImage(theme.backgroundImage || "");
    setMode(theme.mode);
    setAccent(theme.accent);
    setFont(theme.font);
    setBackgroundColor(theme.backgroundColor || "");
    setBgPreset(bg.presetKey);
    setBgCustomUrl(bg.customUrl);
    setLogoUrl(theme.logoUrl || "");
    setCardStyle(theme.cardStyle || "default");
  }, [theme]);

  const backgroundImage = buildBackgroundImage(bgPreset, bgCustomUrl);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ mode, accent, font, backgroundColor, backgroundImage, logoUrl, cardStyle });
  }

  const previewPalette = { dark: "#080D14", light: "#f4f6f8", midnight: "#0b0620", forest: "#07140d" }[mode] || "#080D14";
  const previewText = { dark: "#E8F0FE", light: "#111a24", midnight: "#EDE9FE", forest: "#E6F4EA" }[mode] || "#E8F0FE";
  const previewBg = backgroundImage || (backgroundColor || previewPalette);
  const previewCardBg =
    cardStyle === "glass" ? "rgba(255,255,255,0.08)" : cardStyle === "minimal" ? "transparent" : mode === "light" ? "#ffffff" : "#0D1520";

  return (
    <div className={showBackground ? "grid-2" : ""}>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header"><div className="card-title">{title}</div></div>

          <label>Mode</label>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
            {MODE_OPTIONS.map((m) => (
              <div
                key={m.key}
                onClick={() => setMode(m.key)}
                style={{ cursor: "pointer", textAlign: "center", padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${mode === m.key ? "var(--accent)" : "var(--border)"}`, background: "var(--surface2)" }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</div>
              </div>
            ))}
          </div>

          <label>Accent Color</label>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {ACCENT_OPTIONS.map((a) => (
              <div
                key={a.value}
                onClick={() => setAccent(a.value)}
                title={a.name}
                style={{ width: 34, height: 34, borderRadius: "50%", background: a.value, cursor: "pointer", border: accent === a.value ? "3px solid var(--text)" : "3px solid transparent" }}
              />
            ))}
          </div>

          <label>Font</label>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 16 }}>
            {FONT_OPTIONS.map((f) => (
              <div
                key={f.value}
                onClick={() => setFont(f.value)}
                style={{ cursor: "pointer", textAlign: "center", padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${font === f.value ? "var(--accent)" : "var(--border)"}`, background: "var(--surface2)", fontFamily: f.value }}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>Aa</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Sans',sans-serif" }}>{f.name}</div>
              </div>
            ))}
          </div>

          {showBackground && (
            <>
              <label>Background Color (optional override)</label>
              <input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} placeholder="#080D14" />

              <label>Background Image</label>
              <div className="form-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 10 }}>
                {BACKGROUND_PRESETS.map((p) => (
                  <div
                    key={p.key}
                    onClick={() => setBgPreset(p.key)}
                    title={p.name}
                    style={{
                      cursor: "pointer",
                      height: 48,
                      borderRadius: 8,
                      border: `2px solid ${bgPreset === p.key ? "var(--accent)" : "var(--border)"}`,
                      background: p.css || "var(--surface2)",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#fff", background: "rgba(0,0,0,.45)", width: "100%", textAlign: "center", padding: "2px 0" }}>{p.name}</span>
                  </div>
                ))}
                <div
                  onClick={() => setBgPreset("custom")}
                  style={{ cursor: "pointer", height: 48, borderRadius: 8, border: `2px solid ${bgPreset === "custom" ? "var(--accent)" : "var(--border)"}`, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}
                >
                  Custom URL
                </div>
              </div>
              {bgPreset === "custom" && (
                <input value={bgCustomUrl} onChange={(e) => setBgCustomUrl(e.target.value)} placeholder="Or paste image URL..." />
              )}
            </>
          )}

          {showLogo && (
            <>
              <label>Company Logo URL (optional — falls back to the emoji logo if empty)</label>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </>
          )}

          {showCardStyle && (
            <>
              <label>Card Style</label>
              <div className="btn-row" style={{ marginBottom: 16 }}>
                {CARD_STYLE_OPTIONS.map((c) => (
                  <button key={c.key} type="button" className={`btn ${cardStyle === c.key ? "btn-green" : "btn-ghost"}`} onClick={() => setCardStyle(c.key)}>{c.label}</button>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-green" type="submit">Save Theme</button>
        </div>
      </form>

      {showBackground && (
        <div className="card">
          <div className="card-header"><div className="card-title">Live Preview</div></div>
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              minHeight: 280,
              background: previewBg,
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                background: previewCardBg,
                backdropFilter: cardStyle === "glass" ? "blur(8px)" : "none",
                border: cardStyle === "minimal" ? "none" : "1px solid rgba(255,255,255,.15)",
                borderRadius: 14,
                padding: "28px 24px",
                textAlign: "center",
                maxWidth: 260,
                color: previewText,
                fontFamily: font,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" style={{ height: 32, marginBottom: 10 }} />
              ) : (
                <div style={{ fontSize: 28, marginBottom: 10 }}>💠</div>
              )}
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Loans that fit your business</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>Apply in minutes. Get a decision fast.</div>
              <div style={{ display: "inline-block", background: accent, color: "#04150c", fontWeight: 700, fontSize: 12.5, padding: "8px 18px", borderRadius: 8 }}>
                Get Started →
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
            Preview updates as you pick options below — nothing is live on the real page until you click Save Theme.
          </div>
        </div>
      )}
    </div>
  );
}

function LandingForm({ onSave }) {
  const [landing, setLanding] = useState(null);
  useEffect(() => {
    api("/api/landing").then((r) => r.json()).then(setLanding);
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

// Gates the whole admin dashboard behind real Supabase Auth. Three states:
// no staff account exists anywhere yet (first-run setup), a staff account
// exists but this browser isn't signed in (login), or signed in (the app).
export default function AuthGate() {
  const [status, setStatus] = useState("loading"); // loading | setup | login | ready | error
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const checkSession = useCallback(async () => {
    setError("");
    setStatus("loading");
    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (err) {
      setError(err.message);
      setStatus("error");
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Not signed in: is this a brand-new install with no staff yet
        // (show first-run setup) or an existing one (show login)? If this
        // check itself fails we show the real error rather than guessing —
        // guessing "login" used to trap people on a fresh install with no
        // way to create the first admin and no explanation why. Showing the
        // setup form optimistically is safe: the server independently
        // refuses to create an admin once any staff member exists.
        const bootRes = await fetch("/api/staff/bootstrap");
        let bootData = {};
        try {
          bootData = await bootRes.json();
        } catch (e) {}
        if (!bootRes.ok) {
          throw new Error(bootData.error || `Could not check setup status (server returned ${bootRes.status})`);
        }
        setStatus(bootData.hasStaff ? "login" : "setup");
        return;
      }

      const meRes = await api("/api/staff/me");
      if (meRes.ok) {
        setMe(await meRes.json());
        setStatus("ready");
      } else if (meRes.status === 401 || meRes.status === 404) {
        // Genuinely not a staff account (e.g. a client who signed in here).
        setError("This account isn't registered as staff.");
        await supabase.auth.signOut();
        setStatus("login");
      } else {
        let msg = "";
        try {
          msg = (await meRes.json()).error;
        } catch (e) {}
        throw new Error(msg || `Could not load your staff profile (server returned ${meRes.status})`);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  async function handleSignOut() {
    try {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
    } catch (e) {}
    setMe(null);
    setStatus("login");
  }

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080D14" }}>
        <div style={{ color: "#5C7A99" }}>Loading…</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <AuthScreen title="⚠️ Something's not right" subtitle="The dashboard couldn't finish loading. Here's what went wrong:">
        <div style={{ color: "var(--error)", fontSize: 13, marginBottom: 16, wordBreak: "break-word" }}>{error}</div>
        <button className="btn btn-green" style={{ width: "100%" }} onClick={checkSession}>Try Again</button>
      </AuthScreen>
    );
  }

  if (status === "setup") return <SetupForm onDone={checkSession} initialError={error} />;
  if (status === "login") return <StaffLoginForm onSignedIn={checkSession} initialError={error} />;
  return <AdminApp me={me} onSignOut={handleSignOut} />;
}

function AuthScreen({ title, subtitle, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080D14", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#0D1520", border: "1.5px solid #1A2E45", borderRadius: 16, padding: 28 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#00E676", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#5C7A99", marginBottom: 20 }}>{subtitle}</div>
        {children}
      </div>
    </div>
  );
}

function SetupForm({ onDone, initialError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || "");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = e.target;
    try {
      const name = f.name.value.trim();
      const email = f.email.value.trim();
      const password = f.password.value;

      const res = await fetch("/api/staff/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the admin account");

      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      onDone();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen title="💠 Set Up Hambi Loans" subtitle="No admin account exists yet — create the first one to get started. It will have full access to every section.">
      <form onSubmit={handleSubmit}>
        <label>Your full name</label>
        <input name="name" required />
        <label>Email</label>
        <input name="email" type="email" required />
        <label>Password</label>
        <input name="password" type="password" minLength={6} required />
        {error && <div style={{ color: "var(--error)", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-green" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Setting up…" : "Create Admin Account"}
        </button>
      </form>
    </AuthScreen>
  );
}

function StaffLoginForm({ onSignedIn, initialError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || "");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = e.target;
    try {
      const email = f.email.value.trim();
      const password = f.password.value;
      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onSignedIn();
    } catch (err) {
      setError(err.message || "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen title="💠 Staff Login" subtitle="Sign in to manage loans, clients and settings.">
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input name="email" type="email" required />
        <label>Password</label>
        <input name="password" type="password" required />
        {error && <div style={{ color: "var(--error)", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-green" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </AuthScreen>
  );
}
