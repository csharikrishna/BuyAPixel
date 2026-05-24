import { Helmet } from 'react-helmet-async';

interface SEOProps {
   title: string;
   description?: string;
   canonical?: string;
   image?: string;
   imageAlt?: string;
   type?: 'website' | 'article' | 'profile';
   structuredData?: object | object[];
   keywords?: string[];
   author?: string;
   siteName?: string;
   locale?: string;
   noindex?: boolean;
}

const SEO = ({
   title,
   description = 'Own a piece of internet history. Buy pixels, upload your image, and leave your mark forever on the global digital canvas.',
   canonical,
   image = 'https://buyaspot.in/og-image.jpg', // Default OG image
   imageAlt = 'BuyASpot preview image',
   type = 'website',
   structuredData,
   keywords,
   author = 'BuyASpot',
   siteName = 'BuyASpot',
   locale = 'en_IN',
   noindex = false,
}: SEOProps) => {
   const siteUrl = 'https://buyaspot.in';
   const fullUrl = canonical || (typeof window !== 'undefined' ? window.location.href : siteUrl);

   const jsonLd = (Array.isArray(structuredData) ? structuredData : [structuredData]).filter(Boolean);

   return (
      <Helmet>
         {/* Standard Metadata */}
         <title>{title} | BuyASpot</title>
         <meta name="description" content={description} />
         <meta name="author" content={author} />
         {keywords && keywords.length > 0 && (
            <meta name="keywords" content={keywords.join(', ')} />
         )}
         <link rel="canonical" href={fullUrl} />
         <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
         <meta name="theme-color" content="#6366f1" />

         {/* Open Graph / Facebook */}
         <meta property="og:type" content={type} />
         <meta property="og:url" content={fullUrl} />
         <meta property="og:title" content={title} />
         <meta property="og:description" content={description} />
         <meta property="og:image" content={image} />
         <meta property="og:image:alt" content={imageAlt} />
         <meta property="og:site_name" content={siteName} />
         <meta property="og:locale" content={locale} />

         {/* Twitter */}
         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:url" content={fullUrl} />
         <meta name="twitter:title" content={title} />
         <meta name="twitter:description" content={description} />
         <meta name="twitter:image" content={image} />
         <meta name="twitter:image:alt" content={imageAlt} />
         <meta name="twitter:site" content="@BuyASpot" />

         {/* Structured Data (JSON-LD) for AEO */}
         {jsonLd.length > 0 && (
            <script type="application/ld+json">
               {JSON.stringify(jsonLd)}
            </script>
         )}
      </Helmet>
   );
};

export default SEO;
