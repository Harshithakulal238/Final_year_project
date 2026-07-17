const BOOKMARKS_KEY = 'kgss_bookmarks';

export const getBookmarkedSchemes = () => {
  const raw = localStorage.getItem(BOOKMARKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const addBookmark = (schemeId) => {
  const bookmarks = getBookmarkedSchemes();
  if (!bookmarks.includes(schemeId)) {
    bookmarks.push(schemeId);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }
};

export const removeBookmark = (schemeId) => {
  const bookmarks = getBookmarkedSchemes();
  const filtered = bookmarks.filter(id => id !== schemeId);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
};

export const isBookmarked = (schemeId) => {
  const bookmarks = getBookmarkedSchemes();
  return bookmarks.includes(schemeId);
};

export const toggleBookmark = (schemeId) => {
  if (isBookmarked(schemeId)) {
    removeBookmark(schemeId);
    return false;
  } else {
    addBookmark(schemeId);
    return true;
  }
};