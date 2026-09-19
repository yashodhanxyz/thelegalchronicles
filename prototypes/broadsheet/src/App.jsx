import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, ArrowRight, ArrowLeft, X } from "@phosphor-icons/react";

const judgments = [
  { title: "Mageba Bridge Products Private Limited v. M/s Trade Centre", neutral: "2026 INSC 839", scr: "[2026] 8 S.C.R. 480", date: "12 August 2026", dateTime: "2026-08-12", month: "Aug", day: "12", outcome: "Appeal allowed" },
  { title: "M/s Carestream Health India Pvt. Ltd. v. Commissioner of Customs", neutral: "2026 INSC 837", scr: "[2026] 8 S.C.R. 564", date: "12 August 2026", dateTime: "2026-08-12", month: "Aug", day: "12", outcome: "Dismissed" },
  { title: "Karnataka Power Transmission Corporation Limited v. Rekha & Ors.", neutral: "2026 INSC 847", scr: "[2026] 8 S.C.R. 489", date: "12 August 2026", dateTime: "2026-08-12", month: "Aug", day: "12", outcome: "Appeal allowed" },
  { title: "National Projects Construction Corporation Ltd. v. Ishvakoo (India) Pvt. Ltd.", neutral: "2026 INSC 828", scr: "[2026] 8 S.C.R. 623", date: "11 August 2026", dateTime: "2026-08-11", month: "Aug", day: "11", outcome: "Dismissed" },
  { title: "Rahul v. State of Uttar Pradesh and Another", neutral: "2026 INSC 825", scr: "[2026] 8 S.C.R. 506", date: "11 August 2026", dateTime: "2026-08-11", month: "Aug", day: "11", outcome: "Appeal allowed" },
];

function SearchBox({ query, setQuery, onSearch, inputRef }) {
  return (
    <form className="search-box" role="search" onSubmit={onSearch}>
      <MagnifyingGlass size={20} weight="regular" aria-hidden="true" />
      <label className="visually-hidden" htmlFor="site-search">Search judgments</label>
      <input ref={inputRef} id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search judgments, petitions, laws, or topics…" />
      <button type="submit">Search</button>
    </form>
  );
}

function Header({ query, setQuery, onSearch, goHome }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  function submitSearch(event) {
    onSearch(event);
    setSearchOpen(false);
  }
  return (
    <header className="site-header">
      <div className="masthead-row">
        <button className="wordmark" type="button" onClick={goHome}>The Legal Chronicles</button>
        <nav aria-label="Primary navigation">
          <button type="button" onClick={goHome}>Judgments</button><a href="#judges">Judges</a><a href="#about">About</a>
        </nav>
        <button className="search-toggle" type="button" aria-label={searchOpen ? "Close search" : "Open search"} aria-expanded={searchOpen} aria-controls="site-search-panel" onClick={() => setSearchOpen((open) => !open)}>{searchOpen ? <X size={23} aria-hidden="true" /> : <MagnifyingGlass size={23} aria-hidden="true" />}</button>
        {searchOpen && <div id="site-search-panel" className="header-search-panel" onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}><SearchBox query={query} setQuery={setQuery} onSearch={submitSearch} inputRef={searchInputRef} /></div>}
      </div>
    </header>
  );
}

function IntroBand() {
  return (
    <section className="intro-band" aria-label="Publication introduction">
      <p>Law in the public record, for a more informed India.</p>
      <figure><img src="/assets/istanbul-engraving.jpeg" alt="" width="300" height="155" /><figcaption>Istanbul · archive plate 45</figcaption></figure>
    </section>
  );
}

