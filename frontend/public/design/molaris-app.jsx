// ─────────────────────────────────────────────────────────────
// Molaris — brand deep dive canvas
// Composes mark/wordmark/lockup/application cards into DesignCanvas sections.
// ─────────────────────────────────────────────────────────────

// ───── Intro / brief ─────
function IntroCard() {
  return (
    <div className="ml-intro">
      <div>
        <div className="ml-label inv" style={{ marginBottom: 28 }}>Brand exploration · Molaris · v2</div>
        <h1>Molaris,<br/>v <span className="em">hĺbke.</span></h1>
        <p style={{ marginTop: 22 }}>
          Hĺbkový prieskum jediného mena. Variácie značky, typografie a aplikácie
          v reálnom produkte — login, sidebar, vizitka, favicon, doménové možnosti.
        </p>
      </div>
      <div>
        <div className="ml-toc">
          <div className="ml-toc-row"><div className="ml-toc-num">01</div><div className="ml-toc-name">Mark variations · 4</div></div>
          <div className="ml-toc-row"><div className="ml-toc-num">02</div><div className="ml-toc-name">Wordmark & lockups · 4</div></div>
          <div className="ml-toc-row"><div className="ml-toc-num">03</div><div className="ml-toc-name">Color systems · 3</div></div>
          <div className="ml-toc-row"><div className="ml-toc-num">04</div><div className="ml-toc-name">In product · 4</div></div>
          <div className="ml-toc-row"><div className="ml-toc-num">05</div><div className="ml-toc-name">Naming variants · 1</div></div>
          <div className="ml-toc-row"><div className="ml-toc-num">06</div><div className="ml-toc-name">Recommendation · 1</div></div>
        </div>
      </div>
    </div>
  );
}

// ───── Mark variation cards ─────
function MarkCard({ chip, Mark, name, desc, accent }) {
  return (
    <div className="ml-mark-card">
      <div className="ml-chip">{chip}</div>
      <div className="ml-mark-hero">
        <Mark size={180} color={accent || '#0d7c6b'}/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">{name}</div>
        <div className="desc">{desc}</div>
      </div>
    </div>
  );
}

// ───── Wordmark + lockup cards ─────
function WordmarkCardPlain() {
  return (
    <div className="ml-lockup-card">
      <div className="ml-chip">02.A · Wordmark</div>
      <div className="ml-lockup-hero">
        <WordmarkPlain size={72}/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Plus Jakarta Sans · 700</div>
        <div className="desc">Predvolený wordmark. Mierne stiahnutý letterspacing (−2,5 %). Tučné, čisté, použiteľné aj solo bez značky.</div>
      </div>
    </div>
  );
}

function WordmarkCardUpper() {
  return (
    <div className="ml-lockup-card">
      <div className="ml-chip">02.B · All caps</div>
      <div className="ml-lockup-hero">
        <WordmarkUpper size={36}/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Caps · 600 · tracked +16 %</div>
        <div className="desc">Pre pečate, štítky, hlavičky dokumentov, footer. Pôsobí ako pečiatka — odkazuje na latinský pôvod.</div>
      </div>
    </div>
  );
}

function WordmarkCardLockup() {
  return (
    <div className="ml-lockup-card">
      <div className="ml-chip">02.C · Lockup · horizontálny</div>
      <div className="ml-lockup-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <MarkA size={64}/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <WordmarkPlain size={36}/>
            <div className="ml-label">Laboratórny systém</div>
          </div>
        </div>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Hlavný horizontálny lockup</div>
        <div className="desc">Značka + wordmark + descriptor. Pre hlavičky, prezentácie, faktúry. Hlavná identita v dokumentoch.</div>
      </div>
    </div>
  );
}

function WordmarkCardInline() {
  return (
    <div className="ml-lockup-card">
      <div className="ml-chip">02.D · Inline wordmark</div>
      <div className="ml-lockup-hero">
        <WordmarkWithMark size={58}/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Wordmark s integrovanou značkou</div>
        <div className="desc">Písmeno „o“ je nahradené 4-cusp značkou. Hravý detail pre marketing, sociálne siete, splash obrazovky.</div>
      </div>
    </div>
  );
}

