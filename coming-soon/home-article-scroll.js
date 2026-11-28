const marker = document.getElementById('home-article-scroll-marker');
const articles = Array.from(document.querySelectorAll('#home-additional-articles > article'));

if (marker && articles.length && 'IntersectionObserver' in window) {
  const batchSize = 10;
  let shown = 0;
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.unobserve(marker);
    for (const article of articles.slice(shown, shown + batchSize)) {
      article.hidden = false;
    }
    shown += batchSize;
    if (shown < articles.length) observer.observe(marker);
  }, { rootMargin: '0px 0px 240px' });

  for (const article of articles) article.hidden = true;
  observer.observe(marker);
}
