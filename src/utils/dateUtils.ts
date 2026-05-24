export const formatDate = (dateString: string | null): string => {
   if (!dateString) return 'Not provided';
   try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      return date.toLocaleDateString('en-US', {
         year: 'numeric',
         month: 'long',
         day: 'numeric'
      });
   } catch {
      return 'Invalid date';
   }
};

export const formatRelativeDate = (dateString: string): string => {
   try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
      const weeks = Math.floor(diffInDays / 7);
      if (diffInDays < 30) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
      const months = Math.floor(diffInDays / 30);
      if (diffInDays < 365) return `${months} month${months !== 1 ? 's' : ''} ago`;
      const years = Math.floor(diffInDays / 365);
      return `${years} year${years !== 1 ? 's' : ''} ago`;
   } catch {
      return formatDate(dateString);
   }
};
