// Presentation only: never write this value back to source metadata or body text.
export function displayCaseTitle(source) {
  const acronyms = new Set(['CBI','NCT','SEBI','GST','ONGC','NTPC','AIIMS','IIT','IIM','UPSC','BSNL','MTNL','LIC','ESI','EPFO','NDMC','DDA','CPCB','NHAI','BHEL','CISF','CRPF']);
  const small = new Set(['versus','v','of','the','and','for','through','by','in','on','at','to','with']);
  return String(source || '').replace(/[A-Za-z]+(?:\.[A-Za-z]+)*\.?/g, (word, offset) => {
    if (word.length === 1 || /^(?:[A-Z]\.)+[A-Z]?\.?$/.test(word) || acronyms.has(word)) return word;
    if (word !== word.toUpperCase()) return word;
    const lower = word.toLowerCase();
    if (small.has(lower.replace(/\.$/,'')) && offset !== 0) return lower;
    return lower[0].toUpperCase() + lower.slice(1);
  });
}
