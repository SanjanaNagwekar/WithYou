import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/app/auth';
import {AppError} from '@/lib/errors';
export {AppError} from '@/lib/errors';
export async function context(request:Request,write=false){
 const user=await getAuthenticatedUser();if(!user)throw new AppError('Please sign in to access your private library.',401);
 if(write){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Request origin is not allowed.',403)}
 if(!env.DB||!env.BUCKET)throw new AppError('Your library is temporarily unavailable. Please try again.',503);
 return {owner:user.userId,db:env.DB,bucket:env.BUCKET};
}
export function failure(e:unknown){if(e instanceof AppError)return Response.json({error:e.message},{status:e.status});console.error('WithYou request failed',e instanceof Error?e.message:'Unknown error');return Response.json({error:'We could not complete that request. Your words are still here; please try again.'},{status:503})}
