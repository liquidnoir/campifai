// KUN til brug i server-kode. Registrerer en gennemført Stripe-betaling.
// Kaldes både fra webhook'en og fra bekræftelses-endpointet, så den SKAL tåle at blive
// kaldt flere gange for samme betaling (idempotent).
export async function recordPaidSession(admin, session) {
  const md = session.metadata || {}
  const userId = md.user_id
  const scope = md.scope
  const releaseId = md.release_id || null
  const collectionId = md.collection_id || null

  if (!userId || (scope !== 'release' && scope !== 'collection')) {
    throw new Error('Stripe-sessionen mangler gyldig metadata')
  }
  if (scope === 'release' && !releaseId) throw new Error('Stripe-sessionen mangler release_id')
  if (scope === 'collection' && !collectionId) throw new Error('Stripe-sessionen mangler collection_id')

  // 1) Registrér selve betalingen (unik på stripe_session_id)
  const payment = {
    user_id: userId,
    scope,
    release_id: scope === 'release' ? releaseId : null,
    collection_id: scope === 'collection' ? collectionId : null,
    amount_cents: session.amount_total,
    currency: session.currency,
    stripe_session_id: session.id,
  }
  const { error: paymentError } = await admin.from('payments').insert(payment)
  if (paymentError && paymentError.code !== '23505') throw paymentError

  // 2) Giv adgang. Har brugeren allerede adgang (fx via en tidligere donation),
  //    giver den unikke indeks en dublet-fejl, som vi bevidst ignorerer.
  const purchase = {
    user_id: userId,
    scope,
    method: 'stripe',
    release_id: scope === 'release' ? releaseId : null,
    collection_id: scope === 'collection' ? collectionId : null,
  }
  const { error: purchaseError } = await admin.from('purchases').insert(purchase)
  if (purchaseError && purchaseError.code !== '23505') throw purchaseError
}
