// node --test rag/tests/markdown.test.mjs   (lancé aussi par pytest via test_markdown_js.py)
import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";

const {renderMarkdown: md} = createRequire(import.meta.url)("../assistant/static/markdown.js");

test("échappe le HTML et les scripts", () => {
  const html = md('<script>alert(1)</script> <img src=x onerror="alert(2)">');
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("refuse les liens non http(s)", () => {
  assert.ok(!md("[x](javascript:alert(1))").includes("<a"));
  assert.ok(md("[doc](https://example.org/a?b=1&c=2)").includes('<a href="https://example.org/a?b=1&amp;c=2"'));
});

test("titres, gras, italique, code", () => {
  assert.equal(md("## Étapes"), "<h4>Étapes</h4>");
  assert.equal(md("**gras** et *ital* et `code`"), "<p><strong>gras</strong> et <em>ital</em> et <code>code</code></p>");
});

test("snake_case et métriques ne deviennent pas de l'italique", () => {
  assert.equal(md("req_rate et top_ip_share"), "<p>req_rate et top_ip_share</p>");
  assert.equal(md("`payments_total{status=\"accepted\"}`"),
               "<p><code>payments_total{status=&quot;accepted&quot;}</code></p>");
});

test("listes numérotées et imbriquées", () => {
  const html = md("1. Couper la source\n2. Vérifier :\n   - les soldes\n   - les transactions\n3. Fin");
  assert.equal(html, "<ol><li>Couper la source</li><li>Vérifier :<ul><li>les soldes</li><li>les transactions</li></ul></li><li>Fin</li></ol>");
});

test("références de sources cliquables seulement si connues", () => {
  const html = md("Bloquer les IP [1][2].", {citeHref: (n) => (n === 1 ? "#src-1-1" : null)});
  assert.ok(html.includes('<a class="cite" href="#src-1-1" data-ref="1">1</a>'));
  assert.ok(html.includes('<span class="cite">2</span>'));
});

test("bloc de code : contenu brut, sans règle Markdown", () => {
  assert.equal(md("```bash\ncurl -s **x** <y>\n```"), '<pre><code class="lang-bash">curl -s **x** &lt;y&gt;</code></pre>');
});

test("tableau", () => {
  const html = md("| Champ | Valeur |\n|---|---|\n| type | `dos` |");
  assert.equal(html, "<table><thead><tr><th>Champ</th><th>Valeur</th></tr></thead><tbody><tr><td>type</td><td><code>dos</code></td></tr></tbody></table>");
});

test("tableau : `\\|` échappé reste dans la cellule", () => {
  const html = md("| Métrique | Labels |\n|---|---|\n| `payments_total` | `status` = `accepted` \\| `rejected` |");
  assert.equal(html, "<table><thead><tr><th>Métrique</th><th>Labels</th></tr></thead><tbody><tr>" +
    "<td><code>payments_total</code></td><td><code>status</code> = <code>accepted</code> | <code>rejected</code></td></tr></tbody></table>");
});

test("citation et paragraphes", () => {
  assert.equal(md("> **Attention** : ne pas intervenir\n\nSuite"),
               "<blockquote><p><strong>Attention</strong> : ne pas intervenir</p></blockquote><p>Suite</p>");
});
