import Stripe from 'stripe'
import { getAdminClient, getUserFromRequest } from '../../../../lib/serverSupabase'
import { recordPaidSession } from '../../../../lib/serverPurchases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body, status = 200) {
  return Response.json(body, { status })
}

// Kaldes af siden, når brugeren lander tilbage efter betalingen. Henter sessionen direkte
// fra Stripe (så klienten ikke kan påstå en betaling) og registrerer den, hvis den er betalt.
// Webhook'en gør det samme og er den sikre vej, hvis brugeren lukker fanen for tidligt.
export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'not_configured' }, 500)

  let admin
  try {
    admin = getAdminClient()
  } catch (err) {
    console.error('confirm: admin-klient kunne ikke oprettes', err)
    return json({ error: 'not_configured' }, 500)
  }

  const user = await getUserFromRequest(admin, req)
  if (!user) return json({ error: 'unauthorized' }, 401)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const sessionId = body?.sessionId
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return json({ error: 'bad_request' }, 400)

  let session
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    console.error('confirm: kunne ikke hente sessionen hos Stripe', err)
    return json({ error: 'not_found' }, 404)
  }

  // Man kan kun bekræfte sin egen betaling
  if (session.metadata?.user_id !== user.id) return json({ error: 'forbidden' }, 403)

  if (session.payment_status !== 'paid') {
    return json({ ok: false, error: 'not_paid', status: session.payment_status })
  }

  try {
    await recordPaidSession(admin, session)
  } catch (err) {
    console.error('confirm: kunne ikke registrere betalingen', err)
    return json({ error: 'record_failed' }, 500)
  }
  return json({ ok: true })
}
