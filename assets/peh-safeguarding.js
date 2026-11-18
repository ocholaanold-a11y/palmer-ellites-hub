/* PEH safeguarding and moderation queue. Admin-only server-side RLS.
   Keeps abuse reports private to reporter and authorized administrators. */
(()=>{
  const root=document.querySelector("#admin .container");
  if(!root)return;
  const el=(tag,cls,content)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(content!==undefined)e.textContent=content;
    return e;
  };
  const section=el("section","panel peh-safeguard-review");
  section.id="pehSafeguardReview";
  section.innerHTML='<h3>Safety reports & writer conduct</h3><p>Review reports about private contact requests, off-platform payments, threats, harassment and other misconduct. Reports are confidential to the reporter and PEH administrators. Suspend a writer immediately if needed, and escalate threats through appropriate safety channels.</p><button class="button secondary" type="button" id="pehLoadSafetyReports">Load safety reports</button><p class="form-status" id="pehSafetyReportStatus" role="status" aria-live="polite"></p><div id="pehSafetyReportList"></div>';
  const anchor=document.getElementById("pehWriterAccountSection");
  if(anchor)anchor.before(section);else root.append(section);
  const status=document.getElementById("pehSafetyReportStatus");
  const list=document.getElementById("pehSafetyReportList");
  const blockedHeading=el("h4","","Blocked message attempts");
  const blockedIntro=el("p","muted","Messages blocked by PEH safeguards are logged here without retaining the rejected message text.");
  const blockedButton=el("button","button secondary","Load blocked attempts");
  blockedButton.type="button";
  const blockedStatus=el("p","form-status");
  const blockedList=el("div","");
  section.append(blockedHeading,blockedIntro,blockedButton,blockedStatus,blockedList);
  const show=(message,error=false)=>{status.textContent=message;status.className="form-status "+(error?"feedback-error":"");};
  let loading=false;
  async function loadReports(){
    if(loading)return;
    loading=true;
    list.replaceChildren();
    show("Checking administrator permissions…");
    try{
      if(typeof supabase==="undefined"||!supabase)throw new Error("Sign in to PEH first.");
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth?.user)throw new Error("Sign in to your administrator account.");
      const {data:admin,error:memberError}=await supabase.from("peh_admins")
        .select("user_id").eq("user_id",auth.user.id).maybeSingle();
      if(memberError||!admin)throw new Error("Administrator authorization required.");
      const {data:reports,error}=await supabase.from("peh_message_reports")
        .select("id,order_id,message_id,reporter_id,reason,details,status,admin_note,created_at")
        .order("created_at",{ascending:false}).limit(100);
      if(error)throw error;
      if(!reports?.length){show("No safety reports submitted yet.");return;}
      const ids=[...new Set(reports.map(x=>x.message_id))];
      const {data:messages,error:messagesError}=await supabase.from("peh_order_messages")
        .select("id,order_id,sender_id,sender_role,body,created_at").in("id",ids);
      if(messagesError)throw messagesError;
      const byId=new Map((messages||[]).map(m=>[m.id,m]));
      for(const r of reports){
        const m=byId.get(r.message_id);
        const card=el("article","peh-safety-report");
        const heading=el("strong","",r.reason.replaceAll("_"," ")+" · "+r.status);
        const meta=el("p","muted","Order "+r.order_id.slice(0,8)+" · "+new Date(r.created_at).toLocaleString());
        card.append(heading,meta);
        card.append(el("p","","Reported message: "+(m?.body||"Message unavailable")));
        if(r.details)card.append(el("p","","Reporter details: "+r.details));
        const noteLabel=el("label","","Private administrator review note");
        const note=el("textarea");
        note.maxLength=2000;
        note.rows=2;
        note.value=r.admin_note||"";
        noteLabel.append(note);
        const state=el("select");
        for(const x of ["open","reviewing","resolved"]){
          const option=new Option(x,x);state.append(option);
        }
        state.value=r.status;
        const save=el("button","button secondary","Save report review");
        save.type="button";
        const feedback=el("p","form-status");
        save.addEventListener("click",async()=>{
          save.disabled=true;
          try{
            const {error:updateError}=await supabase.from("peh_message_reports").update({
              status:state.value,admin_note:note.value.trim(),reviewed_at:new Date().toISOString()
            }).eq("id",r.id);
            if(updateError)throw updateError;
            feedback.textContent="Report review saved.";
          }catch(error){feedback.textContent="Review not saved: "+(error?.message||String(error));}
          finally{save.disabled=false;}
        });
        card.append(noteLabel,state,save);
        if(m?.sender_role==="writer"){
          const suspend=el("button","button secondary","Suspend reported writer");
          suspend.type="button";
          suspend.addEventListener("click",async()=>{
            if(!window.confirm("Suspend the reported writer's PEH assignment access? This action blocks their assigned projects, files and messaging until reinstated."))return;
            suspend.disabled=true;
            try{
              const {data:account,error:lookError}=await supabase.from("peh_writer_accounts")
                .select("user_id,suspended").eq("user_id",m.sender_id).maybeSingle();
              if(lookError||!account)throw lookError||new Error("Writer account is no longer linked.");
              const {error:suspendError}=await supabase.from("peh_writer_accounts")
                .update({suspended:true}).eq("user_id",account.user_id);
              if(suspendError)throw suspendError;
              feedback.textContent="Writer account suspended. Review the report and arrange appropriate follow-up.";
              suspend.textContent="Writer suspended";
            }catch(error){feedback.textContent="Suspension failed: "+(error?.message||String(error));suspend.disabled=false;}
          });
          card.append(suspend);
        }
        card.append(feedback);
        list.append(card);
      }
      show(reports.length+" report(s) loaded. Treat threats and requests for private payment as serious safeguarding issues.");
    }catch(error){show("Unable to load reports: "+(error?.message||String(error)),true);}
    finally{loading=false;}
  }
  async function loadBlockedAttempts(){
    blockedButton.disabled=true;
    blockedList.replaceChildren();
    blockedStatus.textContent="Loading blocked attempts…";
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth?.user)throw new Error("Sign in to your administrator account.");
      const {data:admin,error:memberError}=await supabase.from("peh_admins")
        .select("user_id").eq("user_id",auth.user.id).maybeSingle();
      if(memberError||!admin)throw new Error("Administrator authorization required.");
      const {data:items,error}=await supabase.from("peh_blocked_message_attempts")
        .select("id,order_id,actor_id,actor_role,category,status,created_at,admin_note")
        .order("created_at",{ascending:false}).limit(100);
      if(error)throw error;
      if(!items?.length){blockedStatus.textContent="No blocked message attempts recorded yet.";return;}
      for(const item of items){
        const card=el("article","peh-safety-report");
        card.append(
          el("strong","",item.category.replaceAll("_"," ")+" · "+item.status),
          el("p","muted","Role: "+item.actor_role+" · Order: "+item.order_id.slice(0,8)+" · "+new Date(item.created_at).toLocaleString()),
          el("p","muted","Account ID: "+item.actor_id)
        );
        const noteLabel=el("label","","Private administrator review note");
        const note=el("textarea");note.maxLength=2000;note.rows=2;note.value=item.admin_note||"";noteLabel.append(note);
        const state=el("select");
        for(const value of ["open","reviewing","resolved"])state.append(new Option(value,value));
        state.value=item.status;
        const save=el("button","button secondary","Save incident review");save.type="button";
        const feedback=el("p","form-status");
        save.addEventListener("click",async()=>{
          save.disabled=true;
          try{
            const {error:updateError}=await supabase.from("peh_blocked_message_attempts")
              .update({status:state.value,admin_note:note.value.trim()}).eq("id",item.id);
            if(updateError)throw updateError;
            feedback.textContent="Incident review saved.";
          }catch(error){feedback.textContent="Could not save review: "+(error?.message||String(error));}
          finally{save.disabled=false;}
        });
        card.append(noteLabel,state,save,feedback);blockedList.append(card);
      }
      blockedStatus.textContent=items.length+" blocked attempt(s) loaded.";
    }catch(error){blockedStatus.textContent="Unable to load blocked attempts: "+(error?.message||String(error));}
    finally{blockedButton.disabled=false;}
  }
  blockedButton.addEventListener("click",loadBlockedAttempts);
  document.getElementById("pehLoadSafetyReports")?.addEventListener("click",loadReports);
})();