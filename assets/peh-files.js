/* PEH private order attachment module.
 * Deploy only after private bucket storage policies are applied.
 * No card details are handled. This browser code does NOT replace storage RLS.
 */
(()=>{
 const form=document.getElementById("requestForm");
 if(!form)return;
 const BUCKET="peh-order-files";
 const allowed=new Set(["pdf","doc","docx","txt","xls","xlsx","csv","ppt","pptx","png","jpg","jpeg"]);
 const maxBytes=50*1024*1024;
 const MAX_FILES=10;
 const $=id=>document.getElementById(id);
 const safe=s=>String(s||"").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-75)||"attachment";
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 // TUS handles 6–50 MB uploads reliably and reports progress.
 async function uploadAttachment(file,path,onProgress){
   if(file.size<=6*1024*1024){
     const {error}=await supabase.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
     if(error)throw error;
     onProgress(100);return;
   }
   const {data:{session},error:sessionError}=await supabase.auth.getSession();
   if(sessionError||!session?.access_token)throw new Error("Session expired. Please sign in again.");
   const {Upload}=await import("https://esm.sh/tus-js-client@4.3.1");
   const host=new URL(window.PEH_CONFIG.supabaseUrl).hostname;
   const storageHost=host.replace(".supabase.co",".storage.supabase.co");
   await new Promise((resolve,reject)=>{
     const uploader=new Upload(file,{
       endpoint:"https://"+storageHost+"/storage/v1/upload/resumable",
       retryDelays:[0,3000,5000,10000,20000],
       uploadDataDuringCreation:true,
       removeFingerprintOnSuccess:true,
       chunkSize:6*1024*1024,
       headers:{authorization:"Bearer "+session.access_token,apikey:window.PEH_CONFIG.supabaseAnonKey,"x-upsert":"false"},
       metadata:{bucketName:BUCKET,objectName:path,contentType:file.type||"application/octet-stream",cacheControl:"3600"},
       onError:reject,
       onProgress:(uploaded,total)=>onProgress(Math.min(100,Math.round(uploaded/total*100))),
       onSuccess:resolve
     });
     uploader.start();
   });
 }
 let busy=false;
 function alertError(message){
   displaySubmissionFeedback(false,"Your request could not be completed",message,"");
   showNotice("requestStatus",message,"error");
 }
 // Capture-phase handler supersedes the older text-only form handler.
 form.addEventListener("submit",async e=>{
   e.preventDefault();
   e.stopImmediatePropagation();
   if(busy)return;
   const files=Array.from($("attachment").files);
   if(files.length>MAX_FILES)return alertError("Choose up to "+MAX_FILES+" files per request.");
   if(files.some(file=>file.size>maxBytes))return alertError("Each file must be no larger than 50 MB.");
   if(files.some(file=>!file.size||!allowed.has(file.name.split(".").pop().toLowerCase())))return alertError("Select only nonempty PDF, Word, Excel, PowerPoint, CSV, text, PNG or JPG files.");
   if(!supabase)return alertError("The order service is unavailable. Nothing has been saved.");
   const deadline=new Date($("deadline").value);
   if(!Number.isFinite(deadline.valueOf())||deadline<=new Date())return alertError("Select a valid future deadline.");
   busy=true;
   const submit=form.querySelector('button[type="submit"]');
   submit.disabled=true;submit.textContent="Saving request…";
   $("submissionFeedback").classList.add("hidden");
   let createdOrder=null;
   try{
     const {data:auth,error:authErr}=await supabase.auth.getUser();
     const user=auth?.user;
     if(authErr||!user)return alertError("Please sign into your student account before submitting.");
     const payload={user_id:user.id,service:$("serviceInput").value,description:$("description").value,deadline:deadline.toISOString(),contact_email:$("requestEmail").value,preferred_writer:$("writerInput").value||null,requested_currency:$("currencyInput").value,status:"submitted"};
     const {data,error}=await supabase.from("orders").insert(payload).select("id").single();
     if(error||!data?.id)return alertError("Order could not be saved: "+(error?.message||"no confirmation from database"));
     createdOrder=data.id;
     let note="Your request was saved successfully.";
     let uploaded=0;
     const failed=[];
     for(const [index,file] of files.entries()){
       const path=user.id+"/"+data.id+"/"+crypto.randomUUID()+"-"+safe(file.name);
       try{
         await uploadAttachment(file,path,percent=>{
           submit.textContent="Uploading "+(index+1)+"/"+files.length+": "+percent+"%";
           showNotice("requestStatus","Uploading "+(index+1)+" of "+files.length+": "+file.name+" ("+percent+"%)","");
         });
         uploaded++;
       }catch(uploadErr){
         failed.push(file.name+" ("+(uploadErr?.message||String(uploadErr))+")");
       }
     }
     if(files.length){
       note+=" "+uploaded+" of "+files.length+" attachments uploaded.";
       if(failed.length)note+=" Failed: "+failed.join("; ")+". The order and successful uploads are saved. Do NOT resubmit the entire order; contact PEH with the request reference and the failed filenames.";
     }
     displaySubmissionFeedback(true,failed.length?"Your order was saved, but some files failed.":"Congratulations! Your task has been received.",note+" Our team will review your requirements and prepare your quotation. You can follow your order under My Account.",createdOrder);
     showNotice("requestStatus",failed.length?"Order saved with "+failed.length+" failed file(s). Check the confirmation above.":"Order saved. "+(files.length?uploaded+" attachments uploaded.":""),failed.length?"error":"success");
     form.reset();$("selectedCurrency").textContent=$("currencyInput").value;
     await loadOrders();if(currentAdmin)loadAdmin();
   }catch(err){
     if(createdOrder) displaySubmissionFeedback(true,"Your request has been saved.","Your order was created, but the upload or connection could not be confirmed. Please do not resubmit. Contact support with the reference below.",createdOrder);
     else alertError("Connection error. Check My Orders before trying again.");
   }finally{busy=false;submit.disabled=false;submit.textContent="Submit quote request →";}
 },true);
 const registered=new Set();
 const studentPanel=document.createElement("section");
 studentPanel.className="panel peh-private-files";
 studentPanel.innerHTML='<h3>My Private Files</h3><p>View and download files attached to your requests. Files are private to you and PEH administrators.</p><button type="button" class="button secondary peh-refresh-files">Refresh my files</button><div class="peh-file-results" aria-live="polite"></div>';
 document.querySelector("#dashboard .dashboard-grid")?.after(studentPanel);
 const adminPanel=document.createElement("section");
 adminPanel.className="panel peh-private-files";
 adminPanel.innerHTML='<h3>Private Customer Documents</h3><p>For authorized PEH administrators only.</p><button type="button" class="button secondary peh-refresh-files">Refresh order files</button><div class="peh-file-results" aria-live="polite"></div>';
 $("adminOrders")?.after(adminPanel);
 async function getFilesForOrder(o,where){
   const path=o.user_id+"/"+o.id;
   const {data,error}=await supabase.storage.from(BUCKET).list(path,{limit:100});
   if(error){const p=document.createElement("p");p.textContent="Files unavailable: "+error.message;where.append(p);return;}
   for(const item of (data||[]).filter(x=>x.id&&x.name)){
     const row=document.createElement("div");row.className="peh-file-row";
     const title=document.createElement("span");title.textContent=item.name;
     const btn=document.createElement("button");btn.type="button";btn.className="button secondary";btn.textContent="Download";
     btn.addEventListener("click",async()=>{
       btn.disabled=true;
       try{
         const {data:blob,error:err}=await supabase.storage.from(BUCKET).download(path+"/"+item.name);
         if(err||!blob){btn.textContent="Download failed";return;}
         const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=item.name;
         document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
       }finally{btn.disabled=false;}
     });
     row.append(title,btn);where.append(row);
   }
 }
 async function refreshFiles(admin,panel){
   const output=panel.querySelector(".peh-file-results");
   output.replaceChildren();output.textContent="Loading your private files…";
   if(!supabase){output.textContent="Order service unavailable.";return;}
   const {data:auth}=await supabase.auth.getUser();
   if(!auth?.user){output.textContent="Sign in first.";return;}
   if(admin&&!currentAdmin){output.textContent="Administrator access required.";return;}
   const query=supabase.from("orders").select("id,user_id,service,created_at").order("created_at",{ascending:false}).limit(30);
   const {data,error}=await (admin?query:query.eq("user_id",auth.user.id));
   output.replaceChildren();
   if(error){output.textContent="Unable to load your orders: "+error.message;return;}
   if(!data?.length){output.textContent="No orders found.";return;}
   for(const o of data){
     const group=document.createElement("div");group.className="peh-file-group";
     const title=document.createElement("strong");title.textContent=o.service+" · "+o.id.slice(0,8);
     group.append(title);output.append(group);
     await getFilesForOrder(o,group);
   }
 }
 // Clear previously rendered student documents on every account transition.
 // Otherwise a second person using the same browser could see old filenames
 // even though Supabase RLS would reject downloads.
 let fileViewerUser=null;
 let fileViewVersion=0;
 function clearPrivateFiles(){
   fileViewVersion++;
   for(const p of [studentPanel,adminPanel]){
     p.querySelector(".peh-file-results")?.replaceChildren();
   }
   studentPanel.querySelector(".peh-file-results").textContent="Click Refresh my files to load documents for the signed-in account.";
   adminPanel.querySelector(".peh-file-results").textContent="Refresh files after administrator authentication.";
 }
 async function refreshFilesForAccount(admin,panel){
   const version=++fileViewVersion;
   const {data:auth}=await supabase.auth.getUser();
   if(!auth?.user){clearPrivateFiles();return;}
   if(fileViewerUser!==auth.user.id){fileViewerUser=auth.user.id;clearPrivateFiles();}
   // The existing loader validates ownership via user_id; guard account switch
   // by clearing all document rows as soon as authentication changes.
   await refreshFiles(admin,panel);
   if(version!==fileViewVersion && fileViewerUser!==auth.user.id)clearPrivateFiles();
 }
 let fileChecks=0;
 const fileAuthReady=setInterval(()=>{
   fileChecks++;
   if(typeof supabase!=="undefined"&&supabase){
     clearInterval(fileAuthReady);
     supabase.auth.onAuthStateChange((_event,session)=>{
       const next=session?.user?.id||null;
       if(fileViewerUser!==next){fileViewerUser=next;clearPrivateFiles();}
     });
   }else if(fileChecks>20)clearInterval(fileAuthReady);
 },500);
 studentPanel.querySelector(".peh-refresh-files").addEventListener("click",()=>refreshFilesForAccount(false,studentPanel));
 adminPanel.querySelector(".peh-refresh-files").addEventListener("click",()=>refreshFilesForAccount(true,adminPanel));
})();