/**
 * VCard Utility Functions
 * Provides functions for generating, downloading, and parsing VCard contact data
 */

export interface VCardProfile {
   full_name: string | null;
   phone_number: string | null;
   email: string | null;
}

/**
 * Generates a VCard 3.0 formatted string from profile data
 * @param profile - User profile containing contact information
 * @param userId - User ID for profile URL
 * @param origin - Window origin for URL generation (defaults to current origin)
 * @returns VCard formatted string
 */
export const generateVCard = (
   profile: VCardProfile,
   userId: string,
   origin: string = window.location.origin
): string => {
   const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${profile.full_name || 'BuyAPixel User'}`,
   ];

   if (profile.email) {
      lines.push(`EMAIL;TYPE=INTERNET:${profile.email}`);
   }

   if (profile.phone_number) {
      lines.push(`TEL;TYPE=CELL:${profile.phone_number}`);
   }

   lines.push(`URL:${origin}/profile?id=${userId}`);
   lines.push('NOTE:Scanned via BuyAPixel');
   lines.push('END:VCARD');

   return lines.join('\n');
};

/**
 * Downloads a VCard string as a .vcf file
 * @param vcardString - The VCard formatted string
 * @param filename - Optional filename (defaults to 'contact.vcf')
 */
export const downloadVCard = (
   vcardString: string,
   filename: string = 'contact.vcf'
): void => {
   const blob = new Blob([vcardString], { type: 'text/vcard' });
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.href = url;
   link.download = filename;
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   URL.revokeObjectURL(url);
};

/**
 * Parses a VCard string to extract the full name
 * @param vcardString - The VCard formatted string
 * @returns The full name from the VCard, or 'Contact' if not found
 */
export const parseVCardName = (vcardString: string): string => {
   const nameMatch = vcardString.match(/FN:(.*)$/m);
   return nameMatch ? nameMatch[1].trim() : 'Contact';
};

/**
 * Checks if a string is a valid VCard format
 * @param text - The text to check
 * @returns true if the text starts with BEGIN:VCARD
 */
export const isVCard = (text: string): boolean => {
   return text.startsWith('BEGIN:VCARD');
};

/**
 * Sanitizes a name for use in filenames
 * @param name - The name to sanitize
 * @returns Name with spaces replaced by underscores
 */
export const sanitizeFilename = (name: string): string => {
   return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
};
