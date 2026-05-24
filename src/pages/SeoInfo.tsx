import SEO from '@/components/SEO';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { generateWebsiteSchema, generateOrganizationSchema } from '@/lib/seo-utils';
import { Helmet } from 'react-helmet-async';

const SeoInfo = () => {
  const structured = [generateWebsiteSchema(), generateOrganizationSchema()];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="About BuyASpot"
        description="Learn how BuyASpot works, use cases, pricing, and SEO best practices for pixel advertising."
        canonical="https://buyaspot.in/seo-info"
        image="https://buyaspot.in/og-image.svg"
        structuredData={structured}
      />
      <Header />

      <main className="container mx-auto px-4 py-12 prose prose-slate dark:prose-invert">
        <h1>Buy Digital Advertising Space Online</h1>

        <p>
          BuyASpot is a simple, transparent marketplace that lets you buy small units of advertising space on an interactive public canvas. Each purchase gives you permanent visibility on the web: an image, a headline, and a link you control. Our platform makes it easy for startups, creators, and businesses to get noticed without recurring fees or complex ad systems.
        </p>

        <h2>What is BuyASpot?</h2>
        <p>
          BuyASpot sells pixel-based advertising tiles on a shared global canvas. Buyers select pixels, upload creatives, and attach a URL. Each ad is addressable, shareable, and discoverable by search engines and modern AI crawlers.
        </p>

        <h2>How BuyASpot Works</h2>
        <ol>
          <li>Select pixels on the canvas using our visual grid and preview tools.</li>
          <li>Upload your image or create a simple creative with our tools.</li>
          <li>Set a destination URL and optional alt text, then checkout.</li>
        </ol>

        <h2>Benefits & Use Cases</h2>
        <p>
          Use BuyASpot to promote product launches, portfolio links, event pages, and other high-value landing pages. Pixel advertising is affordable and permanent — ideal for long-term discoverability.
        </p>

        <h2>SEO & Indexing Notes</h2>
        <p>
          We include semantic HTML, structured data (JSON-LD), and an open sitemap so search engines and modern AI crawlers can index and surface ads. For best results, use descriptive image filenames, add alt text, and use clear CTAs on landing pages.
        </p>
      </main>

      <Footer />
    </div>
  );
};

export default SeoInfo;
