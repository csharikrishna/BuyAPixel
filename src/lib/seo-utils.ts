import { LOGO, getFullLogoUrl } from "./branding";

export const generateWebsiteSchema = () => ({
   '@context': 'https://schema.org',
   '@type': 'WebSite',
   name: 'BuyASpot',
   url: 'https://buyaspot.in',
   potentialAction: {
      '@type': 'SearchAction',
      target: 'https://buyaspot.in/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
   },
});

export const generateOrganizationSchema = () => ({
   '@context': 'https://schema.org',
   '@type': 'Organization',
   name: 'BuyASpot',
   url: 'https://buyaspot.in',
   logo: getFullLogoUrl(LOGO), // Replace with actual logo URL
   sameAs: [
      'https://github.com/csharikrishna/BuyAPixel',
      'https://twitter.com/BuyASpot',
      'https://instagram.com/buyaspot.in',
      'https://discord.gg/BuyASpot',
   ],
   contactPoint: [
      {
         '@type': 'ContactPoint',
         contactType: 'customer support',
         email: 'support@buyaspot.in',
         availableLanguage: ['en'],
      },
   ],
});

export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
   '@context': 'https://schema.org',
   '@type': 'BreadcrumbList',
   itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
   })),
});

export const generateArticleSchema = (article: {
   title: string;
   description: string;
   image: string;
   author: string;
   publishedAt: string;
   modifiedAt?: string;
   url: string;
}) => ({
   '@context': 'https://schema.org',
   '@type': 'BlogPosting',
   headline: article.title,
   description: article.description,
   image: article.image,
   author: {
      '@type': 'Person',
      name: article.author,
   },
   publisher: {
      '@type': 'Organization',
      name: 'BuyASpot',
      logo: {
         '@type': 'ImageObject',
         url: getFullLogoUrl(LOGO),
      },
   },
   datePublished: article.publishedAt,
   dateModified: article.modifiedAt || article.publishedAt,
   mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
   },
});

export const generateFAQSchema = (faqs: { question: string; answer: string }[]) => ({
   '@context': 'https://schema.org',
   '@type': 'FAQPage',
   mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
         '@type': 'Answer',
         text: faq.answer,
      },
   })),
});

export const generateServiceSchema = () => ({
   '@context': 'https://schema.org',
   '@type': 'Service',
   name: 'Digital Pixel Advertising',
   description: 'Buy, own, and monetize digital pixels on the global 100x100 pixel grid. Permanent digital real estate for your brand.',
   provider: {
      '@type': 'Organization',
      name: 'BuyASpot',
      url: 'https://buyaspot.in',
   },
   url: 'https://buyaspot.in/canvas',
   serviceType: 'Digital Advertising',
   areaServed: {
      '@type': 'Country',
      name: 'IN',
   },
   availableLanguage: ['en', 'hi'],
   hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Pixel Tiers',
      itemListElement: [
         {
            '@type': 'Offer',
            name: 'Gold Zone',
            description: 'Center 60x60 block - highest visibility',
            price: '299',
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
         },
         {
            '@type': 'Offer',
            name: 'Silver Zone',
            description: 'Surrounding area - high visibility',
            price: '99',
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
         },
         {
            '@type': 'Offer',
            name: 'Bronze Zone',
            description: 'Outer edges - premium positioning',
            price: '49',
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
         },
      ],
   },
});

export const generateLocalBusinessSchema = () => ({
   '@context': 'https://schema.org',
   '@type': 'LocalBusiness',
   name: 'BuyASpot',
   description: 'Digital pixel real estate marketplace. Own pixels on the global 100x100 pixel grid forever.',
   url: 'https://buyaspot.in',
   logo: getFullLogoUrl(LOGO),
   foundingDate: '2024',
   address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressLocality: 'India',
   },
   telephone: '',
   email: 'support@buyaspot.in',
   contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@buyaspot.in',
      availableLanguage: ['en', 'hi'],
   },
   sameAs: [
      'https://github.com/csharikrishna/BuyAPixel',
      'https://twitter.com/BuyASpot',
      'https://instagram.com/buyaspot.in',
   ],
});

export const generatePersonSchema = (person: {
   name: string;
   url?: string;
   image?: string;
}) => ({
   '@context': 'https://schema.org',
   '@type': 'Person',
   name: person.name,
   ...(person.url && { url: person.url }),
   ...(person.image && { image: person.image }),
});

export const generatePropertySchema = (property: {
   name: string;
   description: string;
   url: string;
   image?: string;
   price?: number;
}) => ({
   '@context': 'https://schema.org',
   '@type': 'RealEstateProperty',
   name: property.name,
   description: property.description,
   url: property.url,
   propertyType: 'DigitalProperty',
   ...(property.image && { image: property.image }),
   ...(property.price && {
      offers: {
         '@type': 'Offer',
         priceCurrency: 'INR',
         price: property.price,
      },
   }),
});
