import { getValue } from "../../lib/store";
import AuthPanel from "../../components/AuthPanel";
import { DEFAULT_PORTAL_THEME } from "../../lib/theme";

export const dynamic = "force-dynamic";

const FALLBACK_COMPANY = { name: "Hambi Loans", logoEmoji: "💠" };
const FALLBACK_LANDING = {
  heroTitle: "Loans that fit your business",
  heroSubtitle: "Apply in minutes. Get a decision fast.",
  aboutText: "",
  features: [],
};
const FALLBACK_PAYMENTS = {};

export default async function LandingPage() {
  let company = FALLBACK_COMPANY;
  let landing = FALLBACK_LANDING;
  let payments = FALLBACK_PAYMENTS;
  let theme = DEFAULT_PORTAL_THEME;
  let loadError = "";

  try {
    const [companyData, landingData, paymentsData, themeData] = await Promise.all([
      getValue("company"),
      getValue("landing"),
      getValue("payments"),
      getValue("theme"),
    ]);
    company = companyData;
    landing = landingData;
    payments = paymentsData;
    if (themeData?.portal) theme = themeData.portal;
  } catch (err) {
    loadError = err.message || "Could not load site content";
  }

  const features = landing.features || [];
  const rootStyle = {
    "--accent": theme.accent || "#00E676",
    "--font-main": theme.font || "'DM Sans', sans-serif",
    ...(theme.backgroundColor ? { "--bg": theme.backgroundColor } : {}),
  };

  return (
    <div className="landing-wrap" data-theme={theme.mode || "dark"} data-card-style={theme.cardStyle || "default"} style={rootStyle}>
      {theme.backgroundImage && (
        <style>{`body{background-image:url('${theme.backgroundImage}');background-size:cover;background-position:center;background-attachment:fixed;}`}</style>
      )}
      {loadError && (
        <div className="card" style={{ borderColor: "rgba(255,82,82,.4)" }}>
          <div style={{ color: "var(--error)", fontSize: 12.5 }}>
            Some site content couldn&apos;t load ({loadError}). You can still sign up or log in below.
          </div>
        </div>
      )}
      <div className="hero">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={company.name} style={{ height: 48, marginBottom: 10 }} />
        ) : (
          <div style={{ fontSize: 40, marginBottom: 10 }}>{company.logoEmoji || "💠"}</div>
        )}
        <div style={{ fontFamily: "var(--font-main)", fontSize: 15, color: "var(--accent)", fontWeight: 800, letterSpacing: 1 }}>
          {company.name || "Hambi Loans"}
        </div>
        <h1>{landing.heroTitle}</h1>
        <p>{landing.heroSubtitle}</p>
        <a className="btn btn-green" style={{ padding: "12px 26px", display: "inline-block" }} href="#auth-panel">
          Get Started →
        </a>
      </div>

      <AuthPanel />

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
