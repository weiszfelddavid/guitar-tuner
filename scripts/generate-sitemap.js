import fs from 'fs';

const LANGUAGES = ['en', 'es', 'fr'];
const BASE_URL = 'https://tuner.weiszfeld.com';

// Extracted from tunings.ts to avoid TS module resolution issues in simple node script
const TUNING_CONFIGS = [
  { instrument: "guitar", slug: "standard" },
  { instrument: "guitar", slug: "drop-d" },
  { instrument: "guitar", slug: "open-g" },
  { instrument: "guitar", slug: "dadgad" },
  { instrument: "guitar", slug: "half-step-down" },
  { instrument: "bass", slug: "standard" },
  { instrument: "bass", slug: "five-string" },
  { instrument: "ukulele", slug: "standard" },
  { instrument: "ukulele", slug: "low-g" },
  { instrument: "cello", slug: "standard" },
];

const generateSitemap = () => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  // Add homepage (default en)
  xml += `  <url>\n    <loc>${BASE_URL}/</loc>\n    <priority>1.0</priority>\n  </url>\n`;

  LANGUAGES.forEach(lang => {
    TUNING_CONFIGS.forEach(tuning => {
      const path = `${lang}/${tuning.instrument}/${tuning.slug}`;
      const url = `${BASE_URL}/${path}`;
      
      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      
      // Alternate language links for this specific tuning
      LANGUAGES.forEach(altLang => {
        xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${BASE_URL}/${altLang}/${tuning.instrument}/${tuning.slug}"/>\n`;
      });
      
      xml += '  </url>\n';
    });
  });

  xml += '</urlset>';

  fs.writeFileSync('./public/sitemap.xml', xml);
  console.log('Sitemap generated successfully in ./public/sitemap.xml');
};

generateSitemap();