// Teksterne på de juridiske sider. UDKAST: lad en jurist gennemgå dem, før de offentliggøres.
//
// Opbygning: hver tekst har en titel, en indledning og en række afsnit (sections).
// Et afsnit har et id (bruges til links, fx /terms#withdrawal), en overskrift og blokke:
//   en streng = et afsnit tekst, { list: [...] } = en punktopstilling.
// Pladsholdere: {name} (tjenestens navn), {operatorBlock} (ansvarlig, adresse, CVR),
//   {email} (kontakt-e-mail), {siteUrl}.

export const LEGAL_DOCS = {
  // ======================================================================== VILKÅR
  terms: {
    da: {
      title: 'Vilkår for brug',
      intro:
        'Disse vilkår gælder for din brug af {name} ("tjenesten"). Ved at oprette en konto eller bruge tjenesten accepterer du dem.',
      sections: [
        {
          id: 'who',
          heading: '1. Hvem står bag tjenesten',
          blocks: [
            '{name} drives af {operatorBlock}. Du kan kontakte os på {email} eller via siden Kontakt.',
          ],
        },
        {
          id: 'account',
          heading: '2. Konto og alder',
          blocks: [
            {
              list: [
                'Du skal være mindst 13 år for at oprette en konto. Er du under 18 år, skal en forælder eller værge have givet tilladelse til dine køb.',
                'Du skal oplyse korrekte oplysninger, holde din adgangskode hemmelig og er ansvarlig for det, der sker på din konto.',
                'Du kan til enhver tid slette din konto under Min konto.',
              ],
            },
          ],
        },
        {
          id: 'roles',
          heading: '3. Lyttere og publishere',
          blocks: [
            'Som lytter kan du lytte til musik, lave afspilningslister og låse download op. Som publisher kan du desuden uploade musik og oprette kunstnere og udgivelser.',
            'Publisher-adgang skal godkendes af en administrator. Indtil da er du lytter. Vi kan afvise en anmodning eller fratage publisher-adgang igen.',
          ],
        },
        {
          id: 'purchases',
          heading: '4. Køb og download',
          blocks: [
            {
              list: [
                'Du kan låse download op af en udgivelse eller en kollektion. Prisen vælger du selv inden for de grænser, der vises ved varen (mindstepris, foreslået pris og maksimalpris). Er mindsteprisen 0, kan du låse op uden at betale.',
                'Priser er i euro (EUR). Den pris, du bekræfter, før du betaler, er den pris, du betaler.',
                'Betaling sker via Stripe. Vi modtager og gemmer ikke dine kortoplysninger.',
                'Et køb giver dig adgang til at downloade musikken som MP3 eller FLAC til personlig, ikke-kommerciel brug. Du må ikke videresælge, udlåne, dele offentligt eller på anden måde videregive musikken.',
                'Donationer: Når funktionen er slået til, viser vi links til organisationer, du kan donere til. En donation sker direkte til organisationen. Vi modtager den ikke, kan ikke kontrollere den og er ikke part i den. Adgang gives på tillid.',
              ],
            },
          ],
        },
        {
          id: 'withdrawal',
          heading: '5. Fortrydelsesret',
          blocks: [
            'Når du som forbruger køber digitalt indhold, som leveres med det samme, har du ikke fortrydelsesret efter, at leveringen er begyndt, hvis du forud har givet udtrykkeligt samtykke til, at leveringen starter, og har anerkendt, at du dermed mister din fortrydelsesret. Det samtykke og den anerkendelse giver du ved at sætte flueben, før du betaler.',
            'Er indholdet mangelfuldt, eller har du ikke fået adgang til det, har du de rettigheder, der følger af forbrugerlovgivningen. Kontakt os på {email}.',
          ],
        },
        {
          id: 'content',
          heading: '6. Dit indhold (publishere)',
          blocks: [
            {
              list: [
                'Du beholder alle rettigheder til din musik, dine billeder og dine tekster.',
                'Du garanterer, at du ejer rettighederne eller har alle nødvendige tilladelser (herunder til samples, coverversioner, billeder og tekster), og at indholdet ikke krænker andres rettigheder og ikke er ulovligt.',
                'Du giver os en ikke-eksklusiv ret til at lagre, streame, gøre tilgængeligt, sælge som download (herunder konvertere til MP3 og FLAC) og vise dit indhold og dine kunstneroplysninger på tjenesten, så længe indholdet ligger hos os. Du kan til enhver tid fjerne det.',
                'Du fastsætter selv priserne inden for de grænser, tjenesten tillader.',
                'Betalinger modtages af {operatorBlock}. Afregning til publishere aftales særskilt, indtil andet er meddelt.',
                'Du holder os skadesløse for krav fra tredjemand, der skyldes, at dit indhold krænker deres rettigheder.',
              ],
            },
          ],
        },
        {
          id: 'rules',
          heading: '7. Regler for brug og indhold',
          blocks: [
            'Du må ikke uploade eller dele indhold, der er ulovligt, krænker ophavsret eller andre rettigheder, indeholder trusler, chikane eller hadefuld tale, viser seksuelt indhold med mindreårige eller på anden måde skader andre.',
            'Du må ikke forsøge at omgå køb eller adgangskontrol, misbruge eller overbelaste tjenesten, hente indhold automatisk i stor skala eller forstyrre andres brug.',
          ],
        },
        {
          id: 'reports',
          heading: '8. Anmeldelse og fjernelse af indhold',
          blocks: [
            'Mener du, at indhold på tjenesten er ulovligt eller krænker dine rettigheder, kan du anmelde det på siden Kontakt og anmeld indhold. Vi behandler anmeldelser omhyggeligt og hurtigt.',
            'Vi kan fjerne eller spærre indhold og suspendere eller lukke konti, der overtræder vilkårene eller loven. Træffer vi en sådan beslutning, får du en begrundelse, og du kan klage ved at skrive til {email}.',
          ],
        },
        {
          id: 'liability',
          heading: '9. Tilgængelighed og ansvar',
          blocks: [
            'Vi arbejder på at holde tjenesten kørende, men kan ikke garantere uafbrudt drift. Tjenesten leveres, som den er. Vi er ikke ansvarlige for indirekte tab, medmindre ufravigelig lovgivning bestemmer andet. Dine rettigheder som forbruger berøres ikke.',
          ],
        },
        {
          id: 'changes',
          heading: '10. Ændringer af vilkårene',
          blocks: [
            'Vi kan ændre vilkårene. Væsentlige ændringer varsler vi i tjenesten eller på e-mail. Bruger du tjenesten efter en ændring, accepterer du de nye vilkår.',
          ],
        },
        {
          id: 'law',
          heading: '11. Lovvalg og klager',
          blocks: [
            'Vilkårene er underlagt dansk ret. Er du forbruger i et andet EU-land, beholder du de forbrugerrettigheder, du har i dit hjemland. Som forbruger kan du klage til Center for Klageløsning (naevneneshus.dk).',
          ],
        },
      ],
    },
    en: {
      title: 'Terms of use',
      intro:
        'These terms apply to your use of {name} (the "service"). By creating an account or using the service you accept them.',
      sections: [
        {
          id: 'who',
          heading: '1. Who is behind the service',
          blocks: [
            '{name} is operated by {operatorBlock}. You can contact us at {email} or via the Contact page.',
          ],
        },
        {
          id: 'account',
          heading: '2. Account and age',
          blocks: [
            {
              list: [
                'You must be at least 13 years old to create an account. If you are under 18, a parent or guardian must have given permission for your purchases.',
                'You must provide correct information, keep your password secret, and you are responsible for what happens on your account.',
                'You can delete your account at any time under My account.',
              ],
            },
          ],
        },
        {
          id: 'roles',
          heading: '3. Listeners and publishers',
          blocks: [
            'As a listener you can listen to music, make playlists and unlock downloads. As a publisher you can also upload music and create artists and releases.',
            'Publisher access must be approved by an administrator. Until then you are a listener. We may reject a request or withdraw publisher access again.',
          ],
        },
        {
          id: 'purchases',
          heading: '4. Purchases and downloads',
          blocks: [
            {
              list: [
                'You can unlock the download of a release or a collection. You choose the price yourself within the limits shown for the item (minimum, suggested and maximum price). If the minimum price is 0, you can unlock without paying.',
                'Prices are in euros (EUR). The price you confirm before paying is the price you pay.',
                'Payment is handled by Stripe. We do not receive or store your card details.',
                'A purchase gives you access to download the music as MP3 or FLAC for personal, non-commercial use. You may not resell, lend, publicly share or otherwise pass on the music.',
                'Donations: When the feature is switched on, we show links to organisations you can donate to. A donation goes directly to the organisation. We do not receive it, cannot verify it and are not a party to it. Access is granted on trust.',
              ],
            },
          ],
        },
        {
          id: 'withdrawal',
          heading: '5. Right of withdrawal',
          blocks: [
            'When you buy digital content as a consumer and it is delivered immediately, you have no right of withdrawal once delivery has begun, provided you have given your express prior consent to delivery starting and have acknowledged that you thereby lose your right of withdrawal. You give that consent and acknowledgement by ticking the box before you pay.',
            'If the content is defective, or you have not been given access to it, you have the rights that follow from consumer law. Contact us at {email}.',
          ],
        },
        {
          id: 'content',
          heading: '6. Your content (publishers)',
          blocks: [
            {
              list: [
                'You keep all rights to your music, images and texts.',
                'You warrant that you own the rights or have all necessary permissions (including for samples, cover versions, images and texts), and that the content does not infringe anyone else\'s rights and is not unlawful.',
                'You grant us a non-exclusive right to store, stream, make available, sell as a download (including converting to MP3 and FLAC) and display your content and artist information on the service for as long as the content is with us. You can remove it at any time.',
                'You set the prices yourself within the limits the service allows.',
                'Payments are received by {operatorBlock}. Settlement to publishers is agreed separately until further notice.',
                'You indemnify us against third-party claims arising from your content infringing their rights.',
              ],
            },
          ],
        },
        {
          id: 'rules',
          heading: '7. Rules for use and content',
          blocks: [
            'You may not upload or share content that is unlawful, infringes copyright or other rights, contains threats, harassment or hate speech, shows sexual content involving minors or otherwise harms others.',
            'You may not try to bypass purchases or access controls, misuse or overload the service, retrieve content automatically at scale or disturb other people\'s use.',
          ],
        },
        {
          id: 'reports',
          heading: '8. Reporting and removal of content',
          blocks: [
            'If you believe content on the service is unlawful or infringes your rights, you can report it on the Contact and report content page. We handle reports carefully and promptly.',
            'We may remove or block content and suspend or close accounts that violate the terms or the law. If we make such a decision, you will receive a statement of reasons and can appeal by writing to {email}.',
          ],
        },
        {
          id: 'liability',
          heading: '9. Availability and liability',
          blocks: [
            'We work to keep the service running but cannot guarantee uninterrupted operation. The service is provided as is. We are not liable for indirect losses unless mandatory law provides otherwise. Your rights as a consumer are not affected.',
          ],
        },
        {
          id: 'changes',
          heading: '10. Changes to the terms',
          blocks: [
            'We may change the terms. We will give notice of significant changes in the service or by email. If you use the service after a change, you accept the new terms.',
          ],
        },
        {
          id: 'law',
          heading: '11. Governing law and complaints',
          blocks: [
            'The terms are governed by Danish law. If you are a consumer in another EU country, you keep the consumer rights you have in your home country. As a consumer you can complain to the Danish Center for Klageløsning (naevneneshus.dk).',
          ],
        },
      ],
    },
  },

  // ============================================================== PRIVATLIVSPOLITIK
  privacy: {
    da: {
      title: 'Privatlivspolitik',
      intro: 'Her kan du læse, hvordan {name} behandler dine personoplysninger.',
      sections: [
        {
          id: 'controller',
          heading: '1. Dataansvarlig',
          blocks: ['Dataansvarlig er {operatorBlock}. Du kan kontakte os på {email}.'],
        },
        {
          id: 'data',
          heading: '2. Hvilke oplysninger vi behandler, og hvorfor',
          blocks: [
            {
              list: [
                'Konto: e-mailadresse, adgangskode (gemmes krypteret hos vores loginleverandør), visningsnavn, en evt. kort tekst om dig og din rolle (lytter, publisher eller administrator). Formål: at oprette og drive din konto. Grundlag: aftalen med dig (GDPR art. 6, stk. 1, litra b).',
                'Køb og adgange: hvad du har købt eller låst op, tidspunkt, beløb og betalings-id fra Stripe. Vi gemmer ikke dine kortoplysninger. Formål: at levere dit køb og føre regnskab. Grundlag: aftalen med dig og vores forpligtelser efter bogføringsloven (litra b og c).',
                'Brug: hvilke numre du afspiller (med tidspunkt og din rolle), hvilke downloads du foretager (hvad, format og tidspunkt) og dine afspilningslister. Formål: at drive tjenesten, vise afspilningstal og dig dine egne senest afspillede udgivelser, føre statistik og forebygge misbrug. Grundlag: vores legitime interesse i at drive og forbedre tjenesten (litra f). Statistikken er kun synlig for administratorer, og din liste over senest afspillede udgivelser kan kun ses af dig.',
                'Indhold fra publishere: musik, billeder og kunstnerbeskrivelser, som er offentligt tilgængelige på tjenesten. Grundlag: aftalen med publisheren.',
                'Tekniske data: IP-adresse og tekniske logs hos vores hostingleverandører. Formål: drift og sikkerhed. Grundlag: legitim interesse (litra f).',
                'Henvendelser: indholdet af e-mails, du sender os. Formål: at besvare dig. Grundlag: legitim interesse eller aftalen med dig.',
              ],
            },
          ],
        },
        {
          id: 'recipients',
          heading: '3. Hvem modtager oplysningerne',
          blocks: [
            'Vi bruger følgende leverandører, som behandler oplysninger på vores vegne eller leverer dele af tjenesten:',
            {
              list: [
                'Supabase (database, login og lagring af filer). Data ligger i EU (Frankfurt).',
                'Vercel (hosting af tjenesten). Kan behandle tekniske data uden for EU.',
                'Stripe (betalinger). Stripe er selvstændigt ansvarlig for behandlingen af kortoplysninger og svindelkontrol.',
                'unpkg.com (CDN, der leverer konverteringsværktøjet, når du downloader som MP3 eller FLAC). CDN-leverandøren kan se din IP-adresse, når værktøjet hentes.',
                'Vores leverandør af e-mailudsendelse (fx bekræftelse og nulstilling af adgangskode).',
              ],
            },
            'Vi sælger ikke dine oplysninger, og vi bruger hverken reklame- eller sporingstjenester.',
          ],
        },
        {
          id: 'transfers',
          heading: '4. Overførsel til lande uden for EU/EØS',
          blocks: [
            'Nogle leverandører (fx Vercel og Stripe) kan behandle oplysninger uden for EU/EØS, herunder i USA. Overførsler sker på grundlag af EU-Kommissionens standardkontraktbestemmelser eller EU–US Data Privacy Framework.',
          ],
        },
        {
          id: 'retention',
          heading: '5. Hvor længe vi gemmer oplysninger',
          blocks: [
            'Kontooplysninger gemmes, så længe du har en konto. Sletter du din konto (Min konto, Slet konto), slettes dine kontooplysninger, afspilningslister og adgange, og kobling mellem dig og tidligere afspilninger, downloads og køb fjernes. Indhold, du har uploadet som publisher, slettes sammen med kontoen.',
            'Selve betalingsposten (beløb, vare og tidspunkt) opbevares uden kobling til dig, i det omfang bogføringsloven kræver det (som udgangspunkt 5 år efter regnskabsårets udgang).',
          ],
        },
        {
          id: 'rights',
          heading: '6. Dine rettigheder',
          blocks: [
            'Du har ret til indsigt i, berigtigelse og sletning af dine oplysninger, til at begrænse eller gøre indsigelse mod behandlingen og til at få dine oplysninger udleveret i et almindeligt format. Skriv til {email}. Du kan selv slette din konto under Min konto.',
            'Du kan klage til Datatilsynet (datatilsynet.dk), hvis du mener, at vi behandler dine oplysninger i strid med reglerne.',
          ],
        },
        {
          id: 'cookies',
          heading: '7. Cookies og lokal lagring',
          blocks: ['Læs mere på siden Cookies.'],
        },
        {
          id: 'children',
          heading: '8. Børn',
          blocks: ['Tjenesten er ikke til børn under 13 år.'],
        },
        {
          id: 'security',
          heading: '9. Sikkerhed',
          blocks: [
            'Vi bruger krypteret forbindelse (HTTPS) og adgangskontrol og begrænser adgangen til personoplysninger. Intet system er helt sikkert. Ved brud på persondatasikkerheden underretter vi dig og Datatilsynet, når loven kræver det.',
          ],
        },
        {
          id: 'changes',
          heading: '10. Ændringer',
          blocks: ['Vi opdaterer politikken, når der er behov for det. Datoen øverst viser seneste ændring.'],
        },
      ],
    },
    en: {
      title: 'Privacy policy',
      intro: 'This explains how {name} processes your personal data.',
      sections: [
        {
          id: 'controller',
          heading: '1. Data controller',
          blocks: ['The data controller is {operatorBlock}. You can contact us at {email}.'],
        },
        {
          id: 'data',
          heading: '2. What we process, and why',
          blocks: [
            {
              list: [
                'Account: email address, password (stored encrypted by our login provider), display name, an optional short text about you, and your role (listener, publisher or administrator). Purpose: to create and run your account. Basis: our agreement with you (GDPR art. 6(1)(b)).',
                'Purchases and access: what you have bought or unlocked, time, amount and a payment id from Stripe. We do not store your card details. Purpose: to deliver your purchase and keep accounts. Basis: our agreement with you and our obligations under the Danish Bookkeeping Act (points b and c).',
                'Use: which tracks you play (with time and your role), which downloads you make (what, format and time) and your playlists. Purpose: to run the service, show play counts and your own recently played releases, keep statistics and prevent misuse. Basis: our legitimate interest in running and improving the service (point f). The statistics are only visible to administrators, and your list of recently played releases can only be seen by you.',
                'Content from publishers: music, images and artist descriptions that are publicly available on the service. Basis: our agreement with the publisher.',
                'Technical data: IP address and technical logs at our hosting providers. Purpose: operation and security. Basis: legitimate interest (point f).',
                'Enquiries: the content of emails you send us. Purpose: to reply to you. Basis: legitimate interest or our agreement with you.',
              ],
            },
          ],
        },
        {
          id: 'recipients',
          heading: '3. Who receives the data',
          blocks: [
            'We use the following providers, who process data on our behalf or provide parts of the service:',
            {
              list: [
                'Supabase (database, login and file storage). Data is stored in the EU (Frankfurt).',
                'Vercel (hosting of the service). May process technical data outside the EU.',
                'Stripe (payments). Stripe is independently responsible for processing card details and fraud prevention.',
                'unpkg.com (a CDN that delivers the conversion tool when you download as MP3 or FLAC). The CDN provider can see your IP address when the tool is fetched.',
                'Our email provider (for example confirmation and password reset emails).',
              ],
            },
            'We do not sell your data, and we use no advertising or tracking services.',
          ],
        },
        {
          id: 'transfers',
          heading: '4. Transfers outside the EU/EEA',
          blocks: [
            'Some providers (for example Vercel and Stripe) may process data outside the EU/EEA, including in the United States. Transfers are based on the European Commission\'s standard contractual clauses or the EU–US Data Privacy Framework.',
          ],
        },
        {
          id: 'retention',
          heading: '5. How long we keep data',
          blocks: [
            'Account data is kept for as long as you have an account. If you delete your account (My account, Delete account), your account data, playlists and access are deleted, and the link between you and earlier plays, downloads and purchases is removed. Content you uploaded as a publisher is deleted with the account.',
            'The payment record itself (amount, item and time) is kept without any link to you, to the extent the Bookkeeping Act requires it (as a general rule 5 years after the end of the financial year).',
          ],
        },
        {
          id: 'rights',
          heading: '6. Your rights',
          blocks: [
            'You have the right to access, rectification and erasure of your data, to restrict or object to processing, and to receive your data in a common format. Write to {email}. You can delete your account yourself under My account.',
            'You can complain to the Danish Data Protection Agency (datatilsynet.dk) if you believe we process your data in breach of the rules.',
          ],
        },
        {
          id: 'cookies',
          heading: '7. Cookies and local storage',
          blocks: ['Read more on the Cookies page.'],
        },
        {
          id: 'children',
          heading: '8. Children',
          blocks: ['The service is not intended for children under 13.'],
        },
        {
          id: 'security',
          heading: '9. Security',
          blocks: [
            'We use an encrypted connection (HTTPS) and access control and limit access to personal data. No system is completely secure. In the event of a personal data breach we will notify you and the Danish Data Protection Agency when the law requires it.',
          ],
        },
        {
          id: 'changes',
          heading: '10. Changes',
          blocks: ['We update the policy when needed. The date at the top shows the latest change.'],
        },
      ],
    },
  },

  // ================================================================== COOKIES
  cookies: {
    da: {
      title: 'Cookies og lokal lagring',
      intro: '{name} bruger kun det, der er nødvendigt for, at tjenesten virker.',
      sections: [
        {
          id: 'what',
          heading: 'Det vi gemmer i din browser',
          blocks: [
            {
              list: [
                'Din login-session, så du forbliver logget ind. Den gemmes i browserens lokale lager (nøglen begynder med "sb-").',
                'Dit sprogvalg (dansk eller engelsk).',
              ],
            },
            'Det er strengt nødvendigt for, at tjenesten virker, og kræver derfor ikke samtykke.',
          ],
        },
        {
          id: 'not',
          heading: 'Det vi ikke bruger',
          blocks: [
            'Vi bruger ingen cookies eller sporing til statistik, markedsføring eller reklamer. Skrifttyperne leveres fra vores egen server, så din IP-adresse ikke sendes til Google.',
          ],
        },
        {
          id: 'stripe',
          heading: 'Betaling',
          blocks: [
            'Når du betaler, sendes du til Stripe, som kan bruge egne cookies på deres side. Se Stripes egen politik.',
          ],
        },
        {
          id: 'delete',
          heading: 'Slet dine data i browseren',
          blocks: ['Du kan slette lokale data via din browsers indstillinger. Du bliver så logget ud.'],
        },
      ],
    },
    en: {
      title: 'Cookies and local storage',
      intro: '{name} only uses what is necessary for the service to work.',
      sections: [
        {
          id: 'what',
          heading: 'What we store in your browser',
          blocks: [
            {
              list: [
                'Your login session, so you stay logged in. It is stored in the browser\'s local storage (the key starts with "sb-").',
                'Your language choice (Danish or English).',
              ],
            },
            'This is strictly necessary for the service to work and therefore does not require consent.',
          ],
        },
        {
          id: 'not',
          heading: 'What we do not use',
          blocks: [
            'We use no cookies or tracking for statistics, marketing or advertising. Fonts are delivered from our own server, so your IP address is not sent to Google.',
          ],
        },
        {
          id: 'stripe',
          heading: 'Payment',
          blocks: [
            'When you pay, you are sent to Stripe, which may use its own cookies on its site. See Stripe\'s own policy.',
          ],
        },
        {
          id: 'delete',
          heading: 'Delete your data in the browser',
          blocks: ['You can delete local data in your browser settings. You will then be logged out.'],
        },
      ],
    },
  },

  // ======================================================== KONTAKT OG ANMELD INDHOLD
  contact: {
    da: {
      title: 'Kontakt og anmeld indhold',
      intro: 'Her kan du kontakte os og anmelde indhold, du mener er ulovligt eller krænker dine rettigheder.',
      sections: [
        {
          id: 'contact',
          heading: 'Kontakt',
          blocks: [
            '{name} drives af {operatorBlock}.',
            'Skriv til os på {email}. Vi bestræber os på at svare inden for fem hverdage.',
          ],
        },
        {
          id: 'report',
          heading: 'Anmeld indhold',
          blocks: [
            'Mener du, at noget på tjenesten er ulovligt eller krænker dine rettigheder (fx ophavsret), kan du anmelde det her. En anmeldelse skal indeholde:',
            {
              list: [
                'den præcise adresse (URL) på indholdet,',
                'en tilstrækkelig begrundelse for, hvorfor du mener, at indholdet er ulovligt eller krænkende (ved krænkelse af ophavsret: hvilket værk det drejer sig om, og at du er rettighedshaver eller handler på vegne af rettighedshaveren),',
                'dit navn og din e-mailadresse,',
                'en erklæring om, at du i god tro mener, at oplysningerne er korrekte og fuldstændige.',
              ],
            },
          ],
        },
        {
          id: 'after',
          heading: 'Hvad sker der bagefter',
          blocks: [
            'Vi bekræfter, at vi har modtaget anmeldelsen, vurderer den omhyggeligt og giver dig besked om vores afgørelse. Fjerner eller spærrer vi indhold, får den, der har lagt det op, en begrundelse og mulighed for at klage.',
          ],
        },
      ],
    },
    en: {
      title: 'Contact and report content',
      intro: 'Here you can contact us and report content you believe is unlawful or infringes your rights.',
      sections: [
        {
          id: 'contact',
          heading: 'Contact',
          blocks: [
            '{name} is operated by {operatorBlock}.',
            'Write to us at {email}. We aim to reply within five working days.',
          ],
        },
        {
          id: 'report',
          heading: 'Report content',
          blocks: [
            'If you believe something on the service is unlawful or infringes your rights (for example copyright), you can report it here. A report must include:',
            {
              list: [
                'the exact address (URL) of the content,',
                'a sufficiently substantiated explanation of why you believe the content is unlawful or infringing (for copyright: which work it concerns, and that you are the rights holder or act on the rights holder\'s behalf),',
                'your name and email address,',
                'a statement that you believe in good faith that the information is accurate and complete.',
              ],
            },
          ],
        },
        {
          id: 'after',
          heading: 'What happens next',
          blocks: [
            'We confirm that we have received the report, assess it carefully and tell you our decision. If we remove or block content, the person who posted it receives a statement of reasons and a chance to appeal.',
          ],
        },
      ],
    },
  },
}

// Sætter pladsholdere ind i en tekst. Mangler en oplysning, vises en tydelig [pladsholder].
export function fillPlaceholders(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match))
}
