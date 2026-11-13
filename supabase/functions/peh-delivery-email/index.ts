// PEH delivery notifications: Supabase Database Webhook -> Edge Function -> Resend.
// DEPLOY SERVER-SIDE ONLY. Never expose the keys below on a Cloudflare/static website.
// Disable Supabase JWT verification for this function; a custom secret header
// is checked here before ANY database access. Configure it under Edge Function Secrets.
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
Deno.serve(async(request:Request)=>{
  if(request.method!=="POST")return json(405,{error:"Method not allowed"});
  const secret=Deno.env.get("PEH_WEBHOOK_SECRET");
  if(!secret||request.headers.get("x-peh-webhook-secret")!==secret)return json(401,{error:"Unauthorized"});
  const supabaseUrl=Deno.env.get("SUPABASE_URL");
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey=Deno.env.get("RESEND_API_KEY");
  const emailFrom=Deno.env.get("PEH_EMAIL_FROM");
  if(!supabaseUrl||!serviceKey||!resendKey||!emailFrom)return json(503,{error:"Email service is not configured"});
  const client=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  let payload:unknown;
  try{payload=await request.json()}catch{return json(400,{error:"Invalid JSON"})}
  const event=payload as {type?:string;table?:string;schema?:string;record?:{id?:string}};
  const notificationId=event?.record?.id;
  if(event.type!=="INSERT"||event.table!=="peh_notifications"||event.schema!=="public"||!notificationId||!/^[0-9a-f-]{36}$/i.test(notificationId)){
    return json(400,{error:"Unexpected notification event"});
  }
  const {data:notification,error:lookupError}=await client.from("peh_notifications")
    .select("id,user_id,order_id,event_type,email_status")
    .eq("id",notificationId).single();
  if(lookupError||!notification||notification.event_type!=="delivered")return json(404,{error:"Notification not found"});
  if(notification.email_status==="sent"||notification.email_status==="sending")return json(200,{status:"already_processed"});
  const {data:claim,error:claimError}=await client.from("peh_notifications")
    .update({email_status:"sending",email_error:null})
    .eq("id",notification.id).in("email_status",["pending","failed"])
    .select("id").maybeSingle();
  if(claimError)return json(500,{error:"Unable to claim notification"});
  if(!claim)return json(200,{status:"already_processed"});
  try{
    // Verify order ownership and delivered status from the database, not the request.
    const {data:order,error:orderError}=await client.from("orders")
      .select("id,user_id,status").eq("id",notification.order_id).single();
    if(orderError||!order||order.user_id!==notification.user_id||order.status!=="delivered"){
      throw new Error("Order is not delivered or ownership changed");
    }
    // Use authenticated account email, NOT a user-supplied contact_email value.
    const {data:owner,error:ownerError}=await client.auth.admin.getUserById(notification.user_id);
    if(ownerError||!owner?.user?.email||!owner.user.email_confirmed_at)throw new Error("Recipient has no verified email");
    const url="https://palmer-ellites-hub.pages.dev/#dashboard";
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json","Idempotency-Key":notification.id},
      body:JSON.stringify({
        from:emailFrom,
        to:[owner.user.email],
        subject:"Your PEH task is ready for download",
        text:"Your completed documents are available in your Palmer Ellites Hub account. Sign in and open My Private Files: "+url+"\n\nThank you for choosing Palmer Ellites Hub."
      })
    });
    if(!response.ok)throw new Error("Email provider returned HTTP "+response.status);
    const {error:sentError}=await client.from("peh_notifications").update({
      email_status:"sent",email_sent_at:new Date().toISOString(),email_error:null
    }).eq("id",notification.id);
    if(sentError)return json(500,{error:"Email provider accepted the message but status update failed"});
    return json(200,{status:"accepted_by_email_provider"});
  }catch(error){
    await client.from("peh_notifications").update({
      email_status:"failed",email_error:String(error instanceof Error?error.message:error).slice(0,400)
    }).eq("id",notification.id);
    return json(500,{error:"Email notification failed; check Edge Function logs"});
  }
});
