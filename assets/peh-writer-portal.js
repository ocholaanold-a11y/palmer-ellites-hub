/* PEH writer workspace. Writer identity and file access are verified in Supabase.
   The public profile is not a login account until an admin links an auth UID. */
(()=>{
  const $=id=>document.getElementById(id);
  if(!$("dashboard")||!$("admin"))return;
  const panel=document.createElement("section");
  panel.id="pehWriterWorkspace";
  panel.className="section pale hidden";
  panel.innerHTML='<div class="container"><div class="section-title"><div><span class="eyebrow">SPECIALIST PORTAL</span><h2>My assigned projects.</h2><p>View assigned project instructions and supporting documents, then upload completed drafts for PEH administrator review.</p></div></div><div class="panel"><button class="button secondary" id="pehWriterRefresh" type="button">Refresh my projects</button><p id="pehWriterStatus" class="form-status" role="status" aria-live="polite"></p><div id="pehWriterProjects"></div></div></div>';
  $("dashboard").after(panel);
  const status=$("pehWriterStatus"),items=$("pehWriterProjects");
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const notice=(msg,bad=false)=>{status.textContent=msg;status.className="form-status "+(bad?"feedback-error":"");};
  const whitelist=new Set(["pdf","doc","docx","txt","xls","xlsx","csv","ppt","pptx","png","jpg","jpeg"]);
  const clean=name=>String(name).replace(/[^a-zA-Z0-9._-]/g,"_").slice(-75);
  const maxSize=50*1024*1024;
  async function fileUpload(file,path,onProgress){
    if(file.size<=6*1024*1024){
      const {error}=await supabase.storage.from("peh-order-files").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
      if(error)throw error;
      onProgress(100);return;
    }
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)throw new Error("Session expired. Sign in again.");
    const {Upload}=await import("https://esm.sh/tus-js-client@4.3.1");
    const hostname=new URL(window.PEH_CONFIG.supabaseUrl).hostname.replace(".supabase.co",".storage.supabase.co");
    await new Promise((resolve,reject)=>{
      const upload=new Upload(file,{
        endpoint:"https://"+hostname+"/storage/v1/upload/resumable",
        headers:{authorization:"Bearer "+session.access_token,apikey:window.PEH_CONFIG.supabaseAnonKey,"x-upsert":"false"},
        metadata:{bucketName:"peh-order-files",objectName:path,contentType:file.type||"application/octet-stream",cacheControl:"3600"},
        uploadDataDuringCreation:true,chunkSize:6*1024*1024,
        removeFingerprintOnSuccess:true,retryDelays:[0,3000,5000,10000,20000],
        onProgress:(done,total)=>onProgress(Math.round(done*100/total)),onError:reject,onSuccess:resolve
      });upload.start();
    });
  }
  async function listFiles(project,target){
    target.replaceChildren(make("p","form-status","Loading private project documents…"));
    const base=project.user_id+"/"+project.id;
    const {data,error}=await supabase.storage.from("peh-order-files").list(base,{limit:100});
    if(error){target.textContent="Unable to load files: "+error.message;return;}
    target.replaceChildren();
    const rows=(data||[]).filter(x=>x.id&&x.name);
    if(!rows.length){target.textContent="No documents uploaded yet.";return;}
    for(const file of rows){
      const row=make("div","peh-file-row");
      const label=make("span","",file.name);
      const btn=make("button","button secondary","Download");
      btn.type="button";
      const msg=make("span","form-status");
      btn.addEventListener("click",async()=>{
        btn.disabled=true;msg.textContent="";
        try{
          const {data:blob,error:downloadError}=await supabase.storage.from("peh-order-files").download(base+"/"+file.name);
          if(downloadError||!blob)throw downloadError||new Error("Empty response");
          const url=URL.createObjectURL(blob);
          const anchor=document.createElement("a");anchor.href=url;anchor.download=file.name;
          document.body.append(anchor);anchor.click();anchor.remove();
          setTimeout(()=>URL.revokeObjectURL(url),30000);
        }catch(err){msg.textContent="Download failed: "+(err?.message||String(err));}
        finally{btn.disabled=false;}
      });
      row.append(label,btn,msg);target.append(row);
    }
  }
  let busy=false;
  async function refreshWriter(){
    if(busy)return;
    busy=true;
    try{
      if(typeof supabase==="undefined"||!supabase){panel.classList.add("hidden");return;}
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user){panel.classList.add("hidden");return;}
      const {data:membership,error:membershipError}=await supabase.from("peh_writer_accounts")
        .select("writer_id").eq("user_id",user.id).maybeSingle();
      if(membershipError){panel.classList.add("hidden");return;}
      if(!membership){panel.classList.add("hidden");return;}
      panel.classList.remove("hidden");
      notice("Loading assigned projects…");
      const {data:projects,error:projectsError}=await supabase.rpc("peh_get_my_writer_projects");
      if(projectsError){notice("Unable to load projects: "+projectsError.message,true);return;}
      items.replaceChildren();
      if(!projects?.length){notice("No projects assigned to you yet.");return;}
      notice(projects.length+" assigned project(s). Deliverables stay private until reviewed by PEH.");
      for(const o of projects){
        const card=make("div","peh-revision-item");
        card.append(make("strong","",o.service+" · "+o.status.replaceAll("_"," ")));
        card.append(make("p","",o.description));
        card.append(make("p","muted","Deadline: "+new Date(o.deadline).toLocaleString()));
        const docs=make("div","peh-writer-docs");
        const load=make("button","button secondary","View supporting documents");
        load.type="button";load.addEventListener("click",()=>listFiles(o,docs));
        const label=make("label","","Upload your completed files for administrator review (up to 10, 50 MB each)");
        const input=make("input");input.type="file";input.multiple=true;
        input.accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg";label.append(input);
        const upload=make("button","button primary","Send files to PEH");
        upload.type="button";
        const progress=make("p","form-status");progress.setAttribute("role","status");
        upload.addEventListener("click",async()=>{
          const selected=Array.from(input.files||[]);
          if(!selected.length||selected.length>10){progress.textContent="Select between 1 and 10 files.";return;}
          if(selected.some(f=>!f.size||f.size>maxSize||!whitelist.has(f.name.split(".").pop().toLowerCase()))){progress.textContent="Choose supported nonempty files, at most 50 MB each.";return;}
          upload.disabled=true;input.disabled=true;
          let uploaded=0;const failures=[];
          try{
            for(const [i,file] of selected.entries()){
              const path=o.user_id+"/"+o.id+"/DELIVERED-"+crypto.randomUUID()+"-"+clean(file.name);
              try{
                await fileUpload(file,path,pct=>{progress.textContent="Uploading "+(i+1)+"/"+selected.length+": "+file.name+" ("+pct+"%)";});
                uploaded++;
              }catch(err){failures.push(file.name+": "+(err?.message||String(err)));}
            }
            progress.textContent=uploaded+" of "+selected.length+" files sent to PEH."+(failures.length?" Failed: "+failures.join("; ")+". Check uploaded files before trying again.":" An administrator must review and mark the order Delivered.");
            if(!failures.length)input.value="";
          }finally{upload.disabled=false;input.disabled=false;}
        });
        card.append(load,docs,label,upload,progress);items.append(card);
      }
    }catch(err){panel.classList.remove("hidden");notice("Writer workspace error: "+(err?.message||String(err)),true);}
    finally{busy=false;}
  }
  $("pehWriterRefresh").addEventListener("click",refreshWriter);
  // No writer UI unless the currently authenticated account is linked.
  let checks=0;const gate=setInterval(()=>{
    checks++;
    if(typeof supabase!=="undefined"&&supabase){
      clearInterval(gate);refreshWriter();
      supabase.auth.onAuthStateChange(()=>setTimeout(refreshWriter,150));
    }else if(checks>=20)clearInterval(gate);
  },700);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshWriter();});
  // Admin can link a verified Supabase Auth user to one existing writer profile.
  const adminControls=document.createElement("section");
  adminControls.className="panel peh-writer-linking";
  adminControls.innerHTML='<h3>Writer account access</h3><p>Create a professional profile first. Have each specialist register an adult PEH account and confirm their email. Copy their user UUID from Supabase Authentication → Users, then link it below. Only authorized administrators can link or remove accounts.</p><form id="pehLinkWriterForm"><label>Writer profile<select id="pehLinkWriterId" required><option value="">Select verified specialist</option></select></label><label>Supabase Auth user UUID<input id="pehWriterAuthId" type="text" required placeholder="00000000-0000-0000-0000-000000000000" pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"></label><button class="button primary" type="submit">Authorize writer account</button><p id="pehWriterLinkStatus" class="form-status" role="status" aria-live="polite"></p></form><button class="button secondary" id="pehWriterLinksRefresh" type="button">Refresh writer account links</button><div id="pehWriterLinks"></div>';
  $("writerAdminList")?.after(adminControls);
  const linkStatus=$("pehWriterLinkStatus"),select=$("pehLinkWriterId");
  function showLinkError(msg){linkStatus.textContent=msg;linkStatus.className="form-status feedback-error";}
  async function refreshLinks(){
    if(!supabase||!currentAdmin)return;
    const [{data:writers,error:writerError},{data:links,error:linkError}]=await Promise.all([
      supabase.from("peh_writers").select("id,display_name").order("display_name"),
      supabase.from("peh_writer_accounts").select("user_id,writer_id").order("created_at",{ascending:false})
    ]);
    if(writerError||linkError){showLinkError("Unable to load linked writers. Run the writer-portal migration in Supabase.");return;}
    select.replaceChildren(new Option("Select verified specialist",""));
    for(const w of writers||[])select.append(new Option(w.display_name,w.id));
    const list=$("pehWriterLinks");list.replaceChildren();
    if(!links?.length){list.textContent="No writer accounts linked yet.";return;}
    for(const l of links){
      const row=make("div","peh-file-row");
      const writer=(writers||[]).find(x=>x.id===l.writer_id);
      row.append(make("span","",(writer?.display_name||"Unknown profile")+" · "+l.user_id));
      const button=make("button","button secondary","Revoke access");
      button.type="button";
      button.addEventListener("click",async()=>{
        if(!window.confirm("Remove this writer's access to assigned orders?"))return;
        button.disabled=true;
        const {error}=await supabase.from("peh_writer_accounts").delete().eq("user_id",l.user_id);
        if(error){showLinkError("Could not revoke access: "+error.message);button.disabled=false;return;}
        await refreshLinks();
      });
      row.append(button);list.append(row);
    }
  }
  $("pehWriterLinksRefresh").addEventListener("click",refreshLinks);
  $("pehLinkWriterForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!supabase||!currentAdmin){showLinkError("Administrator access required.");return;}
    const writer_id=select.value,user_id=$("pehWriterAuthId").value.trim();
    if(!writer_id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)){showLinkError("Select a writer and enter a valid Supabase Auth UUID.");return;}
    const {error}=await supabase.from("peh_writer_accounts").insert({writer_id,user_id});
    if(error){showLinkError("Could not link writer: "+error.message);return;}
    linkStatus.className="form-status feedback-success";linkStatus.textContent="Writer account authorized. They can now sign in and view their assigned projects.";
    $("pehWriterAuthId").value="";await refreshLinks();
  });
  const refreshAdmin= document.getElementById("refreshAdmin");
  refreshAdmin?.addEventListener("click",refreshLinks);
  document.getElementById("signIn")?.addEventListener("click",()=>setTimeout(refreshLinks,1800));
})();