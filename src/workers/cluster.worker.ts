
// workers/cluster.worker.ts
// Module web worker. Self-contained fuzzy clustering engine v5.
// Receives messages: { type: 'start', payload: { mapping, options } }, { type: 'data', payload: { rows } }, { type: 'end' }
// Returns progress and final clusters via postMessage.

type InMsg = any;
declare const postMessage: any;

/* -------------------------
   Utilities & Normalizers
   ------------------------- */
const arabicEquivalenceMap: Record<string, string> = {
  "إ":"ا","أ":"ا","آ":"ا","ى":"ي","ئ":"ي","ؤ":"و","ة":"ه",
  // a few approximations
  "ق":"ك","ك":"ق","ط":"ت","ت":"ط","ه":"ح","ح":"ه","ظ":"ض","ض":"ظ","ز":"ذ","ذ":"ز"
};
function normalizeChar(ch:string){ return arabicEquivalenceMap[ch] || ch; }
function safeString(x:any){ if (x===null || x===undefined) return ""; return String(x); }
function normalizeArabic(text:any){
  if(!text) return "";
  let t = safeString(text).trim();
  t = t.replace(/[^\u0600-\u06FF0-9\s]/g," ").replace(/\s+/g," ");
  // normalize common words
  t = t.replace(/ابن|بن|ولد/g,"بن");
  t = t.replace(/آل|ال/g,"ال");
  t = t.replace(/[.,·•\u200C\u200B]/g,"");
  return t.split("").map(normalizeChar).join("").trim();
}
function tokens(s:any){ const n = normalizeArabic(s||""); if(!n) return []; return n.split(" ").filter(Boolean); }
function digitsOnly(s:any){ if(!s) return ""; return safeString(s).replace(/\D/g,""); }
function normalizeChildrenField(val:any){
  if(!val) return [];
  if(Array.isArray(val)) return val.map(x=>normalizeArabic(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x=>normalizeArabic(x)).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(s1:string, s2:string){
  s1 = safeString(s1); s2 = safeString(s2);
  if(!s1 || !s2) return 0;
  const len1=s1.length, len2=s2.length;
  const matchDist = Math.floor(Math.max(len1,len2)/2)-1;
  const s1m = Array(len1).fill(false), s2m = Array(len2).fill(false);
  let matches=0;
  for(let i=0;i<len1;i++){
    const start=Math.max(0,i-matchDist), end=Math.min(i+matchDist+1,len2);
    for(let j=start;j<end;j++){
      if(s2m[j]) continue;
      if(s1[i] !== s2[j]) continue;
      s1m[i]=true; s2m[j]=true; matches++; break;
    }
  }
  if(matches===0) return 0;
  let k=0, trans=0;
  for(let i=0;i<len1;i++){
    if(!s1m[i]) continue;
    while(!s2m[k]) k++;
    if(s1[i] !== s2[k]) trans++;
    k++;
  }
  trans = trans/2.0;
  const m = matches;
  const jaro = (m/len1 + m/len2 + (m-trans)/m)/3.0;
  let prefix=0, maxPrefix=4;
  for(let i=0;i<Math.min(maxPrefix,len1,len2);i++){
    if(s1[i]===s2[i]) prefix++; else break;
  }
  return jaro + prefix*0.1*(1-jaro);
}
function tokenJaccard(a:string[], b:string[]){
  if(!a.length && !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  const uni = new Set([...A,...B]).size;
  return uni === 0 ? 0 : inter/uni;
}

/* -------------------------
   Name helpers
   ------------------------- */
function reduceNameRoot(full:string){
  const parts = tokens(full);
  return parts.map(p => p.slice(0,3)).join(" ");
}
function extractPaternal(full:string){
  const parts = tokens(full);
  return { father: parts[1] || "", grandfather: parts[2] || "" };
}
function extractMaternal(full:string){
  const parts = tokens(full);
  const L = parts.length;
  return { mother: parts[L-2]||"", grandmother: parts[L-3]||"" };
}
function extractTribal(full:string){
  const parts = tokens(full);
  for(let i=parts.length-1;i>=0;i--) if(parts[i].startsWith("ال")) return parts[i];
  return "";
}
function nameOrderFreeScore(aName:string,bName:string){
  const aT = tokens(aName), bT = tokens(bName);
  if(!aT.length || !bT.length) return 0;
  const A = new Set(aT), B = new Set(bT);
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  const union = new Set([...A,...B]).size; const jacc = union===0?0:inter/union;
  const aSorted = aT.slice().sort().join(" "), bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted,bSorted);
  return 0.7*jacc + 0.3*sj;
}

/* -------------------------
   Pairwise scoring (rules implemented)
   ------------------------- */
function pairwiseScore(aRaw:any,bRaw:any, opts:any){
  const optsDefaults = {
    finalScoreWeights: {
      // component-level weights (these will be visible in settings UI)
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.04,
      locationScore: 0.04
    },
    rules: {
      enableNameRootEngine: true,
      enableTribalLineage: true,
      enableMaternalLineage: true,
      enablePolygamyRules: true
    }
  };
  const o = { ...optsDefaults, ...(opts||{}) };
  const FSW = o.finalScoreWeights;

  const a = {
    womanName: normalizeArabic(aRaw.womanName||""),
    husbandName: normalizeArabic(aRaw.husbandName||""),
    nationalId: safeString(aRaw.nationalId||aRaw.id||""),
    phone: digitsOnly(aRaw.phone||""),
    village: normalizeArabic(aRaw.village||""),
    subdistrict: normalizeArabic(aRaw.subdistrict||""),
    children: normalizeChildrenField(aRaw.children||""),
    raw: aRaw
  };
  const b = {
    womanName: normalizeArabic(bRaw.womanName||""),
    husbandName: normalizeArabic(bRaw.husbandName||""),
    nationalId: safeString(bRaw.nationalId||bRaw.id||""),
    phone: digitsOnly(bRaw.phone||""),
    village: normalizeArabic(bRaw.village||""),
    subdistrict: normalizeArabic(bRaw.subdistrict||""),
    children: normalizeChildrenField(bRaw.children||""),
    raw: bRaw
  };

  // components
  const firstA = tokens(a.womanName)[0]||"";
  const firstB = tokens(b.womanName)[0]||"";
  const familyA = tokens(a.womanName).slice(1).join(" ");
  const familyB = tokens(b.womanName).slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(familyA, familyB);
  const tokenReorderScore = nameOrderFreeScore(a.womanName, b.womanName);

  // advanced root
  const rootA = reduceNameRoot(a.womanName), rootB = reduceNameRoot(b.womanName);
  let advancedNameScore = 0;
  if(rootA && rootB && rootA === rootB) advancedNameScore += 0.35;
  if(rootA && rootB && (rootA.startsWith(rootB) || rootB.startsWith(rootA))) advancedNameScore += 0.2;
  advancedNameScore = Math.min(0.4, advancedNameScore);

  // husband
  const husbandJW = jaroWinkler(a.husbandName, b.husbandName);
  const husbandToken = tokenJaccard(tokens(a.husbandName), tokens(b.husbandName));
  const husbandScore = Math.max(husbandJW, husbandToken);

  // phone & id
  const phoneScore = (a.phone && b.phone) ? (a.phone===b.phone ? 1 : (a.phone.slice(-6)===b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4)===b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId===b.nationalId ? 1 : (a.nationalId.slice(-5)===b.nationalId.slice(-5) ? 0.75 : 0)) : 0;

  const childrenScore = tokenJaccard(a.children, b.children);

  let locationScore = 0;
  if(a.village && b.village && a.village===b.village) locationScore += 0.4;
  if(a.subdistrict && b.subdistrict && a.subdistrict===b.subdistrict) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  // patronymic / maternal / tribal
  const aPat = extractPaternal(a.womanName), bPat = extractPaternal(b.womanName);
  let patronymScore = 0;
  if(aPat.father && bPat.father && aPat.father===bPat.father) patronymScore += 0.35;
  if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) patronymScore += 0.25;
  patronymScore = Math.min(0.5, patronymScore);

  const aMat = extractMaternal(a.womanName), bMat = extractMaternal(b.womanName);
  let maternalScore = 0;
  if(aMat.mother && bMat.mother && aMat.mother===bMat.mother) maternalScore += 0.18;
  if(aMat.grandmother && bMat.grandmother && aMat.grandmother===bMat.grandmother) maternalScore += 0.12;
  maternalScore = Math.min(0.3, maternalScore);

  const tribalScore = (extractTribal(a.womanName) && extractTribal(b.womanName) && extractTribal(a.womanName)===extractTribal(b.womanName)) ? 0.4 : 0;

  // shared husband + paternal line boost (polygamy rule)
  let sharedHusbandPatronym = 0;
  const husbandSimilar = jaroWinkler(a.husbandName,b.husbandName) >= 0.92;
  if(husbandSimilar){
    if(aPat.father && bPat.father && aPat.father===bPat.father) sharedHusbandPatronym += 0.25;
    if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) sharedHusbandPatronym += 0.2;
    if(sharedHusbandPatronym >= 0.4) sharedHusbandPatronym = 0.55;
  }

  // multi-registration detection
  const womanExact = (a.womanName && b.womanName && a.womanName===b.womanName);
  const womanFuzzy = (firstNameScore + familyNameScore + advancedNameScore + tokenReorderScore) / 4;
  const strongNameMatch = (womanExact || womanFuzzy >= 0.85 || tokenReorderScore >= 0.85);
  const multiRegistrationFlag = strongNameMatch && (idScore < 0.5 && phoneScore < 0.5 && husbandScore < 0.5) ? 1 : 0;

  // compose final score from weights
  let score = 0;
  score += FSW.firstNameScore * firstNameScore;
  score += FSW.familyNameScore * familyNameScore;
  score += FSW.advancedNameScore * advancedNameScore;
  score += FSW.tokenReorderScore * tokenReorderScore;
  score += FSW.husbandScore * husbandScore;
  score += FSW.idScore * idScore;
  score += FSW.phoneScore * phoneScore;
  score += FSW.childrenScore * childrenScore;
  score += FSW.locationScore * locationScore;

  if(o.rules.enableNameRootEngine) score += advancedNameScore * 0.12;
  if(o.rules.enableTribalLineage) score += tribalScore * 1.0;
  if(o.rules.enableMaternalLineage) score += maternalScore * 0.7;
  if(o.rules.enablePolygamyRules) score += sharedHusbandPatronym * 1.2;

  score = Math.max(0, Math.min(1, score));

  const breakdown = {
    firstNameScore,
    familyNameScore,
    advancedNameScore,
    tokenReorderScore,
    husbandScore,
    idScore,
    phoneScore,
    childrenScore,
    locationScore,
    patronymScore,
    sharedHusbandPatronym,
    tribalScore,
    maternalScore,
    multiRegistrationFlag,
    strongNameMatch
  };

  return { score, breakdown };
}

