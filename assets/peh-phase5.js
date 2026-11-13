/* PEH Phase 5: order deliverables and revision requests.
   Row Level Security in Supabase is the source of truth, not UI checks.
   Activate with supabase-revisions-migration.sql; admin deliverables use
   existing private order file storage and its existing policies. */
(()=>{
  const $=id=>document.getElementById(id);
  if(!$("dashboard")||!$("admin"))return;
  const BUCKET="peh-order-files";
  const MAX_BYTES=50*1024*1024;
  const ALLOWED=new Set(["pdf","doc","docx","txt","xls","xlsx","csv","ppt","pptx","png","jpg","jpeg"]);
  const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const safeName=name=>String(name||"delivery").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-70);
  const textNotice=(el,msg,error=false)=>{el.textContent=msg;el.className="form-status "+(error?"feedback-error":"feedback-success");};
  function validatedFile(file){
    if(!file||!file.size)throw new Error("Choose a non-empty document.");
    if(file.size>MAX_BYTES)throw new Error("Maximum file size is 50 MB.");
    if(!ALLOWED.has(file.name.split(".").pop().toLowerCase()))throw new Error("Unsupported file type. Use PDF, Office files, CSV, TXT, JPG or PNG.");
  }
  async function uploadDelivery(file,path,progress){
    if(file.size<=6*1024*1024){
      const {error}=await supabase.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
      if(error)throw error;
      progress(100);return;
    }
    const {data:{session},error}=await supabase.auth.getSession();
    if(error||!session?.access_token)throw new Error("Please sign in again.");
    const {Upload}=await import("https://esm.sh/tus-js-client@4.3.1");
    const projectHost=new URL(window.PEH_CONFIG.supabaseUrl).hostname;
    const storageHost=projectHost.replace(".supabase.co",".storage.supabase.co");
    await new Promise((resolve,reject)=>{
      const upload=new Upload(file,{
        endpoint:"https://"+storageHost+"/storage/v1/upload/resumable",
        headers:{authorization:"Bearer "+session.access_token,apikey:window.PEH_CONFIG.supabaseAnonKey,"x-upsert":"false"},
        metadata:{bucketName:BUCKET,objectName:path,contentType:file.type||"application/octet-stream",cacheControl:"3600"},
        retryDelays:[0,3000,5000,10000,20000],
        chunkSize:6*1024*1024,
        removeFingerprintOnSuccess:true,
        onProgress:(done,total)=>progress(Math.round(100*done/total)),
        onError:reject,
        onSuccess:resolve
      });
      upload.start();
    });
  }

  // Customer area: order-specific revision requests and status updates.
  const customerPanel=make("section","panel peh-revision-panel");
  customerPanel.innerHTML='<h3>Revisions & Feedback</h3><p>Request an improvement to a project that is in review or has been delivered. Your request is linked to the original order.</p><button type="button" class="button secondary" id="pehLoadRevisions">Load my orders & revisions</button><div id="pehRevisionCustomerList" aria-live="polite"></div>';
  document.querySelector("#dashboard .peh-private-files")?.after(customerPanel);
  if(!customerPanel.parentElement)document.querySelector("#dashboard .dashboard-grid")?.after(customerPanel);
  const customerList=$("pehRevisionCustomerList");
  async function showCustomerRevisions(){
    customerList.replaceChildren(make("p","muted","Loading orders…"));
    if(!supabase){customerList.textContent="Sign in and reload this section.";return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){customerList.textContent="Please sign in first.";return;}
    const {data:orders,error}=await supabase.from("orders").select("id,service,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40);
    if(error){customerList.textContent="Could not load orders: "+error.message;return;}
    customerList.replaceChildren();
    if(!orders?.length){customerList.textContent="No orders found.";return;}
    const {data:revisions,error:revisionError}=await supabase.from("peh_revisions").select("id,order_id,instructions,status,admin_note,created_at").in("order_id",orders.map(o=>o.id)).order("created_at",{ascending:false});
    if(revisionError){customerList.textContent="Revisions are not yet enabled. Run the PEH Phase 5 Supabase migration before using this section.";return;}
    for(const o of orders){
      const wrap=make("div","peh-revision-item");
      wrap.append(make("strong","",o.service+" · "+o.status.replaceAll("_"," ")));
      for(const rev of (revisions||[]).filter(r=>r.order_id===o.id)){
        const detail=make("p","peh-revision-entry",rev.status.replaceAll("_"," ")+": "+rev.instructions+(rev.admin_note?" | PEH response: "+rev.admin_note:""));
        wrap.append(detail);
      }
      if(["review","delivered"].includes(o.status)){
        const label=make("label","", "Describe the revision requested");
        const input=make("textarea");input.maxLength=3000;input.minLength=10;input.placeholder="Explain what needs to be improved (10–3000 characters)";
        const button=make("button","button secondary","Request revision");button.type="button";
        const feedback=make("p","form-status");
        button.addEventListener("click",async()=>{
          const instructions=input.value.trim();
          if(instructions.length<10||instructions.length>3000){textNotice(feedback,"Please enter 10–3000 characters.",true);return;}
          button.disabled=true;
          const {error:err}=await supabase.from("peh_revisions").insert({order_id:o.id,requested_by:user.id,instructions,status:"requested"});
          button.disabled=false;
          if(err)textNotice(feedback,"Revision request was not saved: "+err.message,true);
          else {textNotice(feedback,"Revision request received. PEH will review your feedback.");input.value="";await showCustomerRevisions();}
        });
        label.append(input);wrap.append(label,button,feedback);
      }
      customerList.append(wrap);
    }
  }
  $("pehLoadRevisions").addEventListener("click",showCustomerRevisions);

  // Administrator area: only assigned PEH admins can see or modify these records.
  const adminPanel=make("section","panel peh-delivery-panel hidden");
  adminPanel.innerHTML='<h3>Order Deliveries & Revision Management</h3><p>Upload a completed document to an existing order, or review a customer revision request. Files remain private.</p><button type="button" class="button secondary" id="pehLoadAdminDelivery">Refresh deliveries & revisions</button><p id="pehDeliveryStatus" class="form-status" role="status" aria-live="polite"></p><div id="pehAdminDeliveryList"></div><div id="pehAdminRevisions"></div>';
  $("adminOrders")?.after(adminPanel);
  const adminOrders=$("pehAdminDeliveryList"),adminRevisions=$("pehAdminRevisions"),adminStatus=$("pehDeliveryStatus");
  let loadingAdminDelivery=false;
  async function loadAdminDeliveries(){
    // Immediately display the panel and scroll to it. Previously it only appeared
    // after asynchronous authorization, and was inserted above the open button.
    adminPanel.classList.remove("hidden");
    adminPanel.scrollIntoView({behavior:"smooth",block:"start"});
    adminPanel.setAttribute("tabindex","-1");
    adminPanel.focus({preventScroll:true});
    if(loadingAdminDelivery)return;
    loadingAdminDelivery=true;
    adminOrders.replaceChildren();
    adminRevisions.replaceChildren();
    textNotice(adminStatus,"Opening delivery management…");
    try{
      if(!supabase){textNotice(adminStatus,"The secure account service is not connected. Reload the page and sign in again.",true);return;}
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth?.user){textNotice(adminStatus,"Please sign in to your PEH administrator account.",true);return;}
      const {data:membership,error:memberError}=await supabase.from("peh_admins").select("user_id").eq("user_id",auth.user.id).maybeSingle();
      if(memberError){textNotice(adminStatus,"Unable to verify administrator access: "+memberError.message,true);return;}
      if(!membership){textNotice(adminStatus,"This account is not authorized as a PEH administrator.",true);return;}
      textNotice(adminStatus,"Administrator verified. Loading orders and revisions…");
      const {data:orders,error}=await supabase.from("orders").select("id,user_id,service,status,created_at").order("created_at",{ascending:false}).limit(50);
    if(error){textNotice(adminStatus,error.message,true);return;}
    adminOrders.replaceChildren();
    if(!orders?.length)adminOrders.textContent="No customer orders yet.";
    for(const o of (orders||[])){
      const wrap=make("div","peh-revision-item");
      wrap.append(make("strong","",o.service+" · "+o.id.slice(0,8)+" · "+o.status));
      const label=make("label","", "Upload final or revised document (50 MB max)");
      const input=make("input");input.type="file";input.accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg";
      label.append(input);
      const btn=make("button","button primary","Upload deliverable");
      btn.type="button";
      const feedback=make("p","form-status");
      btn.addEventListener("click",async()=>{
        let file=input.files?.[0];
        try{validatedFile(file);}catch(ex){textNotice(feedback,ex.message,true);return;}
        btn.disabled=true;
        const path=o.user_id+"/"+o.id+"/DELIVERED-"+crypto.randomUUID()+"-"+safeName(file.name);
        try{
          await uploadDelivery(file,path,pct=>{btn.textContent="Uploading: "+pct+"%";});
          // Do not ever mark payment status as paid from this browser.
          const {error:statusError}=await supabase.from("orders").update({status:"delivered"}).eq("id",o.id);
          if(statusError)textNotice(feedback,"File uploaded, but order status could not be updated: "+statusError.message,true);
          else textNotice(feedback,"Document uploaded securely and order marked delivered.");
          input.value="";
        }catch(ex){textNotice(feedback,"Upload failed: "+(ex?.message||String(ex)),true);}
        finally{btn.disabled=false;btn.textContent="Upload deliverable";}
      });
      wrap.append(label,btn,feedback);adminOrders.append(wrap);
    }
    const {data:revisions,error:rError}=await supabase.from("peh_revisions").select("id,order_id,instructions,status,admin_note,created_at").order("created_at",{ascending:false}).limit(70);
    adminRevisions.replaceChildren();
    adminRevisions.append(make("h3","","Customer revision requests"));
    if(rError){adminRevisions.append(make("p","feedback-error","Revision database not enabled. Apply Phase 5 SQL migration."));return;}
    if(!revisions?.length){adminRevisions.append(make("p","muted","No revision requests yet."));return;}
    for(const rev of revisions){
      const wrap=make("div","peh-revision-item");
      wrap.append(make("strong","",rev.order_id.slice(0,8)+" · "+rev.status.replaceAll("_"," ")));
      wrap.append(make("p","",rev.instructions));
      const select=make("select");
      for(const st of ["requested","in_review","accepted","completed","declined"]){const opt=make("option","",st.replaceAll("_"," "));opt.value=st;opt.selected=st===rev.status;select.append(opt);}
      const note=make("textarea");note.maxLength=2000;note.placeholder="Message to client (optional)";note.value=rev.admin_note||"";
      const btn=make("button","button secondary","Save revision status");btn.type="button";
      const feedback=make("p","form-status");
      btn.addEventListener("click",async()=>{
        btn.disabled=true;
        const {error:err}=await supabase.from("peh_revisions").update({status:select.value,admin_note:note.value.trim()||null}).eq("id",rev.id);
        btn.disabled=false;
        if(err)textNotice(feedback,"Could not save: "+err.message,true);
        else textNotice(feedback,"Revision status saved.");
      });
      wrap.append(select,note,btn,feedback);adminRevisions.append(wrap);
    }
    textNotice(adminStatus,"Orders and revision requests loaded.");
    }catch(err){
      textNotice(adminStatus,"Delivery management could not load: "+(err?.message||String(err)),true);
    }finally{
      loadingAdminDelivery=false;
    }
  }
  $("pehLoadAdminDelivery").addEventListener("click",loadAdminDeliveries);
  // Reveal only for a verified administrator upon explicit refresh action.
  // The admin section is already controlled by existing auth logic; the
  // backend policies independently verify access.
  let action=make("button","button secondary","Open delivery management");
  action.type="button";
  action.id="pehOpenDelivery";
  action.setAttribute("aria-controls","pehAdminDeliveryPanel");
  adminPanel.id="pehAdminDeliveryPanel";
  action.addEventListener("click",loadAdminDeliveries);
  const adminWorkspace=$("admin")?.querySelector(".admin-panel");
  // Put the action before its destination panel, not after it.
  if(adminWorkspace)adminWorkspace.insertBefore(action,$("adminOrders"));
  else $("admin")?.append(action);
})();