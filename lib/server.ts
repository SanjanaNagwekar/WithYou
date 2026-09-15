import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/app/auth';
export class AppError extends Error{constructor(message:string,public status=400){super(message)}}
export async function context(request:Request,write=false){
 const user=await getAuthenticatedUser();if(!user)throw new AppError('Please sign in to access your private library.',401);
 if(write){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Request origin is not allowed.',403)}
 if(!env.DB||!env.BUCKET)throw new AppError('Your library is temporarily unavailable. Please try again.',503);
 return {owner:user.userId,db:env.DB,bucket:env.BUCKET};
}
export function failure(e:unknown){if(e instanceof AppError)return Response.json({error:e.message},{status:e.status});console.error('WithYou request failed',e instanceof Error?e.message:'Unknown error');return Response.json({error:'We could not complete that request. Your words are still here; please try again.'},{status:503})}
export function providerConfig(){return {key:env.CARTESIA_API_KEY,model:env.CARTESIA_MODEL_ID||'sonic-3.6'}}
export async function cartesia(path:string,init:RequestInit){const {key}=providerConfig();if(!key)throw new AppError('Voice generation is not available yet. Your original recording is safely saved.',503);const response=await fetch('https://api.cartesia.ai'+path,{...init,headers:{...init.headers,Authorization:'Bearer '+key,'Cartesia-Version':'2026-08-14'},signal:AbortSignal.timeout(90000)});if(!response.ok){
 const detail=await response.json().catch(()=>null) as {error_code?:string;request_id?:string}|null;
 const code=typeof detail?.error_code==='string'&&/^[a-z_]{1,80}$/.test(detail.error_code)?detail.error_code:'unknown';
 console.error('Voice service rejected request',{stage:path==='/voices/clone'?'cloning':'generation',status:response.status,code});
 if(code==='plan_upgrade_required')throw new AppError('Voice cloning is not enabled on the current service plan. The app owner needs to upgrade the voice service plan. Your recording is saved.',503);
 if(response.status===401||response.status===403)throw new AppError('The voice service is not authorized for this request. Please contact the app owner.',503);
 if(response.status===429)throw new AppError('The voice service has reached its usage limit. Please try again later.',429);
 throw new AppError('The voice service could not '+(path==='/voices/clone'?'create a voice from this recording':'generate this audio')+'. Please try again or contact the app owner.',502);
 }return response}
