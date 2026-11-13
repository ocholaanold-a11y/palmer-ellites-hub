/* PEH staff-only review of writer drafts.
   Customers cannot see drafts in the separate private peh-writer-drafts bucket.
   Only administrators may approve and copy these into customer-visible storage. */
(()=>{
  const admin=document.getElementById("admin");
  if(!admin)return;
  const DRAFT="peh-writer-drafts",FINAL="peh-order-files",MAX=50*1024*1024;
  const panel=document.createElement("section");
  panel.className="panel peh-draft-review";
  panel.innerHTML='<h3>Review writer draft submissions</h3><p>Drafts are private to authorized PEH staff. Review all files before approving them for customer delivery. Once approved, the customer can access the files and receives a website notification.</p><button type="button" class="button secondary" id="pehReviewDrafts">Load writer drafts</button><p class="form-status" id="pehDraftStatus" role="status" aria-live="polite"></p><div id="pehDraftOrders"></div>';
  document.getElementById("writerAdminList")?.after(panel);
  const status=document.getElementById("pehDraftStatus"),list=document.getElementById("pehDraftOrders");
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const message=(el,text,bad=false)=>{el.textContent=text;el.className="form-status "+(bad?"feedback-error":"");};
  async function uploadFinal(blob,path,progress){
    if(blob.size>MAX)throw new Error("File larger than 50 MB");
    if(blob.size<=6*1024*1024){
      const {error}=await supabase.storage.from(FINAL).upload(path,blob,{upsert:false,contentType:blob.type||"application/octet-stream"});
      if(error)throw error;
      progress(100);return;
    }
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)throw new Error("Session expired");
    const {Upload}=await import("https://esm.sh/tus-js-client@4.3.1");
    const host=new URL(window.PEH_CONFIG.supabaseUrl).hostname.replace(".supabase.co",".storage.supabase.co");
    await new Promise((resolve,reject)=>{
      const upload=new Upload(blob,{endpoint:"https://"+host+"/storage/v1/upload/resumable",
        headers:{authorization:"Bearer "+session.access_token,apikey:window.PEH_CONFIG.supabaseAnonKey,"x-upsert":"false"},
        metadata:{bucketName:FINAL,objectName:path,contentType:blob.type||"application/octet-stream",cacheControl:"3600"},
        uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
        retryDelays:[0,3000,5000,10000,20000],onProgress:(n,total)=>progress(Math.round(n*100/total)),onError:reject,onSuccess:resolve});
      upload.start();
    });
  }
  let busy=false;
  async function loadDrafts(){
    if(busy)return;
    busy=true;list.replaceChildren();
    try{
      if(typeof supabase==="undefined"||!supabase){message(status,"Sign in to the administrator account.",true);return;}
      const {data:auth}=await supabase.auth.getUser();
      if(!auth?.user){message(status,"Administrator login required.",true);return;}
      const {data:admin,error:adminErr}=await supabase.from("peh_admins").select("user_id").eq("user_id",auth.user.id).maybeSingle();
      if(adminErr||!admin){message(status,"Administrator authorization required.",true);return;}
      message(status,"Loading assigned orders and private drafts…");
      const {data:orders,error}=await supabase.from("orders")
        .select("id,user_id,service,status,created_at,assigned_writer_id")
        .not("assigned_writer_id","is",null).order("created_at",{ascending:false}).limit(40);
      if(error){message(status,error.message,true);return;}
      if(!orders?.length){message(status,"No assigned orders yet.");return;}
      let total=0;
      for(const order of orders){
        const folder=order.user_id+"/"+order.id;
        const {data:files,error:listError}=await supabase.storage.from(DRAFT).list(folder,{limit:100});
        if(listError){message(status,"Failed to list drafts: "+listError.message,true);return;}
        const drafts=(files||[]).filter(f=>f.id&&f.name.startsWith("DRAFT-"));
        if(!drafts.length)continue;
        total+=drafts.length;
        const card=make("div","peh-revision-item");
        card.append(make("strong","",order.service+" · "+order.id.slice(0,8)+" · "+order.status));
        const names=make("p","",drafts.length+" submitted draft(s): "+drafts.map(f=>f.name).join(", "));
        card.append(names);
        const controls=make("div","button-row");
        const approve=make("button","button primary","Approve all drafts & deliver");
        approve.type="button";
        const feedback=make("p","form-status");feedback.setAttribute("role","status");
        const inspect=make("div","peh-writer-docs");
        for(const f of drafts){
          const row=make("div","peh-file-row");
          const label=make("span","",f.name);
          const button=make("button","button secondary","Review / Download");
          button.type="button";
          button.addEventListener("click",async()=>{
            button.disabled=true;
            try{
              const {data:blob,error:err}=await supabase.storage.from(DRAFT).download(folder+"/"+f.name);
              if(err||!blob)throw err||new Error("Empty file");
              const url=URL.createObjectURL(blob);
              const a=document.createElement("a");a.href=url;a.download=f.name;
              document.body.append(a);a.click();a.remove();
              setTimeout(()=>URL.revokeObjectURL(url),30000);
            }catch(err){message(feedback,"Could not download draft: "+(err?.message||String(err)),true);}
            finally{button.disabled=false;}
          });
          row.append(label,button);inspect.append(row);
        }
        approve.addEventListener("click",async()=>{
          if(!window.confirm("Have you reviewed these drafts? Approving will make them visible to the client and mark this order Delivered."))return;
          approve.disabled=true;
          let approved=0;const failed=[];
          try{
            // Keep stable target file names; retrying skips files already approved.
            const {data:existing,error:existingError}=await supabase.storage.from(FINAL).list(folder,{limit:100});
            if(existingError)throw existingError;
            const uploadedNames=new Set((existing||[]).map(f=>f.name));
            for(const [i,f] of drafts.entries()){
              const outputName="DELIVERED-"+f.name.slice("DRAFT-".length);
              if(uploadedNames.has(outputName)){approved++;continue;}
              try{
                message(feedback,"Approving "+(i+1)+" of "+drafts.length+": "+f.name);
                const {data:blob,error:downloadError}=await supabase.storage.from(DRAFT).download(folder+"/"+f.name);
                if(downloadError||!blob)throw downloadError||new Error("Empty download");
                await uploadFinal(blob,folder+"/"+outputName,pct=>message(feedback,"Approving "+(i+1)+"/"+drafts.length+": "+pct+"%"));
                approved++;
              }catch(err){failed.push(f.name+": "+(err?.message||String(err)));}
            }
            if(failed.length){message(feedback,approved+" of "+drafts.length+" copied. Failed: "+failed.join("; ")+". Order status was not changed; verify before retrying.",true);return;}
            // Updates to delivered are guarded by existing admin-only RLS.
            const {error:statusError}=await supabase.from("orders").update({status:"delivered"}).eq("id",order.id);
            if(statusError){message(feedback,"All draft files approved, but status change failed: "+statusError.message,true);return;}
            message(feedback,"Approved "+approved+" files. Order marked Delivered; customer website notification created.");
          }catch(err){message(feedback,"Approval failed: "+(err?.message||String(err)),true);}
          finally{approve.disabled=false;}
        });
        controls.append(approve);card.append(inspect,controls,feedback);list.append(card);
      }
      message(status,total?total+" private writer draft(s) across assigned orders.":"No private drafts submitted yet.");
    }catch(err){message(status,"Could not load draft review: "+(err?.message||String(err)),true);}
    finally{busy=false;}
  }
  document.getElementById("pehReviewDrafts")?.addEventListener("click",loadDrafts);
})();