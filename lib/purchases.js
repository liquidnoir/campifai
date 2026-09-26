// De to donationsmuligheder. Stripe (rigtigt køb) tilføjes i en senere iteration.
export const DONATION_OPTIONS = [
  {
    key: 'donation_ecf',
    label: 'Donér til European Cultural Foundation',
    url: 'https://culturalfoundation.iraiser.eu/support/~my-donation',
  },
  {
    key: 'donation_sweet_relief',
    label: 'Donér til Sweet Relief Musicians Fund',
    url: 'https://www.sweetrelief.org/general-fund.html',
  },
]

// Har brugeren adgang til at downloade en given udgivelse?
// Adgang gives hvis man: er udgivelsens publisher, er admin, har købt/doneret for
// netop denne udgivelse, eller har købt/doneret for en kollektion, den indgår i.
export async function hasReleaseAccess(supabase, { userId, isAdmin, release }) {
  if (!userId) return false
  if (isAdmin) return true
  if (release?.publisher_id && release.publisher_id === userId) return true

  const [directRes, containingRes, ownedRes] = await Promise.all([
    supabase.from('purchases').select('id').eq('user_id', userId).eq('scope', 'release').eq('release_id', release.id).limit(1),
    supabase.from('collection_releases').select('collection_id').eq('release_id', release.id),
    supabase.from('purchases').select('collection_id').eq('user_id', userId).eq('scope', 'collection'),
  ])
  if (directRes.data && directRes.data.length > 0) return true

  const containing = new Set((containingRes.data || []).map((r) => r.collection_id))
  const owned = new Set((ownedRes.data || []).map((r) => r.collection_id))
  for (const c of owned) {
    if (containing.has(c)) return true
  }
  return false
}

// Har brugeren købt/doneret for en given kollektion direkte?
export async function hasCollectionAccess(supabase, { userId, isAdmin, collectionId }) {
  if (!userId) return false
  if (isAdmin) return true
  const { data } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('scope', 'collection')
    .eq('collection_id', collectionId)
    .limit(1)
  return Boolean(data && data.length > 0)
}

export async function recordPurchase(supabase, { scope, releaseId, collectionId, method }) {
  const payload = { scope, method }
  if (scope === 'release') payload.release_id = releaseId
  if (scope === 'collection') payload.collection_id = collectionId
  const { error } = await supabase.from('purchases').insert(payload)
  return error
}
