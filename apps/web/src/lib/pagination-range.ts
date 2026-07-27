export type PageToken = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * Windowed page-number list for the Pagination component: always shows the
 * first and last page, a small run of pages around the current one, and
 * collapses the rest behind an ellipsis rather than rendering every page
 * number when there are many (a 200-page result set shouldn't produce 200 buttons).
 */
export function getPageTokens(
  page: number,
  totalPages: number,
  siblingCount = 1,
): PageToken[] {
  if (totalPages <= 0) return [];

  const totalVisible = siblingCount * 2 + 5; // first, last, current, 2 ellipses
  if (totalPages <= totalVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  const tokens: PageToken[] = [1];

  if (showLeftEllipsis) {
    tokens.push('ellipsis-start');
  } else {
    for (let p = 2; p < leftSibling; p++) tokens.push(p);
  }

  for (let p = Math.max(leftSibling, 2); p <= Math.min(rightSibling, totalPages - 1); p++) {
    tokens.push(p);
  }

  if (showRightEllipsis) {
    tokens.push('ellipsis-end');
  } else {
    for (let p = rightSibling + 1; p < totalPages; p++) tokens.push(p);
  }

  tokens.push(totalPages);

  return tokens;
}
