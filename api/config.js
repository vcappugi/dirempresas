export default function handler(request, response) {
  response.status(200).json({
    DB_SUPABASE: process.env.DB_SUPABASE || "",
    APKEY: process.env.APKEY || ""
  });
}
