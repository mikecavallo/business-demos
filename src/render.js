// HTML templates. Every value from the brief or the model goes through esc().
// Structural facts (phone, email, hours, credentials, reviews) are inserted
// here from the brief, never from generated copy.

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pick dark or white text for a background color, by WCAG contrast. */
export function readableOn(hex) {
  const l = luminance(hex);
  const white = 1.05 / (l + 0.05);
  const dark = (l + 0.05) / (luminance('#111827') + 0.05);
  return white >= dark ? '#ffffff' : '#111827';
}

function telHref(phone) {
  return `tel:+1${phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`;
}

export const PAGES = [
  { file: 'index.html', label: 'Home' },
  { file: 'services.html', label: 'Services' },
  { file: 'about.html', label: 'About' },
  { file: 'contact.html', label: 'Contact' },
];

export function renderStyles(brief) {
  const { primary, accent } = brief.colors;
  return `:root {
  --primary: ${primary};
  --on-primary: ${readableOn(primary)};
  --accent: ${accent};
  --on-accent: ${readableOn(accent)};
  --ink: #111827;
  --muted: #4b5563;
  --surface: #ffffff;
  --soft: #f3f4f6;
  --radius: 10px;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--surface); line-height: 1.6; }
a { color: var(--primary); }
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
.ribbon { background: #fef3c7; color: #78350f; text-align: center; padding: 8px 16px; font-size: 0.9rem; border-bottom: 1px solid #fcd34d; }
.ribbon strong { font-weight: 700; }
header.site { background: var(--surface); border-bottom: 1px solid #e5e7eb; }
header.site .wrap { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding-top: 14px; padding-bottom: 14px; }
.brand { font-weight: 800; font-size: 1.2rem; color: var(--ink); text-decoration: none; }
nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; padding: 0; }
nav a { text-decoration: none; color: var(--muted); font-weight: 600; }
nav a[aria-current="page"] { color: var(--primary); }
.call { background: var(--accent); color: var(--on-accent); padding: 8px 14px; border-radius: var(--radius); text-decoration: none; font-weight: 700; white-space: nowrap; }
.hero { background: var(--primary); color: var(--on-primary); padding: 64px 0; }
.hero h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); line-height: 1.15; margin: 0 0 12px; }
.hero p { font-size: 1.15rem; margin: 0 0 24px; max-width: 46rem; }
.btn { display: inline-block; background: var(--accent); color: var(--on-accent); padding: 12px 22px; border-radius: var(--radius); font-weight: 700; text-decoration: none; border: 0; font-size: 1rem; cursor: pointer; }
.btn.ghost { background: transparent; color: inherit; border: 2px solid currentColor; margin-left: 8px; }
section { padding: 48px 0; }
section.soft { background: var(--soft); }
h2 { font-size: 1.6rem; margin: 0 0 16px; }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card { background: var(--surface); border: 1px solid #e5e7eb; border-radius: var(--radius); padding: 20px; }
.card h3 { margin: 0 0 8px; font-size: 1.1rem; color: var(--primary); }
.card p { margin: 0; color: var(--muted); }
blockquote { margin: 0; }
blockquote footer { margin-top: 10px; font-weight: 600; color: var(--ink); }
.cta { background: var(--primary); color: var(--on-primary); text-align: center; }
.cta p { margin: 0 0 20px; }
.badges { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
.badges li { background: var(--soft); border-radius: 999px; padding: 4px 12px; font-size: 0.9rem; }
form { display: grid; gap: 14px; max-width: 560px; }
label { font-weight: 600; display: grid; gap: 6px; }
input, textarea { font: inherit; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; }
.notice { background: #fef3c7; color: #78350f; border: 1px solid #fcd34d; padding: 10px 14px; border-radius: 8px; }
.contact-grid { display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
footer.site { background: #111827; color: #d1d5db; padding: 28px 0; font-size: 0.9rem; }
footer.site a { color: #ffffff; }
@media (max-width: 600px) { .btn.ghost { margin: 10px 0 0; } }
`;
}

function layout(brief, page, title, description, body) {
  const nav = PAGES.map((p) =>
    `<li><a href="${p.file}"${p.file === page ? ' aria-current="page"' : ''}>${p.label}</a></li>`).join('');
  const ribbon = brief.demo
    ? `<div class="ribbon" role="note"><strong>Demo site, fictional business.</strong> Generated from a sample brief to show the site generator. Not a real company; the phone number is a reserved 555 number.</div>`
    : '';
  const demoFooter = brief.demo
    ? `<p>This is a demonstration site for a fictional business. <a href="../../index.html">See all demo sites</a>.</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${brief.demo ? '<meta name="robots" content="noindex">\n' : ''}<link rel="stylesheet" href="style.css">
</head>
<body>
${ribbon}
<header class="site"><div class="wrap">
<a class="brand" href="index.html">${esc(brief.name)}</a>
<nav aria-label="Main"><ul>${nav}</ul></nav>
<a class="call" href="${telHref(brief.phone)}">Call ${esc(brief.phone)}</a>
</div></header>
<main>
${body}
</main>
<footer class="site"><div class="wrap">
<p>${esc(brief.name)} &middot; ${esc(brief.city)} &middot; <a href="${telHref(brief.phone)}">${esc(brief.phone)}</a></p>
${demoFooter}
</div></footer>
</body>
</html>
`;
}