/* -------------------------
   Blocking, edges and union-find for scale
   ------------------------- */
function buildBlocks(rows:any[], opts:any){
  const blocks = new Map<string, number[]>();
  const prefix = opts?.blockPrefixSize ?? 4;
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    const nameTokens = tokens(r.womanName||"");
    const first = nameTokens[0]?.slice(0,prefix) || "";
    const last = nameTokens[nameTokens.length-1]?.slice(0,prefix) || "";
    const phone = digitsOnly(r.phone||"").slice(-6);
    const village = normalizeArabic(r.village||"").slice(0,6);
    const clusterKey = r.cluster_id ? `cid:${String(r.cluster_id)}` : "";
    const keys = [];
    if(first) keys.push(`fn:${first}`);
    if(last) keys.push(`ln:${last}`);
    if(phone) keys.push(`ph:${phone}`);
    if(village) keys.push(`vl:${village}`);
    if(clusterKey) keys.push(clusterKey);
    if(keys.length===0) keys.push("blk:all");
    for(const k of keys){
      const arr = blocks.get(k) || [];
      arr.push(i);
      blocks.set(k,arr);
    }
  }
  // convert to array - also merge small blocks into larger to avoid fragmentation
  return Array.from(blocks.values());
}

function pushEdgesForList(list:number[], rows:any[], minScore:number, seen:Set<string>, edges:any[], opts:any){
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const a = list[i], b = list[j];
      const key = a<b? `${a}_${b}`:`${b}_${a}`;
      if(seen.has(key)) continue;
      seen.add(key);
      const { score, breakdown } = pairwiseScore(rows[a], rows[b], opts);
      if(score >= minScore) edges.push({ a, b, score, breakdown });
    }
  }
}

