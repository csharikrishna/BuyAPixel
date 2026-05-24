// Centralized branding configurations loaded from client-side environment variables
export const LOGO = import.meta.env.VITE_LOGO_PATH || "/logo/light_theme.jpeg";

/**
 * Builds a fully qualified URL for SEO and schema crawlers.
 * Gracefully handles relative paths or absolute external CDN URLs.
 */
export const getFullLogoUrl = (logoPath: string): string => {
   if (logoPath.startsWith("http://") || logoPath.startsWith("https://")) {
      return logoPath;
   }
   return `https://buyaspot.in${logoPath.startsWith("/") ? "" : "/"}${logoPath}`;
};