// ───── Color system cards ─────
function ColorCardLight() {
  return (
    <div className="ml-mark-card">
      <div className="ml-chip">03.A · Primary · light</div>
      <div className="ml-mark-hero" style={{ flexDirection: 'column', gap: 24 }}>
        <MarkA size={130}/>
        <WordmarkPlain size={52}/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Teal #0d7c6b · cream #f7f6f2</div>
        <div className="desc">Hlavné prevedenie. Pre aplikáciu, web, materiály pri svetlom pozadí.</div>
      </div>
    </div>
  );
}

function ColorCardDark() {
  return (
    <div className="ml-mark-card">
      <div className="ml-chip dark">03.B · Reversed · teal</div>
      <div className="ml-mark-hero ml-bg-teal" style={{ flexDirection: 'column', gap: 24 }}>
        <MarkA size={130} color="#f7f6f2"/>
        <WordmarkPlain size={52} color="#f7f6f2"/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Cream na deep teal</div>
        <div className="desc">Pre splash obrazovky, hero sekcie, marketing. Najsilnejšie brand pozdravenie.</div>
      </div>
    </div>
  );
}

function ColorCardInk() {
  return (
    <div className="ml-mark-card">
      <div className="ml-chip dark">03.C · Mono · ink</div>
      <div className="ml-mark-hero ml-bg-ink" style={{ flexDirection: 'column', gap: 24 }}>
        <MarkA size={130} color="#f7f6f2"/>
        <WordmarkPlain size={52} color="#f7f6f2"/>
      </div>
      <div className="ml-mark-meta">
        <div className="name">Monochróm na ink</div>
        <div className="desc">Pre tlač, vizitky, vodoznaky, prípady kde teal nesedí. Univerzálne.</div>
      </div>
    </div>
  );
}

// ───── In-product: Login ─────
function LoginCard() {
  return (
    <div className="ml-card ml-login">
      <div className="ml-chip">04.A · Login</div>
      <div className="ml-login-side">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MarkA size={36}/>
          <span className="ml-wm" style={{ fontSize: 22 }}>Molaris</span>
        </div>
        <div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#1a2320' }}>
            Laboratórny<br/>systém. Bez<br/>kompromisov.
          </div>
          <div style={{ fontSize: 13, color: '#4a5752', marginTop: 16, maxWidth: 280, lineHeight: 1.55 }}>
            Práce, pacienti, sklad, financie. Všetko v jednej aplikácii pre slovenské zubné laboratóriá.
          </div>
        </div>
        <div className="ml-label">Molaris · v1.0</div>
      </div>
      <div className="ml-login-card">
        <h3>Prihlásenie</h3>
        <div className="ml-label">Email</div>
        <div className="ml-input"><span className="ph">vase@laboratorium.sk</span></div>
        <div className="ml-label">Heslo</div>
        <div className="ml-input"><span className="ph">••••••••</span></div>
        <div className="ml-btn">Prihlásiť sa</div>
        <div style={{ fontSize: 11, color: '#8a9490', textAlign: 'center', marginTop: 4 }}>
          Zabudli ste heslo?
        </div>
      </div>
    </div>
  );
}

