// Bundmenuen i hjemmeskærms-appen: hvilke faner der vises, hvilken der er aktiv,
// og scriptet, der opdager, at siden kører som installeret app.

// Faner (id, adresse og tekstnøgle). Udloggede ser færre faner, fordi radio og playlister kræver login.
const HOME = { id: 'home', href: '/', labelKey: 'tabs.home' }
const RADIO = { id: 'radio', href: '/radio', labelKey: 'tabs.radio' }
const SEARCH = { id: 'search', href: '/', labelKey: 'tabs.search' } // handling: sætter markøren i søgefeltet
const PLAYLISTS = { id: 'playlists', href: '/playlists', labelKey: 'tabs.playlists' }
const ACCOUNT = { id: 'account', href: '/account', labelKey: 'tabs.account' }
const LOGIN = { id: 'login', href: '/login', labelKey: 'tabs.login' }

export function tabsFor(loggedIn) {
  return loggedIn ? [HOME, RADIO, SEARCH, PLAYLISTS, ACCOUNT] : [HOME, SEARCH, LOGIN]
}

// Er fanen den aktive på den givne side? Søg er en handling og er aldrig markeret.
// "Hjem" gælder også de sider, man kommer til ved at udforske (udgivelser, kunstnere, kollektioner).
export function isTabActive(tab, pathname) {
  const path = pathname || '/'
  const under = (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  switch (tab.id) {
    case 'home':
      return path === '/' || under('/release') || under('/artist') || under('/collections')
    case 'radio':
      return under('/radio')
    case 'playlists':
      return under('/playlists')
    case 'account':
      return under('/account')
    case 'login':
      return under('/login')
    default:
      return false
  }
}

// Køres i <head>, før siden tegnes, så bundmenuen er der fra første billede (ingen "hop").
// Sætter klassen "standalone" på <html>, når siden kører som installeret app — på iPhone
// (navigator.standalone) eller i andre browsere (display-mode). "?app=1" i adressen
// efterligner det i en almindelig browser, så man kan se og afprøve menuen.
export const STANDALONE_SCRIPT = `(function(){try{var on=window.navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||/[?&]app=1(&|$)/.test(window.location.search);if(on){document.documentElement.classList.add('standalone')}}catch(e){}})();`
