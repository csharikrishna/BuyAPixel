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
   logo: 'https://buyaspot.in/logo.png', // Replace with actual logo URL
   sameAs: [
      'https://twitter.com/BuyASpot', // Replace with actual social links
      'https://facebook.com/BuyASpot',
      'https://instagram.com/BuyASpot',
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
         url: 'https://buyaspot.in/logo.png',
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
