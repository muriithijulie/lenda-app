export function eligibility(client, rules) {
  const incomeOk = client.income >= rules.minIncome;
  const empOk = rules.allowed.includes(client.employment);
  const maxLoan = Math.round(client.income * rules.maxMultiplier);
  return { qualifies: incomeOk && empOk, maxLoan, incomeOk, empOk };
}

export function fmt(n) {
  return "KES " + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
