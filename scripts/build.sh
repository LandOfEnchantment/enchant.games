#!/bin/sh
set -e
BASE="https://enchant.games"

# --- pages.json ---
(printf '['; sep=''; for f in pages/*.yml; do printf '%s"%s"' "$sep" "$(basename "$f")"; sep=','; done; printf ']\n') > pages.json

# --- news.json ---
{
printf '['
sep=''
for f in news/*.yml; do
    fname=$(basename "$f")
    t=$(awk '/^title:/{$1=""; print substr($0,2)}' "$f")
    s=$(awk '/^slug:/{print $2}' "$f")
    d=$(awk '/^date:/{print $2}' "$f")
    a=$(awk '/^author:/{$1=""; print substr($0,2)}' "$f")
    printf '%s{"title":"%s","slug":"%s","date":"%s","author":"%s","file":"%s"}' \
        "$sep" "$t" "$s" "$d" "$a" "$fname"
    sep=','
done
printf ']\n'
} > news.json
echo "Built pages.json and news.json"

# --- sitemap.xml ---
{
printf '<?xml version="1.0" encoding="UTF-8"?>\n'
printf '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for f in pages/*.yml; do
    slug=$(awk '/^slug:/{print $2}' "$f")
    case "$slug" in 404|500) continue;; esac
    printf '  <url><loc>%s/?slug=%s</loc></url>\n' "$BASE" "$slug"
done
for f in news/*.yml; do
    slug=$(awk '/^slug:/{print $2}' "$f")
    printf '  <url><loc>%s/?slug=news&amp;article=%s</loc></url>\n' "$BASE" "$slug"
done
printf '</urlset>\n'
} > sitemap.xml
echo "Built sitemap.xml"

# --- rss.xml ---
xmlesc() { printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g' | sed "s/'/\&#39;/g"; }

{
printf '<?xml version="1.0" encoding="UTF-8"?>\n'
printf '<rss version="2.0">\n'
printf '  <channel>\n'
printf '    <title>Land of Enchantment Games - News</title>\n'
printf '    <link>%s/?slug=news</link>\n' "$BASE"
printf '    <description>Updates from Land of Enchantment Games</description>\n'

latest=$(ls -r news/*.yml | head -1)
d=$(awk '/^date:/{print $2}' "$latest")
printf '    <lastBuildDate>%s</lastBuildDate>\n' "$(date -u -d "$d" '+%a, %d %b %Y 00:00:00 +0000')"

for f in $(ls -r news/*.yml); do
    title=$(awk '/^title:/{$1=""; print substr($0,2)}' "$f")
    slug=$(awk '/^slug:/{print $2}' "$f")
    d=$(awk '/^date:/{print $2}' "$f")
    pub=$(date -u -d "$d" '+%a, %d %b %Y 00:00:00 +0000')
    desc=$(awk '/^body:/{found=1;next} found{print}' "$f" \
        | sed 's/^  //' \
        | sed 's/<[^>]*>//g; s/#//g' \
        | tr '\n' ' ' \
        | sed 's/  */ /g; s/^ //' \
        | cut -c1-300)

    printf '    <item>\n'
    printf '      <title>%s</title>\n' "$(xmlesc "$title")"
    printf '      <link>%s/?slug=news&amp;article=%s</link>\n' "$BASE" "$slug"
    printf '      <guid>%s/?slug=news&amp;article=%s</guid>\n' "$BASE" "$slug"
    printf '      <pubDate>%s</pubDate>\n' "$pub"
    printf '      <description>%s</description>\n' "$(xmlesc "$desc")"
    printf '    </item>\n'
done

printf '  </channel>\n'
printf '</rss>\n'
} > rss.xml
echo "Built rss.xml"
