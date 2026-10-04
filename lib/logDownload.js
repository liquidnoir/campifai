// Registrerer en gennemført download til statistikken (kun admin kan se den).
// Fire-and-forget: en mislykket registrering må aldrig forstyrre selve downloaden, og
// databasen registrerer kun, hvis brugeren faktisk har adgang til varen.
export function logDownload(supabase, { scope, releaseId = null, collectionId = null, format, trackCount = 0 }) {
  try {
    supabase
      .rpc('log_download', {
        p_scope: scope,
        p_release_id: scope === 'release' ? releaseId : null,
        p_collection_id: scope === 'collection' ? collectionId : null,
        p_format: format,
        p_track_count: trackCount,
      })
      .then(
        () => {},
        () => {}
      )
  } catch {
    // ignorér — se ovenfor
  }
}