function HomePage({ query, setQuery, activeQuery, onSearch, clearSearch, openJudgment }) {
  const filtered = useMemo(() => {
    const needle = activeQuery.trim().toLowerCase();
    if (!needle) return judgments;
    return judgments.filter((item) => `${item.title} ${item.neutral} ${item.scr} ${item.outcome}`.toLowerCase().includes(needle));
  }, [activeQuery]);

  return (
    <>
      <IntroBand />
      {activeQuery && <div className="search-status" role="status"><span>{filtered.length} result{filtered.length === 1 ? "" : "s"} for “{activeQuery}”</span><button type="button" onClick={clearSearch}>Clear search</button></div>}
      <div className="home-grid">
        <section className="lead-column" aria-labelledby="lead-title">
          <article className="lead-story">
            <div className="lead-copy">
              <h1 id="lead-title">Mageba Bridge Products Private Limited v. M/s Trade Centre</h1>
              <p className="case-line"><span>2026 INSC 839</span><span>[2026] 8 S.C.R. 480</span><span>12 August 2026</span><span>Supreme Court of India</span></p>
              <p className="lead-summary">The Supreme Court considered a commercial dispute concerning contractual obligations and the proper scope of judicial intervention. Our explanation follows the Court’s reasoning and links every legal conclusion back to the preserved record.</p>
              <button className="text-link" type="button" onClick={openJudgment}>Read our analysis <ArrowRight aria-hidden="true" /></button>
            </div>
            <figure className="lead-image"><img src="/assets/supreme-court-portrait.png" alt="Supreme Court of India building in New Delhi" width="560" height="700" /><figcaption>Supreme Court of India, New Delhi</figcaption></figure>
          </article>
          <div className="supporting-grid" id="analysis">
            <article><img src="/assets/court-detail.png" alt="Stone colonnade of a court building" width="800" height="450" loading="lazy" /><h2>What this ruling means for commercial contracts in India</h2><p>We explain the decision’s practical effect, the limits of its holding, and the questions that remain open.</p><button className="text-link" type="button" onClick={openJudgment}>Read the full analysis <ArrowRight aria-hidden="true" /></button></article>
            <article><img src="/assets/law-books.png" alt="Legal volumes and case files on a wooden desk" width="800" height="450" loading="lazy" /><h2>Five ways to read a judgment without losing the thread</h2><p>Start with the issue, separate the holding from observations, and verify summaries against the Court’s own words.</p><button className="text-link" type="button" onClick={openJudgment}>Read the guide <ArrowRight aria-hidden="true" /></button></article>
          </div>
        </section>
        <aside className="latest-panel" aria-labelledby="latest-title">
          <div className="section-heading"><h2 id="latest-title">Latest judgments</h2><a href="#all-judgments">View all</a></div>
          <div id="all-judgments" className="judgment-list">
            {(activeQuery ? filtered : judgments).map((item) => (
              <article className="judgment-row" key={item.neutral}><time className="date-tile" dateTime={item.dateTime} aria-label={item.date}><span>{item.month}</span><strong>{item.day}</strong></time><div><h3><button type="button" onClick={openJudgment}>{item.title}</button></h3><p>{item.neutral} <span aria-hidden="true">·</span> {item.scr}</p></div></article>
            ))}
            {filtered.length === 0 && activeQuery && <div className="empty-state"><h3>No matching judgments</h3><p>Try a case name, citation, judge, or subject.</p><button type="button" onClick={clearSearch}>Show all judgments</button></div>}
          </div>
          <blockquote><p>A more open legal culture builds a more equal India.</p><cite>The Legal Chronicles</cite></blockquote>
        </aside>
      </div>
    </>
  );
}

