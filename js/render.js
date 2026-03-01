import { html, render } from '/js/lit/lit-html/lit-html.js';
import { unsafeHTML } from '/js/lit/lit-html/directives/unsafe-html.js';
import { loadData as fetchData, loadNews as fetchNews } from '/js/content-loader.js';

// using Lit only as a HTML renderer + client-side router, not leveraging its reactive components.

const main = document.querySelector("main");
let cachedNews = null;
let cachedData = null;

const menuOrder = ["home", "values", "team", "news"];

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
    return {
        slug: params.get("slug") || "home",
        article: params.get("article") || null,
        year: params.get("year") || null
    };
}

function load() {
    window.scrollTo(0, 0);
    const newsRoute = parseNewsUrl();

    if (newsRoute.slug === "news") {
        const loadNews = cachedNews
            ? Promise.resolve(cachedNews)
            : fetchNews()
                .then(json => (cachedNews = json));

        return loadNews.then(news => {
            const { article, year } = newsRoute;
            const match = article
                ? news.find(p => p.Slug === article)
                : null;

            if (match) {
                // reformat ISO “YYYY-MM-DD” back to your original MM-DD-YYYY display
                const [yr, mo, da] = match.Date.split("-");
                const dispDate = `${mo}-${da}-${yr}`;
                const body = `
                <hr>
                <h2>${match.Title}</h2>
                <p><em>${dispDate} — ${match.Author}</em></p>
                <p><a href="?slug=news&year=${yr}" data-nav><- Back</a></p>

          ${match.Body}
        `;
                renderPage("News", body, match.Title);
                return;
            }

            // build year navigation (using ISO year)
            const years = [...new Set(news.map(p => p.Date.split("-")[0]))]
                .sort()
                .reverse();
            const selectedYear = year || years[0];
            const yearNav = years
                .map(y =>
                    y === selectedYear
                        ? `<strong>${y}</strong>`
                        : `<a href="?slug=news&year=${y}" data-nav>${y}</a>`
                )
                .join(" | ");

            // filter posts for the selected year
            const filtered = news.filter(p =>
                p.Date.startsWith(selectedYear + "-")
            );

            // group by month index
            const byMonth = filtered.reduce((acc, post) => {
                // post.Date is ISO “YYYY-MM-DD”: split out MM
                const [, mo] = post.Date.split("-");
                const monthIdx = parseInt(mo, 10) - 1; // 0–11 as before

                acc[monthIdx] = acc[monthIdx] || [];
                acc[monthIdx].push(post);
                return acc;
            }, {});

            // month names lookup
            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            // sort months descending
            const sortedMonths = Object.keys(byMonth)
                .map(Number)
                .sort((a, b) => b - a);

            // build HTML by month
            let articlesHtml = "";
            sortedMonths.forEach(mIdx => {
                articlesHtml += `<h3>${monthNames[mIdx]}</h3>`;
                byMonth[mIdx]
                    // ISO dates sort lexicographically; this avoids Date.parse quirks
                    .sort((a, b) => b.Date.localeCompare(a.Date))
                    .forEach(post => {
                        articlesHtml += `
                        <p>
                        <a href="?slug=news&article=${encodeURIComponent(post.Slug)}" data-nav>
                  ${post.Title}
                  </a>
                  </p>
            `;
                    });
            });

            const body = `
            <hr>
            <p>${yearNav}</p>


            <h2>${selectedYear}</h2>

        ${articlesHtml}
      `;
            renderPage("News", body, "News");
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

        <nav>
        ${menuOrder.map(key =>
            html`<a href="/?slug=${key}" data-nav>${displayName(key)}</a>`
        )}
        </nav>
        </header>
  `;

    const currentYear = new Date().getFullYear();
    const footer = html`
    <footer class="text-center">

    <hr>

    <nav>
        ${menuOrder.map(key =>
            html`<a href="/?slug=${key}" data-nav>${displayName(key)}</a>`
        )}
    </nav>



        <p class="text-muted">(c) ${currentYear} enchant.games</p>

        <p><b>Curious what we’re building? Follow along.</b></p>

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
