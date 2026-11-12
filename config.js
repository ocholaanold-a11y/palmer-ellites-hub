// Palmer Ellites Hub (PEH) — public website configuration.
// To enable accounts and secure order storage, replace these values with
// Supabase Project URL and *publishable/anon* key ONLY.
// Never put a Supabase service_role key, Stripe secret, or other secret here.
window.PEH_CONFIG = {
  supabaseUrl: "https://wrcwluwgvaghqdvruwhm.supabase.co",
  supabaseAnonKey: "sb_publishable_NnQnEsaDphCmcoU3G4Vt4A_xpZfcxTl",
  // Site owner may edit the default and available quote currencies here.
  // Currency selection is a preference only until checkout is integrated.
  defaultCurrency: "USD",
  currencyOptions: ["USD", "KES", "EUR", "GBP", "CAD", "AUD", "INR", "MYR", "PHP", "SGD", "AED", "JPY", "CNY", "ZAR", "NGN"]
};
