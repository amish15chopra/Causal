export interface SearchGateway {
  search(query: string): Promise<string>;
}
