import Stripe from 'stripe'
import { getAdminClient } from '../../../../lib/serverSupabase'
import { recordPaidSession } from '../../../../lib/serverPurchases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe kalder denne adresse, når en betaling er gennemført. Ægtheden sikres med
// signaturen (STRIPE_WEBHOOK_SECRET), så ingen andre kan foregive at være Stripe.
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return new Response('Webhook er ikke konfigureret', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Mangler signatur', { status: 400 })

  // Signaturen beregnes på den rå tekst — læs den før noget parser den som JSON.
  const rawBody = await req.text()

  let event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error('webhook: ugyldig signatur', err.message)
    return new Response('Ugyldig signatur', { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    // Nogle betalingsmetoder bekræftes først senere; adgang gives kun, når pengene er der.
    if (session.payment_status === 'paid') {
      try {
        await recordPaidSession(getAdminClient(), session)
      } catch (err) {
        console.error('webhook: kunne ikke registrere betalingen', err)
        // 500 får Stripe til at prøve igen senere, så en betaling aldrig går tabt
        return new Response('Kunne ikke registrere betalingen', { status: 500 })
      }
    }
  }

  return Response.json({ received: true })
}
