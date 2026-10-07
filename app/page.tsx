import Link from 'next/link'

export default function B2BLinktreePage() {
  const b2bLinks = [
    {
      title: 'OUTBACK B2B PORTAL',
      brands: 'Flaxta, DPS, Kang, Akta, Suno',
      url: '/shop',
      isInternal: true,
      highlight: true,
    },
    {
      title: 'ICEBREAKER & SMARTWOOL',
      brands: 'VF Corporation Portal',
      url: 'https://vfportal-emea.vfc.com/',
      isInternal: false,
    },
    {
      title: 'CASCADE DESIGNS',
      brands: 'Therm-a-Rest, MSR, Platypus, SealLine',
      url: 'https://cascadedesigns.com/de-eu',
      isInternal: false,
    },
    {
      title: 'KOHLA',
      brands: 'Skins, Poles & Equipment',
      url: 'https://kohla.at/en/',
      isInternal: false,
    },
    {
      title: 'ALPINESTANDARDS',
      brands: 'B2B Ordering System',
      url: 'https://assoo.alpinestandards.com/',
      isInternal: false,
    },
    {
      title: 'GARMONT',
      brands: 'Footwear B2B Platform',
      url: 'https://garmont.it',
      isInternal: false,
    },
  ]

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col md:flex-row selection:bg-black selection:text-white">
      {/* Linke Spalte: Branding, Header & Firmendaten */}
      <div className="w-full md:w-5/12 p-8 sm:p-12 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-100">
        <div>
          {/* Outback Logo Icon Minimalist */}
          <div className="mb-6">
            <svg className="w-16 h-10 text-slate-400" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10 40 L30 15 L45 30 L65 10 L90 40" />
            </svg>
            <div className="text-xl font-bold tracking-tight text-slate-500 font-sans -mt-2">
              Outback <span className="text-slate-400 text-base font-normal">97</span>
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-widest uppercase mb-1">
            OUTBACK 97 SRL
          </h1>
          <p className="text-sm text-gray-500 font-medium mb-8 tracking-wide">
            Agenzia di rappresentanza outdoor — Portale B2B
          </p>

          <div className="hidden md:block text-xs text-gray-600 leading-relaxed max-w-sm">
            <p className="font-semibold text-gray-900 mb-2">Piattaforma Accesso Rivenditori</p>
            Outback 97 srl è un punto di riferimento nella distribuzione di brand outdoor d'eccellenza. 
            Seleziona il portale B2B desiderato per accedere agli ordini e ai cataloghi dedicati.
          </div>
        </div>

        {/* Footer Kontaktdaten analog zur Homepage */}
        <div className="mt-12 md:mt-0 pt-8 border-t border-gray-100 text-xs text-gray-800 space-y-3 font-medium">
          <div>
            <span className="font-bold block text-gray-900 mb-0.5">Ufficio & Showroom</span>
            Via C. Baioni 24<br />
            24123 Bergamo (BG) — Italy
          </div>

          <div className="pt-2">
            <div>+39 035361103</div>
            <div className="text-gray-500 text-[11px] mt-0.5">P.IVA 02511620169</div>
          </div>
        </div>
      </div>

      {/* Rechte Spalte: Die B2B Link-Liste im Swiss-Brutalist Stil */}
      <div className="w-full md:w-7/12 p-8 sm:p-12 md:p-16 flex flex-col justify-center bg-white">
        <div className="mb-6">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
            // SELEZIONA PORTALE B2B
          </span>
        </div>

        <nav className="flex flex-col space-y-4 sm:space-y-5">
          {b2bLinks.map((item, idx) => {
            const Content = (
              <div className={`group relative p-4 sm:p-5 border-2 transition-all duration-150 flex items-center justify-between ${
                item.highlight 
                  ? 'border-black bg-black text-white hover:bg-white hover:text-black' 
                  : 'border-black/10 hover:border-black bg-white text-black'
              }`}>
                <div>
                  <div className="text-lg sm:text-xl font-black tracking-wider uppercase group-hover:translate-x-1 transition-transform duration-150">
                    {item.title}
                  </div>
                  <div className={`text-xs mt-1 font-medium tracking-wide ${
                    item.highlight ? 'text-gray-300 group-hover:text-gray-600' : 'text-gray-500'
                  }`}>
                    {item.brands}
                  </div>
                </div>

                <div className="text-xl font-bold ml-4 group-hover:translate-x-1 transition-transform duration-150">
                  ➔
                </div>
              </div>
            )

            return item.isInternal ? (
              <Link key={idx} href={item.url}>
                {Content}
              </Link>
            ) : (
              <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer">
                {Content}
              </a>
            )
          })}
        </nav>
      </div>
    </div>
  )
}