import { getValue } from "../../lib/store";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const company = await getValue("company");
  const landing = await getValue("landing");
  const payments = await getValue("payments");
  const features = landing.features || [];

  return (
    <div className="landing-wrap">
      <div className="hero">
        <div style={{ fontSize: 40, marginBottom: 10 }}>{company.logoEmoji || "💠"}</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, color: "var(--green)", fontWeight: 800, letterSpacing: 1 }}>
          {company.name || "LENDA"}
        </div>
        <h1>{landing.heroTitle}</h1>
        <p>{landing.heroSubtitle}</p>
        <a className="btn btn-green" style={{ padding: "12px 26px", display: "inline-block" }} href="/portal">
          Apply for a Loan →
        </a>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 700, margin: "0 auto", textAlign: "center" }}>{landing.aboutText}</div>
      </div>

      <div className="grid-3">
        {features.map((f, i) => (
          <div className="card" key={i}>
            <div className="card-title" style={{ marginBottom: 6 }}>✅ {f.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📞 Get in Touch</div></div>
        <div className="stat-row"><span>Phone</span><b>{company.carePhone || "—"}</b></div>
        <div className="stat-row"><span>Email</span><b>{company.careEmail || "—"}</b></div>
        <div className="stat-row"><span>WhatsApp</span><b>{company.careWhatsapp || "—"}</b></div>
        <div className="stat-row"><span>Website</span><b>{company.website || "—"}</b></div>
        <div className="stat-row"><span>Address</span><b>{company.address || "—"}</b></div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">💳 How to Pay</div></div>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>M-Pesa Paybill</div>
            <div className="stat-row"><span>Paybill No.</span><b>{payments.mpesaPaybill || "—"}</b></div>
            <div className="stat-row"><span>Account</span><b>{payments.mpesaAccount || "—"}</b></div>
            {payments.mpesaInstructions && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{payments.mpesaInstructions}</div>}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Bank Transfer</div>
            <div className="stat-row"><span>Bank</span><b>{payments.bankName || "—"}</b></div>
            <div className="stat-row"><span>Account name</span><b>{payments.bankAccountName || "—"}</b></div>
            <div className="stat-row"><span>Account no.</span><b>{payments.bankAccountNumber || "—"}</b></div>
            <div className="stat-row"><span>Branch</span><b>{payments.bankBranch || "—"}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}
