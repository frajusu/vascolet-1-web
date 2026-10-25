// Promote only the PNG baselines required by CI out of the ignored laboratory.
// Run after deliberately refreshing the original Windows captures, not in CI.
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'analysis/native-reference'),destination=path.join(root,'tools/fixtures/native');
const files=['boot/boot-2s.png','menus/options.png','catalog/help.png','catalog/credits.png','game/prehistory-start.png','egypt/egypt-start.png','castle/castle-start.png','pirates/pirates-start.png','future/future-start.png','selection-skins/select-5.png'];
const captures=[];
for(const file of files){
  const data=await readFile(path.join(source,file));
  const target=path.join(destination,file);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(source,file),target);
  captures.push({path:file,sha256:createHash('sha256').update(data).digest('hex'),width:data.readUInt32BE(16),height:data.readUInt32BE(20)});
}
await writeFile(path.join(destination,'manifest.json'),JSON.stringify({binarySha256:'7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71',source:'Original Windows backbuffer captures; see docs/reverse-engineering.md',captures},null,2)+'\n');
console.log(`Prepared ${captures.length} versioned native PNG baselines in tools/fixtures/native`);
