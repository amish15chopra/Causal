import { WebSearch } from './src/infrastructure/search/webSearch';

async function testSearch() {
  const search = WebSearch.getInstance();
  const query = 'Current US Federal Reserve interest rate policy March 2026';
  
  console.log('--- SEARCH TEST START ---');
  const result = await search.search(query);
  console.log('--- SEARCH RESULT ---');
  console.log(result ? 'SUCCESS: Context retrieved.' : 'FAILURE: No context returned.');
  if (result) {
    console.log(result.substring(0, 500) + '...');
  }
  
  console.log('\n--- CACHE TEST START ---');
  const startTime = Date.now();
  await search.search(query);
  const duration = Date.now() - startTime;
  console.log(`Cache hit duration: ${duration}ms`);
  console.log('--- TEST END ---');
}

testSearch().catch(console.error);
