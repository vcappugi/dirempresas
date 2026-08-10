module.exports = (request, response) => {
  response.status(200).json({
    DB_SUPABASE: process.env.DB_SUPABASE || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_DB_SUPABASE || "",
    APKEY: process.env.APKEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_APKEY || ""
  });
};