function JudgmentPage({ goHome }) {
  return (
    <article className="judgment-page">
      <button className="back-link" type="button" onClick={goHome}><ArrowLeft aria-hidden="true" /> Back to judgments</button>
      <header className="judgment-title">
        <div><h1>Mageba Bridge Products Private Limited v. M/s Trade Centre</h1><p className="case-line"><span>2026 INSC 839</span><span>[2026] 8 S.C.R. 480</span><span>12 August 2026</span></p></div>
        <dl><div><dt>Court</dt><dd>Supreme Court of India</dd></div><div><dt>Case number</dt><dd>Civil Appeal No. 10658/2026</dd></div><div><dt>Outcome</dt><dd>Appeal allowed</dd></div></dl>
      </header>
      <div className="judgment-body">
        <div className="reading-column">
          <section className="editorial-explanation" aria-labelledby="meaning-title"><h2 id="meaning-title">What the decision means</h2><p className="authorship">Independent explanation by The Legal Chronicles. This is not part of the Court’s judgment.</p><p>The Court examined a commercial dispute and clarified how the governing contractual framework should be applied. This overview is written in plain language and should be read alongside the complete source text below.</p><h3>What was before the Court</h3><p>The appeal raised questions about contractual obligations, available remedies, and the limits of judicial intervention.</p><h3>What the Court decided</h3><p>The appeal was allowed. The complete holding, qualifications, and reasoning remain available in the preserved judgment.</p></section>
          <section className="original-document" aria-labelledby="original-title">
            <div className="original-heading"><div><h2 id="original-title">Original judgment</h2><p>Preserved from Supreme Court Reports without editorial rewriting.</p></div><a className="source-action" href="https://scr.sci.gov.in/scrsearch/">Open SCR source <ArrowRight aria-hidden="true" /></a></div>
            <nav className="document-contents" aria-label="Judgment contents"><a href="#issue">Issue for consideration</a><a href="#headnotes">Headnotes</a><a href="#order">Judgment and order</a><a href="#result">Result</a></nav>
            <section id="issue"><h3>Issue for consideration</h3><p>[The preserved source wording appears here in the published judgment.]</p></section>
            <section id="headnotes"><h3>Headnotes</h3><p>[Complete source headnotes remain visibly separate from the independent explanation above.]</p></section>
            <section id="order"><h3>Judgment and order</h3><p id="paragraph-1"><a className="paragraph-anchor" href="#paragraph-1" aria-label="Link to paragraph 1">1</a> [Original paragraph text is rendered as accessible, selectable HTML.]</p><p id="paragraph-2"><a className="paragraph-anchor" href="#paragraph-2" aria-label="Link to paragraph 2">2</a> [Stable paragraph links allow precise citation by readers and machines.]</p><p id="paragraph-3"><a className="paragraph-anchor" href="#paragraph-3" aria-label="Link to paragraph 3">3</a> [The wording and order remain unchanged from the source material.]</p></section>
            <section id="result"><h3>Result of the case</h3><p>Appeal(s) allowed.</p></section>
          </section>
        </div>
        <aside className="case-record" aria-labelledby="record-title"><h2 id="record-title">Case record</h2><dl><div><dt>Neutral citation</dt><dd>2026 INSC 839</dd></div><div><dt>SCR citation</dt><dd>[2026] 8 S.C.R. 480</dd></div><div><dt>Coram</dt><dd>K. Vinod Chandran<br />J.B. Pardiwala</dd></div><div><dt>Decision date</dt><dd>12 August 2026</dd></div><div><dt>Source</dt><dd>Supreme Court Reports</dd></div><div><dt>Retrieved</dt><dd>16 September 2026</dd></div></dl><p className="source-note">The source text is preserved for reference and verification. Any explanation or opinion is published separately and clearly attributed.</p></aside>
      </div>
    </article>
  );
}

export function App() {
  const [view, setView] = useState("home");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  function goHome(){setView("home");window.scrollTo({top:0,behavior:"smooth"})}
  function openJudgment(){setView("judgment");window.scrollTo({top:0,behavior:"smooth"})}
  function onSearch(event){event.preventDefault();setActiveQuery(query.trim());setView("home");requestAnimationFrame(()=>document.getElementById("all-judgments")?.scrollIntoView({behavior:"smooth",block:"start"}))}
  function clearSearch(){setQuery("");setActiveQuery("")}
  return <><a className="skip-link" href="#main-content">Skip to main content</a><div className="page-shell"><Header query={query} setQuery={setQuery} onSearch={onSearch} goHome={goHome}/><main id="main-content">{view === "home" ? <HomePage query={query} setQuery={setQuery} activeQuery={activeQuery} onSearch={onSearch} clearSearch={clearSearch} openJudgment={openJudgment}/> : <JudgmentPage goHome={goHome}/>}</main><footer id="about"><strong>The Legal Chronicles</strong><p>Free legal journalism, original judgments, and public-interest legal data.</p><nav aria-label="Footer navigation"><button type="button" onClick={goHome}>Home</button><a href="#all-judgments">Judgments</a><a href="#about">About</a></nav></footer></div></>;
}
