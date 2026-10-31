// Yearbook 3 synthetic student journey. Provisional lab only: Figma and held SOW have not been compared.
// No network, accounts, school records, real submissions, tracking or uploads.
export const VERSION=1,MAX_QUOTE=140,MAX_MEMORY=500;
export function freshState(){return {version:VERSION,student:{id:"sample-student",name:"Avery Lane",school:"Northstar School",classYear:"2027"},profile:{quote:"",memory:"",consent:false},status:"draft",submittedAt:null}}

export function updateProfile(state,changes){if(state.status!=="draft")throw Error("Reopen the draft before editing");const keys=Object.keys(changes??{});if(!keys.length||keys.some(k=>!["quote","memory","consent"].includes(k)))throw Error("Unknown profile field");const profile={...state.profile};for(const key of keys){const value=changes[key];if(key==="consent"){if(typeof value!=="boolean")throw Error("Consent must be explicit");profile.consent=value}else{if(typeof value!=="string")throw Error("Text must be a string");if(value.length>(key==="quote"?MAX_QUOTE:MAX_MEMORY))throw Error("Text exceeds demo limit");profile[key]=value}}return {...state,profile}}

export function previewEntry(state){return {studentName:state.student.name,school:state.student.school,classYear:state.student.classYear,quote:state.profile.quote.trim(),memory:state.profile.memory.trim(),consent:state.profile.consent,status:state.status}}

export function progress(state){const p=previewEntry(state);return {completed:Number(Boolean(p.quote))+Number(Boolean(p.memory))+Number(p.consent),total:3,ready:Boolean(p.quote&&p.memory&&p.consent)}}

export function submitEntry(state,now=new Date().toISOString()){if(state.status!=="draft")throw Error("Already submitted");if(!progress(state).ready)throw Error("Complete both fields and opt in before submitting");if(!Number.isFinite(Date.parse(now)))throw Error("Invalid submission time");return {...state,status:"submitted",submittedAt:new Date(now).toISOString()}}

export function reopenDraft(state){return {...state,status:"draft",submittedAt:null}}

export function normalizeState(raw){const base=freshState();if(!raw||raw.version!==VERSION||raw.student?.id!==base.student.id)return base;let result=base;try{const p=raw.profile??{};if(typeof p.quote==="string"&&p.quote.length<=MAX_QUOTE)result=updateProfile(result,{quote:p.quote});if(typeof p.memory==="string"&&p.memory.length<=MAX_MEMORY)result=updateProfile(result,{memory:p.memory});if(typeof p.consent==="boolean")result=updateProfile(result,{consent:p.consent});if(raw.status==="submitted"&&progress(result).ready&&typeof raw.submittedAt==="string"&&Number.isFinite(Date.parse(raw.submittedAt)))result=submitEntry(result,raw.submittedAt)}catch{return base}return result}
