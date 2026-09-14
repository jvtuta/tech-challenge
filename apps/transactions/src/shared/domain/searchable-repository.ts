import type { SortDirection } from '@tech-challenge/contracts';

export const DEFAULT_PER_PAGE = 20;

export interface SearchProps<Filter> {
  page?: number;
  perPage?: number;
  sort?: string | null;
  sortDir?: SortDirection | null;
  filter?: Filter | null;
}

/**
 * Entrada normalizada de uma busca paginada. Página e tamanho inválidos caem no padrão em
 * vez de falhar: a borda já validou o formato, aqui só garantimos que a consulta seja sempre
 * executável. A direção só existe quando há campo de ordenação.
 */
export class SearchParams<Filter> {
  readonly page: number;
  readonly perPage: number;
  readonly sort: string | null;
  readonly sortDir: SortDirection | null;
  readonly filter: Filter | null;

  constructor(props: SearchProps<Filter> = {}) {
    this.page = isPositiveInteger(props.page) ? props.page : 1;
    this.perPage = isPositiveInteger(props.perPage) ? props.perPage : DEFAULT_PER_PAGE;
    this.sort = props.sort ? props.sort : null;
    this.sortDir = this.sort ? (props.sortDir ?? 'desc') : null;
    this.filter = props.filter ?? null;
  }
}

export class SearchResult<Item, Filter> {
  readonly items: Item[];
  readonly total: number;
  readonly currentPage: number;
  readonly perPage: number;
  readonly lastPage: number;

  constructor(props: { items: Item[]; total: number; params: SearchParams<Filter> }) {
    this.items = props.items;
    this.total = props.total;
    this.currentPage = props.params.page;
    this.perPage = props.params.perPage;
    this.lastPage = Math.max(1, Math.ceil(this.total / this.perPage));
  }
}

/** Repositório que sabe listar com filtro, paginação e ordenação pelos campos que declara. */
export interface SearchableRepository<Item, Filter> {
  readonly sortableFields: readonly string[];
  search(params: SearchParams<Filter>): Promise<SearchResult<Item, Filter>>;
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}
