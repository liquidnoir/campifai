'use client'
import { useLanguage } from './LanguageProvider'
import { controlStyle } from '../lib/shared'
import { centsToInput, defaultRulesCents, formatEur } from '../lib/pricing'

// Prisfelter til en udgivelse.
//
// value:    { custom: boolean, min: string, suggested: string, max: string } — beløb som tekst i EUR
// type:     udgivelsens type (single/ep/album), som styrer, hvad "standardpris" er
// onChange: kaldes med en ny value
//
// Er custom slået fra, bruges standardprisen for typen (databasen gemmer da "tom").
// Selve kontrollen af tallene sker i forælderen med validatePriceSettings(), når der gemmes.
export default function PriceFields({ type, value, onChange, disabled }) {
  const { t, lang } = useLanguage()
  const defaults = defaultRulesCents('release', type)

  function enableCustom() {
    onChange({
      custom: true,
      min: centsToInput(defaults?.minCents ?? 0, lang),
      suggested: centsToInput(defaults?.suggestedCents ?? 100, lang),
      max: centsToInput(defaults?.maxCents ?? 300, lang),
    })
  }

  function useDefaults() {
    onChange({ ...value, custom: false })
  }

  function setField(field, text) {
    onChange({ ...value, [field]: text })
  }

  return (
    <div className="field">
      <label>{t('price.title')}</label>

      {!value.custom ? (
        <div>
          {defaults && (
            <p className="notice" style={{ marginBottom: 8 }}>
              {t('price.defaultInfo', {
                suggested: formatEur(defaults.suggestedCents, lang),
                min: formatEur(defaults.minCents, lang),
                max: formatEur(defaults.maxCents, lang),
              })}
            </p>
          )}
          <button className="btn ghost" type="button" disabled={disabled} onClick={enableCustom}>
            {t('price.useCustom')}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              ['min', 'price.min'],
              ['suggested', 'price.suggested'],
              ['max', 'price.max'],
            ].map(([field, labelKey]) => (
              <div key={field} style={{ flex: '1 1 110px', minWidth: 100 }}>
                <div className="notice" style={{ marginBottom: 4 }}>{t(labelKey)}</div>
                <input
                  style={controlStyle}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={disabled}
                  value={value[field]}
                  onChange={(e) => setField(field, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="notice" style={{ marginTop: 8, marginBottom: 8 }}>{t('price.hint')}</p>
          <button className="btn ghost" type="button" disabled={disabled} onClick={useDefaults}>
            {t('price.useDefault')}
          </button>
        </div>
      )}
    </div>
  )
}
