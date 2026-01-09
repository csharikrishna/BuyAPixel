export const getInitials = (name: string | null): string => {
   if (!name || name.trim().length === 0) return 'U';
   return name
      .trim()
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
};
