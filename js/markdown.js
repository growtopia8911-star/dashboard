// Minimal markdown renderer for README display.
// Depends only on esc() from js/util.js, which must load first.

// ── markdown (small subset, enough for a README) ───────────────────────
function rawBase(repo) {
  return "https://raw.githubusercontent.com/" + repo.full_name + "/" +
         (repo.default_branch || "HEAD") + "/";
}

function absolutise(url, repo) {
  if (!url) return "";
  if (/^(https?:|data:|mailto:|#)/i.test(url)) return url;
  return rawBase(repo) + String(url).replace(/^\.?\//, "");
}

function markdown(src, repo) {
  var text = String(src).slice(0, 60000).replace(/\r\n?/g, "\n");

  // Fold the handful of raw-HTML shapes READMEs actually use, then drop the
  // rest. Everything is escaped afterwards, so no markup can survive.
  // NB: the comment pattern is written with escapes so the literal characters
  // "<!--" never appear in this inline script — that sequence flips the HTML
  // parser into escaped-script mode.
  text = text.replace(/<\!--[\s\S]*?--\>/g, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<img\b[^>]*>/gi, function (tag) {
    var src = (tag.match(/src\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
    var alt = (tag.match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || "";
    return src ? "\n![" + alt + "](" + src + ")\n" : "";
  });
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  var lines = text.split("\n");
  var out = [], i = 0;

  function inline(s) {
    var codes = [];
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000";
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, function (_, alt, url) {
      return '<img src="' + esc(absolutise(url, repo)) + '" alt="' + alt + '" loading="lazy">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (_, label, url) {
      var href = absolutise(url, repo);
      if (!/^(https?:|mailto:|#)/i.test(href)) href = "https://github.com/" + repo.full_name;
      return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + label + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
         .replace(/__([^_]+)__/g, "<strong>$1</strong>")
         .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
         // Underscore italics need a word boundary either side so that
         // snake_case_identifiers are not mangled.
         .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>")
         .replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return s.replace(/\u0000(\d+)\u0000/g, function (_, n) {
      // codes[] was captured after esc() ran, so it is already escaped;
      // escaping again would render double-encoded "&amp;gt;" text.
      return "<code>" + codes[+n] + "</code>";
    });
  }

  function flushList(tag, items) {
    out.push("<" + tag + ">" + items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</" + tag + ">");
  }

  while (i < lines.length) {
    var line = lines[i];

    if (/^\s*```/.test(line)) {                       // fenced code
      var buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
      continue;
    }
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { out.push("<hr>"); i++; continue; }

    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      var lvl = h[1].length;
      out.push("<h" + lvl + ">" + inline(h[2].replace(/\s*#+\s*$/, "")) + "</h" + lvl + ">");
      i++; continue;
    }
    if (/^\s*>/.test(line)) {
      var q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push("<blockquote>" + inline(q.join(" ")) + "</blockquote>");
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      var ul = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) ul.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      flushList("ul", ul); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      var ol = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) ol.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      flushList("ol", ol); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      var cells = function (row) {
        return row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); });
      };
      var head = cells(lines[i]); i += 2;
      var rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push("<table><thead><tr>" + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") +
        "</tr></thead><tbody>" + rows.map(function (r) {
          return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody></table>");
      continue;
    }
    if (!line.trim()) { i++; continue; }

    var para = [];
    while (i < lines.length && lines[i].trim() &&
           !/^\s*(?:```|#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\|)/.test(lines[i])) para.push(lines[i++]);
    out.push("<p>" + inline(para.join(" ")) + "</p>");
  }
  return out.join("\n");
}