function reviewsSection(brief) {
  if (!brief.reviews.length) return '';
  const cards = brief.reviews.map((r) => `<blockquote class="card"><p>${esc(r.text)}</p><footer>${esc(r.author)}${r.source ? `, via ${esc(r.source)}` : ''}</footer></blockquote>`).join('\n');
  return `<section class="soft" id="reviews"><div class="wrap">
<h2>Reviews</h2>
<div class="grid">
${cards}
</div>
</div></section>`;
}

function ctaSection(brief, copy) {
  return `<section class="cta"><div class="wrap">
<h2>${esc(copy.ctaHeadline)}</h2>
<p>${esc(copy.ctaText)}</p>
<a class="btn" href="contact.html">Contact us</a>
</div></section>`;
}

function renderHome(brief, copy) {
  const services = copy.services.map((s) => `<div class="card"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div>`).join('\n');
  const highlights = copy.highlights.map((h) => `<div class="card"><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`).join('\n');
  return layout(brief, 'index.html', `${brief.name} | ${brief.trade} in ${brief.city}`, copy.metaDescription, `<section class="hero"><div class="wrap">
<h1>${esc(copy.heroHeadline)}</h1>
<p>${esc(copy.heroSubhead)}</p>
<a class="btn" href="contact.html">Request service</a><a class="btn ghost" href="services.html">View services</a>
</div></section>
<section><div class="wrap">
<p>${esc(copy.intro)}</p>
</div></section>
<section class="soft"><div class="wrap">
<h2>What we do</h2>
<div class="grid">
${services}
</div>
</div></section>
<section><div class="wrap">
<h2>Why ${esc(brief.name.replace(/\s*\(fictional demo\)\s*/i, ''))}</h2>
<div class="grid">
${highlights}
</div>
</div></section>
${reviewsSection(brief)}
${ctaSection(brief, copy)}`);
}

function renderServices(brief, copy) {
  const items = copy.services.map((s) => `<div class="card"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div>`).join('\n');
  return layout(brief, 'services.html', `Services | ${brief.name}`, copy.metaDescription, `<section class="hero"><div class="wrap">
<h1>Services</h1>
<p>${esc(copy.serviceAreaText)}</p>
</div></section>
<section><div class="wrap">
<div class="grid">
${items}
</div>
</div></section>
${ctaSection(brief, copy)}`);
}

function renderAbout(brief, copy) {
  const paragraphs = copy.aboutParagraphs.map((p) => `<p>${esc(p)}</p>`).join('\n');
  const credentials = brief.credentials.length
    ? `<h2>Credentials</h2>\n<ul class="badges">${brief.credentials.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
    : '';
  return layout(brief, 'about.html', `About | ${brief.name}`, copy.metaDescription, `<section class="hero"><div class="wrap">
<h1>${esc(copy.aboutHeadline)}</h1>
</div></section>
<section><div class="wrap">
${paragraphs}
${credentials}
<h2>Service area</h2>
<p>${esc(copy.serviceAreaText)}</p>
</div></section>
${ctaSection(brief, copy)}`);
}

function renderContact(brief, copy) {
  const fields = `<label>Name <input name="name" autocomplete="name" required></label>
<label>Phone or email <input name="contact" autocomplete="email" required></label>
<label>How can we help? <textarea name="message" rows="5" required></textarea></label>
<button class="btn" type="submit">Send message</button>`;
  const form = brief.formEndpoint
    ? `<form action="${esc(brief.formEndpoint)}" method="post">
${fields}
</form>`
    : `<form data-demo-form>
<p class="notice">Demo form: it is not connected to an inbox, so nothing you enter is sent or stored.</p>
${fields}
<p class="notice" data-demo-status hidden role="status">Thanks for trying the demo. On a live site this message would go to the business.</p>
</form>
<script>
document.querySelector('[data-demo-form]').addEventListener('submit', function (event) {
  event.preventDefault();
  this.querySelector('[data-demo-status]').hidden = false;
});
</script>`;
  const email = brief.email ? `<p><strong>Email:</strong> <a href="mailto:${esc(brief.email)}">${esc(brief.email)}</a></p>` : '';
  const hours = brief.hours ? `<p><strong>Hours:</strong> ${esc(brief.hours)}</p>` : '';
  return layout(brief, 'contact.html', `Contact | ${brief.name}`, copy.metaDescription, `<section class="hero"><div class="wrap">
<h1>Contact ${esc(brief.name.replace(/\s*\(fictional demo\)\s*/i, ''))}</h1>
<p>${esc(copy.contactIntro)}</p>
</div></section>
<section><div class="wrap contact-grid">
<div>
<h2>Get in touch</h2>
<p><strong>Phone:</strong> <a href="${telHref(brief.phone)}">${esc(brief.phone)}</a></p>
${email}
${hours}
<p><strong>Service area:</strong> ${esc([brief.city, ...brief.serviceArea].join(', '))}</p>
</div>
<div>
<h2>Send a message</h2>
${form}
</div>
</div></section>`);
}

/** Render every file for a site. Returns { filename: contents }. */
export function renderSite(brief, copy) {
  return {
    'index.html': renderHome(brief, copy),
    'services.html': renderServices(brief, copy),
    'about.html': renderAbout(brief, copy),
    'contact.html': renderContact(brief, copy),
    'style.css': renderStyles(brief),
  };
}