// ───── In-product: Sidebar + dashboard ─────
function ProductCard() {
  return (
    <div className="ml-card ml-sidebar-full">
      <div className="ml-chip">04.B · Sidebar + dashboard</div>
      <div className="ml-sb">
        <div className="ml-sb-brand">
          <MarkA size={26}/>
          <span className="name">Molaris</span>
        </div>
        <div className="ml-sb-item"><span className="ico"></span>Nástenka</div>
        <div className="ml-sb-item active"><span className="ico"></span>Práce</div>
        <div className="ml-sb-item"><span className="ico"></span>Pacienti</div>
        <div className="ml-sb-item"><span className="ico"></span>Sklad</div>
        <div className="ml-sb-item"><span className="ico"></span>Kalendár</div>
        <div className="ml-sb-section">Administrácia</div>
        <div className="ml-sb-item"><span className="ico"></span>Financie</div>
        <div className="ml-sb-item"><span className="ico"></span>Faktúry</div>
        <div className="ml-sb-item"><span className="ico"></span>Cenník</div>
        <div className="ml-sb-item"><span className="ico"></span>Kliniky</div>
      </div>
      <div className="ml-main">
        <h1>Práce</h1>
        <div className="ml-stat-row">
          <div className="ml-stat"><div className="k">Aktívne</div><div className="v">24</div></div>
          <div className="ml-stat"><div className="k">Termín tento týždeň</div><div className="v">7</div></div>
          <div className="ml-stat"><div className="k">Hotové · máj</div><div className="v">186</div></div>
        </div>
        <div className="ml-tbl">
          <div className="ml-tbl-row">
            <div>Číslo</div><div>Pacient · klinika</div><div>Stav</div><div>Termín</div>
          </div>
          <div className="ml-tbl-row">
            <div style={{ fontWeight: 600, color: '#1a2320' }}>P-2841</div>
            <div style={{ color: '#1a2320' }}>K. Horváth · Dr. Tóth</div>
            <div><span className="ml-badge prog">Vo výrobe</span></div>
            <div style={{ color: '#4a5752' }}>22. 5.</div>
          </div>
          <div className="ml-tbl-row">
            <div style={{ fontWeight: 600, color: '#1a2320' }}>P-2842</div>
            <div style={{ color: '#1a2320' }}>J. Nováková · Dr. Kováč</div>
            <div><span className="ml-badge new">Nová</span></div>
            <div style={{ color: '#4a5752' }}>24. 5.</div>
          </div>
          <div className="ml-tbl-row">
            <div style={{ fontWeight: 600, color: '#1a2320' }}>P-2843</div>
            <div style={{ color: '#1a2320' }}>M. Šimko · Dr. Tóth</div>
            <div><span className="ml-badge done">Hotová</span></div>
            <div style={{ color: '#4a5752' }}>20. 5.</div>
          </div>
          <div className="ml-tbl-row">
            <div style={{ fontWeight: 600, color: '#1a2320' }}>P-2844</div>
            <div style={{ color: '#1a2320' }}>A. Lukáčová · Dr. Bartoš</div>
            <div><span className="ml-badge prog">Vo výrobe</span></div>
            <div style={{ color: '#4a5752' }}>26. 5.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── In-product: Favicons + app icons ─────
function FaviconCard() {
  return (
    <div className="ml-card ml-favicons">
      <div className="ml-chip dark">04.C · Icons</div>
      <div>
        <div className="ml-label inv" style={{ marginBottom: 16 }}>App icon · iOS / macOS / Android</div>
        <div className="ml-favrow">
          <div className="ml-favw">
            <div className="ml-appicon large"><MarkA size={70} color="#f7f6f2"/></div>
            <div className="ml-favsize">512 · app</div>
          </div>
          <div className="ml-favw">
            <div className="ml-appicon med"><MarkA size={44} color="#f7f6f2"/></div>
            <div className="ml-favsize">128</div>
          </div>
          <div className="ml-favw">
            <div className="ml-appicon sm"><MarkA size={28} color="#f7f6f2"/></div>
            <div className="ml-favsize">64</div>
          </div>
        </div>
      </div>

      <div>
        <div className="ml-label inv" style={{ marginBottom: 16 }}>Browser tab · favicon</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div className="ml-tab">
            <div className="ml-favtab f16"><MarkA size={12}/></div>
            <span>Molaris · Práce</span>
          </div>
          <div className="ml-favw">
            <div className="ml-favtab f32"><MarkA size={22}/></div>
            <div className="ml-favsize">32</div>
          </div>
          <div className="ml-favw">
            <div className="ml-favtab f16"><MarkA size={12}/></div>
            <div className="ml-favsize">16</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── In-product: Business card ─────
function BizCard() {
  return (
    <div className="ml-card">
      <div className="ml-chip">04.D · Vizitka</div>
      <div className="ml-bizwrap">
        <div className="ml-biz">
          <div className="ml-biz-brand">
            <MarkA size={22}/>
            <span className="nm">Molaris</span>
          </div>
          <div>
            <div className="who">Ing. Tomáš Mag</div>
            <div className="role">Vedúci laboratória</div>
          </div>
          <div className="contact">
            tomas@molaris.sk · +421 905 12 34 56
          </div>
        </div>
        <div className="ml-biz dark">
          <div className="ml-biz-brand">
            <MarkA size={22} color="#f7f6f2"/>
            <span className="nm" style={{ color: '#f7f6f2' }}>Molaris</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 14, lineHeight: 1.2, color: '#f7f6f2', letterSpacing: '-0.01em' }}>
              Laboratórny<br/>systém.
            </div>
          </div>
          <div className="contact">molaris.sk</div>
        </div>
      </div>
    </div>
  );
}

// ───── Naming variants ─────
function NamingCard() {
  const rows = [
    { nm: 'Molaris',         sub: '',        tag: 'Pôvodný — krátky, latinský, samostatný. Vhodný ako solo brand.',                dom: 'molaris.sk · molaris.app' },
    { nm: 'Molaris',         sub: 'Lab',     tag: 'S deskriptorom „Lab". Pomáha v ranom marketingu vysvetliť o čom je produkt.', dom: 'molarislab.com · molaris.io' },
    { nm: 'Molaris',         sub: 'Studio',  tag: 'Mäkšia, dizajnérska verzia. Hovorí o remesle, nie o softvéri.',                dom: 'molarisstudio.sk' },
    { nm: 'Mola',            sub: '',        tag: 'Skrátená, slovensky priateľská. Lacný odkaz na „molár".',                       dom: 'mola.sk · mola.app' },
    { nm: 'M·olaris',        sub: '',        tag: 'Typografická variácia s bodkou — pôsobí tech. Iba ako wordmark.',               dom: '—' },
  ];
  return (
    <div className="ml-card ml-naming">
      <div className="ml-chip">05 · Naming variants</div>
      <div style={{ marginTop: 12 }}>
        <h2>Päť variantov, jeden koreň.</h2>
        <div className="ml-body" style={{ marginTop: 8 }}>
          Ako sa môže meno predstaviť svetu. Skrátenia, deskriptory, typografické varianty + odporúčaná doména.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r, i) => (
          <div className="ml-name-row" key={i}>
            <div className="nm">{r.nm}{r.sub && <span className="sub"> · {r.sub}</span>}</div>
            <div className="tag">{r.tag}</div>
            <div className="dom">{r.dom}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── Final recommendation ─────
function RecommendationCard() {
  return (
    <div className="ml-card ml-rec">
      <div className="ml-chip dark">06 · Odporúčaný systém</div>
      <div className="ml-label">Final pick</div>
      <h1>Molaris<br/><span style={{ color: 'rgba(212,240,235,0.7)', fontWeight: 600 }}>+ Mark A · 4 cusps</span></h1>

      <div className="lockup">
        <MarkA size={86} color="#f7f6f2"/>
        <div className="stack">
          <span className="ml-wm inv" style={{ fontSize: 48 }}>Molaris</span>
          <span className="ml-label inv" style={{ marginTop: 6 }}>Laboratórny systém</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginTop: 10 }}>
        <div>
          <div className="ml-label inv" style={{ marginBottom: 10 }}>Prečo tento set</div>
          <ul>
            <li>Mark A je geometricky stabilný od 16px do 512px</li>
            <li>4 kruhy jasne odkazujú na hrbolčeky (cusps)</li>
            <li>Funguje rovnako solo aj s wordmarkom</li>
            <li>Latinský pôvod = dôvera + medzinárodný dosah</li>
          </ul>
        </div>
        <div>
          <div className="ml-label inv" style={{ marginBottom: 10 }}>Systém</div>
          <ul>
            <li>Primárna: Teal #0d7c6b na cream #f7f6f2</li>
            <li>Wordmark: Plus Jakarta Sans 700, tracking −2,5 %</li>
            <li>Tagline: „Laboratórny systém."</li>
            <li>Doména: molaris.sk (primárna) + molaris.app</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ───── App ─────
function App() {
  return (
    <DesignCanvas>
      <DCSection id="brief" title="Brief" subtitle="Molaris · prečo a kam">
        <DCArtboard id="intro" label="00 · Brief" width={620} height={780}>
          <IntroCard/>
        </DCArtboard>
      </DCSection>

      <DCSection id="marks" title="01 · Mark variations" subtitle="Štyri smery pre značku">
        <DCArtboard id="ma" label="01.A · Quattro cusps" width={420} height={520}>
          <MarkCard chip="01.A" Mark={MarkA} name="Quattro cusps · signature" desc="Štyri kruhy v 2×2 mriežke — okluzálny pohľad na 4 hrbolčeky molára. Geometricky stabilné, čisté."/>
        </DCArtboard>
        <DCArtboard id="mb" label="01.B · Cusp M monogram" width={420} height={520}>
          <MarkCard chip="01.B" Mark={MarkB} name="Cusp M monogram" desc="Vlastné písmeno M so zaoblenými vrcholmi (cusps) a rovnými nohami (korene). Číta sa ako M aj ako molár."/>
        </DCArtboard>
        <DCArtboard id="mc" label="01.C · Occlusal grid" width={420} height={520}>
          <MarkCard chip="01.C" Mark={MarkC} name="Occlusal grid" desc="Zaoblený štvorec rozdelený krížom na 4 kvadranty — anatomická schéma centrálnej fisúry molára."/>
        </DCArtboard>
        <DCArtboard id="md" label="01.D · Anatomical" width={420} height={520}>
          <MarkCard chip="01.D" Mark={MarkD} name="Anatomical silhouette" desc="Bočný pohľad — korunka s notchmi cusps + dva korene. Najliterálnejšia variácia, najexpresívnejšia."/>
        </DCArtboard>
      </DCSection>

      <DCSection id="wordmarks" title="02 · Wordmark & lockups" subtitle="Typografické prevedenia">
        <DCArtboard id="wa" label="02.A · Wordmark" width={520} height={420}>
          <WordmarkCardPlain/>
        </DCArtboard>
        <DCArtboard id="wb" label="02.B · All caps" width={520} height={420}>
          <WordmarkCardUpper/>
        </DCArtboard>
        <DCArtboard id="wc" label="02.C · Horizontal lockup" width={520} height={420}>
          <WordmarkCardLockup/>
        </DCArtboard>
        <DCArtboard id="wd" label="02.D · Inline wordmark" width={520} height={420}>
          <WordmarkCardInline/>
        </DCArtboard>
      </DCSection>

      <DCSection id="colors" title="03 · Color systems" subtitle="Tri farebné prevedenia">
        <DCArtboard id="ca" label="03.A · Light" width={420} height={520}>
          <ColorCardLight/>
        </DCArtboard>
        <DCArtboard id="cb" label="03.B · Reversed teal" width={420} height={520}>
          <ColorCardDark/>
        </DCArtboard>
        <DCArtboard id="cc" label="03.C · Mono ink" width={420} height={520}>
          <ColorCardInk/>
        </DCArtboard>
      </DCSection>

      <DCSection id="product" title="04 · In product" subtitle="Ako značka žije v aplikácii">
        <DCArtboard id="login" label="04.A · Login" width={880} height={560}>
          <LoginCard/>
        </DCArtboard>
        <DCArtboard id="dash" label="04.B · Sidebar + dashboard" width={920} height={560}>
          <ProductCard/>
        </DCArtboard>
        <DCArtboard id="favs" label="04.C · App icons & favicon" width={560} height={560}>
          <FaviconCard/>
        </DCArtboard>
        <DCArtboard id="biz" label="04.D · Vizitka" width={560} height={400}>
          <BizCard/>
        </DCArtboard>
      </DCSection>

      <DCSection id="naming" title="05 · Naming variants" subtitle="Skrátenia, deskriptory, domény">
        <DCArtboard id="naming" label="05 · Naming" width={820} height={600}>
          <NamingCard/>
        </DCArtboard>
      </DCSection>

      <DCSection id="rec" title="06 · Recommendation" subtitle="Záverečný systém">
        <DCArtboard id="rec" label="06 · Final" width={760} height={680}>
          <RecommendationCard/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
