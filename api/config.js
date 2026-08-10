module.exports = (request, response) => {
  const envKeys = Object.keys(process.env).filter(k => k.toLowerCase().includes('supabase') || k.toLowerCase().includes('key') || k.toLowerCase().includes('db') || k.toLowerCase().includes('api'));
  response.status(200).json({
    available_keys: envKeys,
    DB_SUPABASE: process.env.DB_SUPABASE || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_DB_SUPABASE || "",
    APKEY: process.env.APKEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_APKEY || ""
  });
};
