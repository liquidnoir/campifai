import Stripe from 'stripe'
import { getAdminClient, getUserFromRequest } from '../../../lib/serverSupabase'
import { CURRENCY, parseAmountToCents } from '../../../lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body, status = 200) {
  return Response.json(body, { status })
}

function getOrigin(req) {
  const origin = req.headers.get('origin')
  if (origin) return origin
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
}

export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'not_configured' }, 500)

  let admin
  try {
    admin = getAdminClient()
  } catch (err) {
    console.error('checkout: admin-klient kunne ikke oprettes', err)
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
  const { scope, releaseId, collectionId, amount } = body || {}
  if (scope !== 'release' && scope !== 'collection') return json({ error: 'bad_request' }, 400)

  // Find varen i databasen først, så navn, eksistens og — for en udgivelse —
  // typen (single/ep/album) altid kommer fra os selv, aldrig fra klienten.
  let title
  let path
  let releaseType
  if (scope === 'release') {
    const { data } = await admin.from('releases').select('id, title, type').eq('id', releaseId).maybeSingle()
    if (!data) return json({ error: 'not_found' }, 404)
    title = data.title
    path = `/release/${data.id}`
    releaseType = data.type
  } else {
    const { data } = await admin
      .from('collections')
      .select('id, season, year, title, enabled')
      .eq('id', collectionId)
      .maybeSingle()
    if (!data || !data.enabled) return json({ error: 'not_found' }, 404)
    title = data.title && data.title.trim() ? data.title.trim() : `${capitalize(data.season)} ${data.year}`
    path = `/collections/${data.id}`
  }

  // Beløbet valideres altid på serveren, ud fra den ægte type — klientens tal stoles der ikke på.
  const parsed = parseAmountToCents(amount, scope, releaseType)
  if (!parsed.ok) return json({ error: 'amount_invalid' }, 400)

  const metadata = { user_id: user.id, scope }
  if (scope === 'release') metadata.release_id = releaseId
  else metadata.collection_id = collectionId

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const origin = getOrigin(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: parsed.cents,
            product_data: { name: `Campifai — ${title}` },
          },
        },
      ],
      success_url: `${origin}${path}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${path}?canceled=1`,
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata,
    })
    return json({ url: session.url })
  } catch (err) {
    console.error('checkout: Stripe afviste oprettelsen af sessionen', err)
    return json({ error: 'stripe_error' }, 502)
  }
}
