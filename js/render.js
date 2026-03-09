import { html, render } from '/js/lit/lit-html/lit-html.js';
import { unsafeHTML } from '/js/lit/lit-html/directives/unsafe-html.js';
import { loadData as fetchData, loadNews as fetchNews, loadArticle as fetchArticle } from '/js/content-loader.js';

// using Lit only as a HTML renderer + client-side router, not leveraging its reactive components.

const main = document.querySelector("main");
let cachedNews = null;
let cachedData = null;

const menuOrder = ["home", "values", "team", "journal"];

// Utility to capitalize link text
function displayName(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getSlug() {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("slug");
    if (fromQuery) return fromQuery;

    const path = location.pathname.replace(/^\/+|\/+$/g, "");
    if (path && path !== "index.html") return path;

    return "home";
}

function parseNewsUrl() {
    const params = new URLSearchParams(location.search);
    // backwards compat: rewrite old slug=news to slug=journal
    if (params.get("slug") === "news") {
        params.set("slug", "journal");
        history.replaceState({}, "", "?" + params.toString());
    }
    let article = params.get("article") || null;
    // workaround for accidentally .yml published urls
    if (article && article.endsWith(".yml")) {
        article = article.slice(0, -4);
        params.set("article", article);
        history.replaceState({}, "", "?" + params.toString());
    }
    return {
        slug: params.get("slug") || "home",
        article
    };
}

function load() {
    window.scrollTo(0, 0);
    const newsRoute = parseNewsUrl();

    if (newsRoute.slug === "journal") {
        const loadNews = cachedNews
            ? Promise.resolve(cachedNews)
            : fetchNews()
                .then(json => (cachedNews = json));

        return loadNews.then(news => {
            const { article } = newsRoute;

            if (article) {
                const manifestEntry = news.find(p => p.Slug === article);
                if (!manifestEntry) {
                    const loadData = cachedData
                        ? Promise.resolve(cachedData)
                        : fetchData().then(json => (cachedData = json));
                    return loadData.then(data => {
                        const e = data.pages["404"];
                        renderPage(e.Title, e.Body, e.Title);
                    });
                }

                return fetchArticle(manifestEntry.File).then(match => {
                    const [yr, mo, da] = match.Date.split("-");
                    const dispDate = `${mo}-${da}-${yr}`;
                    const body = `
                    <hr>
                    <h2>${match.Title}</h2>
                    <p><em>${dispDate} — ${match.Author}</em></p>
                    <p><a href="?slug=journal" data-nav><- Back</a></p>

              ${match.Body}

                    <p><a href="?slug=journal" data-nav><- Back</a></p>
            `;
                    renderPage("Journal", body, match.Title);
                });
            }

            // group posts by year then month, most recent first
            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            const byYear = {};
            news.forEach(post => {
                const [yr, mo] = post.Date.split("-");
                const mIdx = parseInt(mo, 10) - 1;
                byYear[yr] = byYear[yr] || {};
                byYear[yr][mIdx] = byYear[yr][mIdx] || [];
                byYear[yr][mIdx].push(post);
            });

            const sortedYears = Object.keys(byYear).sort().reverse();

            let articlesHtml = `<div class="journal-list">
                <div class="journal-row journal-header">
                    <span class="journal-year">Date</span>
                    <span class="journal-month"></span>
                    <span class="journal-day"></span>
                    <span class="journal-title">Title</span>
                    <span class="journal-author">Author</span>
                </div>`;
            let rowIndex = 0;
            let lastYear = null;
            let lastMonth = null;
            sortedYears.forEach(yr => {
                const sortedMonths = Object.keys(byYear[yr])
                    .map(Number)
                    .sort((a, b) => b - a);
                sortedMonths.forEach(mIdx => {
                    byYear[yr][mIdx]
                        .sort((a, b) => b.Date.localeCompare(a.Date))
                        .forEach(post => {
                            const stripe = rowIndex % 2 === 0 ? "journal-row-even" : "journal-row-odd";
                            const showYear = yr !== lastYear;
                            const showMonth = showYear || mIdx !== lastMonth;
                            const day = post.Date.split("-")[2];
                            articlesHtml += `
                            <a href="?slug=journal&article=${encodeURIComponent(post.Slug)}" data-nav class="journal-row ${stripe}">
                                <span class="journal-year">${showYear ? yr : ""}</span>
                                <span class="journal-month">${showMonth ? monthNames[mIdx] : ""}</span>
                                <span class="journal-day">${day}</span>
                                <span class="journal-title">${post.Title}</span>
                                <span class="journal-author">${post.Author}</span>
                            </a>`;
                            lastYear = yr;
                            lastMonth = mIdx;
                            rowIndex++;
                        });
                });
            });
            articlesHtml += `</div>`;

            const body = `
            <hr>
            <h2>Journal</h2>
            <p><a href="/rss.xml" class="nav-btn">[rss]</a></p>

        ${articlesHtml}
      `;
            renderPage("Journal", body, "Journal");
        });
    }

    const loadData = cachedData
        ? Promise.resolve(cachedData)
        : fetchData()
            .then(json => (cachedData = json));

    return loadData
        .then(data => {
            const slug = getSlug();
            let entry = data.pages[slug] || data.pages["404"];
            renderPage(entry.Title, entry.Body, entry.Title || "Page");
        })
        .catch(err => {
            render(html`<pre>Failed to load: ${err.message}</pre>`, main);
        });
}

function renderPage(title, body, pageTitle) {
    const nav = html`
    <header class="text-center">

<pre>
░█▀▀░█▀█░█▀▀░█░█░█▀█░█▀█░▀█▀░
░█▀▀░█░█░█░░░█▀█░█▀█░█░█░░█░░
░▀▀▀░▀░▀░▀▀▀░▀░▀░▀░▀░▀░▀░░▀░░

<span class="text-muted"><b>Making games worthy of the human.</b></span>
</pre>

        <button class="hamburger" aria-label="Menu" onclick="document.querySelector('.header-nav').classList.toggle('open'); document.querySelector('.nav-backdrop').classList.toggle('open')">&#9776;</button>
        <div class="nav-backdrop" onclick="this.classList.remove('open'); document.querySelector('.header-nav').classList.remove('open')"></div>
        <nav class="header-nav" onclick="if(event.target.closest('a')){this.classList.remove('open'); document.querySelector('.nav-backdrop').classList.remove('open')}">
        ${menuOrder.map(key =>
            html`<a href="/?slug=${key}" data-nav>[${displayName(key)}]</a>`
        )}
        </nav>
        </header>
  `;

    const currentYear = new Date().getFullYear();
    const footer = html`
    <footer class="text-center">

    <hr>

    <nav class="footer-nav">
        ${menuOrder.map(key =>
            html`<a href="/?slug=${key}" data-nav>[${displayName(key)}]</a>`
        )}
    </nav>



        <p class="text-muted">(c) ${currentYear} enchant.games</p>

        <p><b>Curious what we're building? Follow along.</b></p>

        <p>
        <a href="https://discord.gg/h6sFUNzaFj"><img alt="Discord logo" loading="lazy" height="75" width="75" src="/images/discord.webp"></a>
        <a href="https://www.twitch.tv/enchantdev"><img alt="Twitch.tv logo" loading="lazy" height="75" width="75" src="/images/twitch.webp"></a>
        <a href="https://www.youtube.com/@enchantdev"><img alt="Youtube logo" loading="lazy" height="75" width="75" src="/images/youtube.webp"></a>
        <a href="https://www.reddit.com/r/LoEGames"><img alt="Reddit logo" loading="lazy" height="75" width="75" src="/images/reddit.webp"></a>
        <a href="https://x.com/enchantdev575"><img alt="Twitter logo" loading="lazy" height="75" width="75" src="/images/twitter.webp"></a>
        <a href="https://github.com/LandOfEnchantment"><img alt="Github logo" loading="lazy" height="75" width="75" src="/images/github.webp"></a>
        </p>

    </footer>
  `;

    const view = html`
    <main>
    <h1 class="text-center">${title}</h1>
      ${nav}
      <article id="page-body">${unsafeHTML(body)}</article>
      </main>
    ${footer}
  `;

    document.title = `${pageTitle} - Land of Enchantment Games`;
    render(view, main);
}

document.addEventListener("click", e => {
    const a = e.target.closest("a[data-nav]");
    if (!a) return;
    e.preventDefault();
    history.pushState({}, "", a.getAttribute("href"));
    requestAnimationFrame(load);
});

window.addEventListener("popstate", load);
window.addEventListener("DOMContentLoaded", load);
