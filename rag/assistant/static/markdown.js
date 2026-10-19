/* Rendu Markdown minimal et sûr pour les réponses de l'assistant (sans dépendance : la démo
 * doit fonctionner hors ligne).
 *
 * Sécurité : tout le texte est échappé AVANT d'appliquer la moindre règle Markdown ; seules les
 * balises produites ici existent dans le résultat. Une réponse ou un extrait de document contenant
 * du HTML ou un script s'affiche donc comme du texte. Les liens n'acceptent que http(s).
 *
 * Couvre ce que produit le modèle : titres, paragraphes, listes (imbriquées, numérotées),
 * gras/italique/barré, code en ligne et blocs de code, citations, tableaux, séparateurs,
 * liens, et références de sources [1] (rendues cliquables via l'option `citeHref`).
 */
(function (root) {
  "use strict";

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Texte déjà échappé -> HTML inline.
  function inline(text, opts) {
    const slots = [];
    const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;

    // Code en ligne d'abord : son contenu ne doit subir aucune autre règle.
    text = text.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${code}</code>`));
    // Liens [texte](http...) — texte et URL sont déjà échappés.
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, url) => keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`));
    // Références de sources : [1], [2][3], [1, 2]
    text = text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, nums) => keep(nums.split(/\s*,\s*/).map((n) => {
      const href = opts.citeHref ? opts.citeHref(Number(n)) : null;
      return href ? `<a class="cite" href="${href}" data-ref="${n}">${n}</a>` : `<span class="cite">${n}</span>`;
    }).join("")));

    text = text
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
      .replace(/__(?=\S)([\s\S]*?\S)__/g, "<strong>$1</strong>")
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>")
      .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, "$1<em>$2</em>")
      // _italique_ seulement entre limites de mots, pour ne pas casser snake_case / req_rate.
      .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?![\w])/g, "$1<em>$2</em>");

    return text.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)]);
  }

  const RE = {
    fence: /^\s*(```|~~~)\s*([\w-]*)\s*$/,
    heading: /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/,
    hr: /^\s{0,3}([-*_])(\s*\1){2,}\s*$/,
    quote: /^\s{0,3}&gt;\s?(.*)$/,
    item: /^(\s*)([-*+]|\d+[.)])\s+(.*)$/,
    tableRow: /^\s*\|.*\|\s*$/,
    tableSep: /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/,
  };

  function splitRow(line) {
    // `\|` dans une cellule est un caractère littéral, pas un séparateur de colonnes.
    return line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "")
      .split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  }

  function renderList(lines, start, opts) {
    // Construit des listes imbriquées selon l'indentation.
    const out = [];
    const stack = []; // {indent, tag}
    let i = start;
    while (i < lines.length) {
      const m = lines[i].match(RE.item);
      if (!m) {
        // Ligne de continuation indentée d'un élément : rattachée à l'élément courant.
        if (stack.length && /^\s+\S/.test(lines[i]) && !RE.fence.test(lines[i])) {
          out.push("<br>" + inline(lines[i].trim(), opts));
          i++;
          continue;
        }
        break;
      }
      const indent = m[1].replace(/\t/g, "    ").length;
      const tag = /\d/.test(m[2]) ? "ol" : "ul";
      while (stack.length && indent < stack[stack.length - 1].indent) {
        out.push(`</li></${stack.pop().tag}>`);
      }
      const top = stack[stack.length - 1];
      if (!top || indent > top.indent) {
        const startAttr = tag === "ol" && parseInt(m[2], 10) !== 1 ? ` start="${parseInt(m[2], 10)}"` : "";
        out.push(`<${tag}${startAttr}>`);
        stack.push({indent, tag});
      } else {
        out.push("</li>");
      }
      out.push("<li>" + inline(m[3], opts));
      i++;
    }
    while (stack.length) out.push(`</li></${stack.pop().tag}>`);
    return {html: out.join(""), next: i};
  }

  function renderMarkdown(src, opts) {
    opts = opts || {};
    const lines = escapeHtml(String(src || "").replace(/\r\n?/g, "\n")).split("\n");
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) out.push(`<p>${para.map((l) => inline(l.trim(), opts)).join("<br>")}</p>`);
      para = [];
    };

    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      let m;

      if ((m = line.match(RE.fence))) {
        flush();
        const code = [];
        i++;
        while (i < lines.length && !RE.fence.test(lines[i])) code.push(lines[i++]);
        i++; // clôture (ou fin du texte si le modèle l'a oubliée)
        const cls = m[2] ? ` class="lang-${m[2]}"` : "";
        out.push(`<pre><code${cls}>${code.join("\n")}</code></pre>`);
        continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      if ((m = line.match(RE.heading))) {
        flush();
        const level = Math.min(m[1].length + 2, 6); // # -> h3 : reste lisible dans une bulle
        out.push(`<h${level}>${inline(m[2], opts)}</h${level}>`);
        i++;
        continue;
      }
      if (RE.hr.test(line)) { flush(); out.push("<hr>"); i++; continue; }
      if (RE.tableRow.test(line) && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
        flush();
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && RE.tableRow.test(lines[i])) rows.push(splitRow(lines[i++]));
        out.push("<table><thead><tr>" + head.map((c) => `<th>${inline(c, opts)}</th>`).join("") +
                 "</tr></thead><tbody>" +
                 rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c, opts)}</td>`).join("") + "</tr>").join("") +
                 "</tbody></table>");
        continue;
      }
      if (RE.quote.test(line)) {
        flush();
        const inner = [];
        while (i < lines.length && (m = lines[i].match(RE.quote))) { inner.push(m[1]); i++; }
        // Le contenu est déjà échappé : on le rend comme du Markdown sans ré-échapper.
        out.push(`<blockquote>${renderEscaped(inner, opts)}</blockquote>`);
        continue;
      }
      if (RE.item.test(line)) {
        flush();
        const r = renderList(lines, i, opts);
        out.push(r.html);
        i = r.next;
        continue;
      }
      para.push(line);
      i++;
    }
    flush();
    return out.join("");
  }

  // Rendu d'un bloc déjà échappé (contenu de citation).
  function renderEscaped(lines, opts) {
    const unescaped = lines.join("\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    return renderMarkdown(unescaped, opts);
  }

  const api = {renderMarkdown, escapeHtml};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Markdown = api;
})(typeof window !== "undefined" ? window : this);
