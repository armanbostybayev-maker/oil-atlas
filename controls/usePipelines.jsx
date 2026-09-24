import {useState,useEffect,useMemo,useCallback} from 'react';
import {PIPELINE_DEFAULTS,pipelineRecords,filterPipelines,pipelineSummary} from '../analytics/pipelines.mjs';
export default function usePipelines(enabled){
 const [datasets,setDatasets]=useState({oil:[],gas:[]}),[loading,setLoading]=useState(false),[error,setError]=useState(''),[attempt,retry]=useState(0),[local,setLocal]=useState(false);
 const [filters,setFilters]=useState({...PIPELINE_DEFAULTS}),[selected,setSelected]=useState(null),[compare,setCompare]=useState([]),[color,setColor]=useState('product');
 useEffect(()=>{
  if(!enabled||local)return;const abort=new AbortController();setLoading(true);setError('');
  Promise.all(['oil','gas'].map(async type=>{const r=await fetch(`/data/infrastructure/${type}-pipelines.geojson`,{signal:abort.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);return [type,pipelineRecords(await r.json(),type)];})).then(entries=>{if(!abort.signal.aborted)setDatasets(Object.fromEntries(entries));}).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return ()=>abort.abort();
 },[enabled,attempt,local]);
 const importFile=useCallback(async(file,type)=>{if(!file)return;setLoading(true);setError('');try{if(file.size>50*1024*1024)throw Error('Файл превышает 50 МБ');const rows=pipelineRecords(JSON.parse(await file.text()),type);setLocal(true);setDatasets(prev=>({...prev,[type]:rows}));setSelected(null);setCompare([]);}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
 const records=useMemo(()=>[...datasets.oil,...datasets.gas],[datasets]);
 const filtered=useMemo(()=>filterPipelines(records,filters),[records,filters]);
 useEffect(()=>{if(selected&&!filtered.some(p=>p.id===selected))setSelected(null);},[filtered,selected]);
 const summary=useMemo(()=>pipelineSummary(filtered),[filtered]);
 const select=useCallback(id=>setSelected(id),[]);
 return {records,filtered,summary,filters,setFilters,selected,select,compare,setCompare,color,setColor,loading,error,local,importFile,retry:()=>retry(x=>x+1)};
}
