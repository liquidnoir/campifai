// Er fejlen fra Supabase et udtryk for, at der er sendt for mange e-mails for nylig?
// (Supabase begrænser antallet af mails, især med deres standardafsender.)
export function isRateLimitError(error) {
  if (!error) return false
  const text = `${error.code || ''} ${error.message || ''}`.toLowerCase()
  return error.status === 429 || text.includes('rate limit') || text.includes('over_email_send_rate_limit')
}
