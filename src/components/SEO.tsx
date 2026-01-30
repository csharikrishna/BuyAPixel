import { Helmet } from 'react-helmet-async';

interface SEOProps {
   title: string;
   description?: string;
   canonical?: string;
   image?: string;
   type?: 'website' | 'article' | 'profile';
   structuredData?: object | object[];
   noindex?: boolean;
}

const SEO = ({
   title,
   description = 'Own a piece of internet history. Buy pixels, upload your image, and leave your mark forever on the global digital canvas.',
   canonical,
   image = 'https://buyapixel.in/og-image.jpg', // Default OG image
   type = 'website',
   structuredData,
   noindex = false,
}: SEOProps) => {
   const siteUrl = 'https://buyapixel.in';
   const fullUrl = canonical || (typeof window !== 'undefined' ? window.location.href : siteUrl);

   const jsonLd = Array.isArray(structuredData) ? structuredData : [structuredData];

   return (
      <Helmet>
         {/* Standard Metadata */}
         <title>{title} | BuyAPixel</title>
         <meta name="description" content={description} />
         {canonical && <link rel="canonical" href={canonical} />}
         {noindex && <meta name="robots" content="noindex, nofollow" />}

         {/* Open Graph / Facebook */}
         <meta property="og:type" content={type} />
         <meta property="og:url" content={fullUrl} />
         <meta property="og:title" content={title} />
         <meta property="og:description" content={description} />
         <meta property="og:image" content={image} />
         <meta property="og:site_name" content="BuyAPixel" />

         {/* Twitter */}
         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:url" content={fullUrl} />
         <meta name="twitter:title" content={title} />
         <meta name="twitter:description" content={description} />
         <meta name="twitter:image" content={image} />

         {/* Structured Data (JSON-LD) for AEO */}
         {structuredData && (
            <script type="application/ld+json">
               {JSON.stringify(jsonLd)}
            </script>
         )}
      </Helmet>
   );
};

export default SEO;
