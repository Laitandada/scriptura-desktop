import { parseReferences } from './src/lib/bible/parser';
async function test() {
  const result = await parseReferences("Psalm 23:1", async () => true, null);
  console.log(result);
}
test();
