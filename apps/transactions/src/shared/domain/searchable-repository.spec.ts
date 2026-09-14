import { DEFAULT_PER_PAGE, SearchParams, SearchResult } from './searchable-repository';

describe('SearchParams', () => {
  it('starts on the first page with the default size when nothing is informed', () => {
    const params = new SearchParams({});

    expect(params).toMatchObject({ page: 1, perPage: DEFAULT_PER_PAGE, sort: null, sortDir: null });
    expect(params.filter).toBeNull();
  });

  it('falls back to the defaults when page or size are not positive integers', () => {
    expect(new SearchParams({ page: 0, perPage: 2.5 })).toMatchObject({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
    });
    expect(new SearchParams({ page: 3, perPage: 50 })).toMatchObject({ page: 3, perPage: 50 });
  });

  it('only keeps a direction when there is a field to sort by', () => {
    expect(new SearchParams({ sortDir: 'asc' })).toMatchObject({ sort: null, sortDir: null });
    expect(new SearchParams({ sort: 'value' })).toMatchObject({ sort: 'value', sortDir: 'desc' });
    expect(new SearchParams({ sort: 'value', sortDir: 'asc' })).toMatchObject({
      sort: 'value',
      sortDir: 'asc',
    });
  });

  it('keeps the filter as given', () => {
    expect(new SearchParams({ filter: { status: 'pending' } }).filter).toEqual({
      status: 'pending',
    });
  });
});

describe('SearchResult', () => {
  it('derives the last page from the total, never below one', () => {
    const params = new SearchParams({ page: 2, perPage: 10 });

    expect(new SearchResult({ items: [], total: 0, params })).toMatchObject({
      currentPage: 2,
      perPage: 10,
      lastPage: 1,
    });
    expect(new SearchResult({ items: [], total: 21, params }).lastPage).toBe(3);
  });
});