function buildEdges(rows:any[], minScore=0.6, opts:any){
  const blocks = buildBlocks(rows, opts);
  const seen = new Set<string>();
  const edges:any[] = [];
  const chunk = opts?.blockChunkSize ?? 3000;
  for(let bi=0; bi<blocks.length; bi++){
    const block = blocks[bi];
    if(block.length > chunk){
      for(let s=0;s<block.length;s+=chunk){
        const part = block.slice(s,s+chunk);
        pushEdgesForList(part, rows, minScore, seen, edges, opts);
      }
    } else {
      pushEdgesForList(block, rows, minScore, seen, edges, opts);
    }
    if(bi % 200 === 0) postMessage({ type:'progress', status:'building-edges', progress: 10 + Math.round(40 * (bi/blocks.length)), completed: bi+1, total: blocks.length });
  }
  edges.sort((x:any,y:any)=>y.score-x.score);
  return edges;
}

/* Union-Find (with members set) */
class UF {
  parent:number[]; size:number[]; members: Map<number, Set<number>>;
  constructor(n:number){
    this.parent = Array.from({length:n},(_,i)=>i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for(let i=0;i<n;i++) this.members.set(i,new Set([i]));
  }
  find(x:number){
    if(this.parent[x]===x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  merge(a:number,b:number){
    a = this.find(a); b = this.find(b);
    if(a===b) return a;
    if(this.size[a] < this.size[b]) [a,b] = [b,a];
    this.parent[b] = a;
    this.size[a] += this.size[b];
    const mb = this.members.get(b)!; const ma = this.members.get(a)!;
    for(const m of mb) ma.add(m);
    this.members.delete(b);
    return a;
  }
  rootMembers(x:number){ return Array.from(this.members.get(this.find(x)) || []); }
}

/* splitCluster enforces max cluster size (<=4) using local pairwise edges */
function splitCluster(rowsSubset:any[], minInternal=0.5, opts:any){
  if(rowsSubset.length <= 4) return [rowsSubset];
  const localEdges:any[] = [];
  for(let i=0;i<rowsSubset.length;i++){
    for(let j=i+1;j<rowsSubset.length;j++){
      const { score } = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
      if(score >= minInternal) localEdges.push({ a:i, b:j, score });
    }
  }
  localEdges.sort((a,b)=>b.score-a.score);
  const uf = new UF(rowsSubset.length);
  for(const e of localEdges){
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if(ra===rb) continue;
    if(uf.size[ra] + uf.size[rb] <= 4) uf.merge(ra, rb);
  }
  const groups = new Map<number, number[]>();
  for(let i=0;i<rowsSubset.length;i++){ const r = uf.find(i); const arr = groups.get(r) || []; arr.push(i); groups.set(r,arr); }
  const result:any[] = [];
  for(const idxs of groups.values()){
    const subset = idxs.map(i=>rowsSubset[i]);
    if(subset.length <= 4) result.push(subset);
    else result.push(...splitCluster(subset, Math.max(minInternal,0.45), opts));
  }
  return result;
}

/* runClustering - main function used by worker */
async function runClustering(rows:any[], opts:any){
  rows.forEach((r,i)=> r._internalId = r._internalId || `r_${i}`);
  const minPair = opts?.minPair ?? 0.62;   // tuned default
  const minInternal = opts?.minInternal ?? 0.54;
  const blockChunkSize = opts?.blockChunkSize ?? 3000;

  const edges = buildEdges(rows, minPair, { ...opts, blockChunkSize });

  postMessage({ type:'progress', status:'edges-built', progress:60, completed: edges.length, total: Math.max(1, rows.length) });

  const uf = new UF(rows.length);
  const finalized = new Set<number>();
  const finalClustersIdx:number[][] = [];
  const edgesUsed:any[] = [];

  for(let ei=0; ei<edges.length; ei++){
    const e = edges[ei];
    if(finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if(ra===rb){ edgesUsed.push(e); continue; }
    const sizeA = uf.size[ra], sizeB = uf.size[rb];
    if(sizeA + sizeB <= 4){
      uf.merge(ra,rb); edgesUsed.push(e); continue;
    }

    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    if(combinedIdx.length > 500){
      for(let start=0; start<combinedIdx.length; start+=500){
        const chunkIdx = combinedIdx.slice(start, start+500);
        const chunkRows = chunkIdx.map(i=>rows[i]);
        const parts = splitCluster(chunkRows, minInternal, opts);
        for(const p of parts){
          const globalIdxs = p.map((r:any)=> chunkIdx.find(i=> rows[i]._internalId === r._internalId)).filter(i=> i!== undefined);
          if(globalIdxs.length) { finalClustersIdx.push(globalIdxs); globalIdxs.forEach(i=>finalized.add(i)); }
        }
      }
    } else {
      const combinedRows = combinedIdx.map(i=>rows[i]);
      const parts = splitCluster(combinedRows, minInternal, opts);
      for(const p of parts){
        const globalIdxs:number[] = [];
        for(const r of p){
          const idx = combinedIdx.find(i=> rows[i]._internalId === r._internalId);
          if(idx !== undefined){ globalIdxs.push(idx); finalized.add(idx); }
          else {
            const fallback = combinedIdx.find(i => normalizeArabic(rows[i].womanName) === normalizeArabic(r.womanName) || digitsOnly(rows[i].phone) === digitsOnly(r.phone));
            if(fallback !== undefined){ globalIdxs.push(fallback); finalized.add(fallback); }
          }
        }
        if(globalIdxs.length) finalClustersIdx.push(globalIdxs);
      }
    }
    edgesUsed.push(e);
    if(ei % 200 === 0) postMessage({ type:'progress', status:'merging-edges', progress: 60 + Math.round(20 * (ei/edges.length)), completed: ei+1, total: edges.length });
  }

  // leftovers
  const leftovers = new Map<number, number[]>();
  for(let i=0;i<rows.length;i++){
    if(finalized.has(i)) continue;
    const r = uf.find(i);
    const arr = leftovers.get(r) || []; arr.push(i); leftovers.set(r,arr);
  }
  for(const arr of leftovers.values()){
    if(arr.length <= 4) finalClustersIdx.push(arr);
    else {
      const subRows = arr.map(i=>rows[i]);
      const parts = splitCluster(subRows, minInternal, opts);
      for(const p of parts){
        const idxs = p.map((pr:any)=> arr.find(i=> rows[i]._internalId === pr._internalId)).filter(x=> x !== undefined);
        if(idxs.length) finalClustersIdx.push(idxs as number[]);
      }
    }
  }

  // map to clusters of rows
  const clusters = finalClustersIdx.map(g => g.map(i => rows[i])).filter(c => c.length > 1);
  return { clusters, edgesUsed };
}

/* -------------------------
   Worker message handling
   ------------------------- */
let inbound:any[] = [];
let mapping:any = null;
let options:any = null;

function mapIncomingRowsToInternal(rows:any[], mapping:any){
  return rows.map((r,i)=>{
    const mapped:any = { _internalId: `row_${i}`, womanName:"", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:[], cluster_id:"" };
    for(const k in mapping){
      const col = mapping[k];
      if(col && r[col]!==undefined){
        if(k==='children') mapped[k] = normalizeChildrenField(r[col]);
        else mapped[k] = r[col];
      }
    }
    return mapped;
  });
}

self.addEventListener('message', function(e:any){
  const msg = e.data as InMsg;
  if(!msg || !msg.type) return;
  if(msg.type === 'start'){
    mapping = msg.payload.mapping || {};
    options = msg.payload.options || {};
    inbound = [];
    postMessage({ type:'progress', status:'worker-ready', progress:1 });
  } else if(msg.type === 'data'){
    inbound.push(...(msg.payload.rows || []));
    postMessage({ type:'progress', status:'receiving', progress: Math.min(5, 1 + Math.floor(inbound.length/1000)) });
  } else if(msg.type === 'end'){
    setTimeout(async ()=>{
      try{
        postMessage({ type:'progress', status:'mapping-rows', progress:5 });
        const rows = mapIncomingRowsToInternal(inbound, mapping);
        postMessage({ type:'progress', status:'starting-clustering', progress:8, completed:0, total: rows.length });
        const res = await runClustering(rows, options);
        postMessage({ type:'progress', status:'annotating', progress:95 });
        postMessage({ type:'done', clusters: res.clusters, edgesUsed: res.edgesUsed });
      } catch(err:any){
        postMessage({ type:'error', error: String(err && err.message ? err.message : err) });
      }
    }, 50);
  }
});
export {}; // worker module
