import "./globals.css";

export const metadata = {
  title: "LENDA — Microfinance Loan Manager",
  description: "Loan management system for microfinance businesses",
};

const themeInit = `
(function(){
  try{
    var t = localStorage.getItem('lenda-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&family=Space+Grotesk:wght@400;500;700&family=Playfair+Display:wght@400;600;700&family=JetBrains+Mono:wght@400;500&family=Fredoka:wght@400;500;600&family=Oswald:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
