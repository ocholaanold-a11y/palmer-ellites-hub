/* PEH Phase 9: private, order-specific client / admin / writer messaging.
   Server-side RLS and triggers in supabase-messaging-migration.sql enforce roles.
   Never use the client-visible role, order title, or ID as authorization. */
(()=>{
  const $=id=>document.getElementById(id);
  if(!$("dashboard")||!$("admin"))return;
  const make=(tag,className,text)=>{
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(text!==undefined)e.textContent=text;
    return e;
  };
  const views=[
    {kind:"client",root:document.querySelector("#dashboard .container"),title:"Messages about my orders",
     intro:"Ask PEH questions about your own requests. Administrators and the assigned writer may respond."},
    {kind:"admin",root:document.querySelector("#admin .container"),title:"Order conversations",
     intro:"Respond to customers and assigned specialists within each private order."},
    {kind:"writer",root:$("pehWriterWorkspace")?.querySelector(".container"),title:"Assigned project messages",
     intro:"Ask for clarification and follow the conversation on projects assigned to you."}
  ];
  for(const view of views){
    if(!view.root)continue;
    const section=make("section","panel peh-message-panel");
    section.id="pehMessages-"+view.kind;
    const heading=make("h3","",view.title);
    const intro=make("p","",view.intro);
    const safety=make("p","peh-message-safety","Safety: Never share personal contact details, identity documents, passwords or payment information. Writers must not request private payments or threaten clients. Report inappropriate messages to PEH administrators.");
    const controls=make("div","peh-message-controls");
    const orderLabel=make("label","","Choose an order");
    const select=make("select");
    select.setAttribute("aria-label","Choose an order");
    select.append(new Option("Select an order",""));
    orderLabel.append(select);
    const refreshOrders=make("button","button secondary","Load my conversations");
    refreshOrders.type="button";
    const refreshMessages=make("button","button secondary","Refresh messages");
    refreshMessages.type="button";
    const status=make("p","form-status","Sign in to see your private order conversations.");
    status.setAttribute("role","status");
    status.setAttribute("aria-live","polite");
    const thread=make("div","peh-message-thread");
    thread.setAttribute("aria-live","polite");
    const form=make("form","peh-message-compose");
    const bodyLabel=make("label","","Message (maximum 3,000 characters)");
    const body=make("textarea");
    body.rows=3;
    body.maxLength=3000;
    body.required=true;
    body.placeholder="Write a question or reply about this order…";
    bodyLabel.append(body);
    const send=make("button","button primary","Send message");
    send.type="submit";
    form.append(bodyLabel,send);
    controls.append(orderLabel,refreshOrders,refreshMessages);
    section.append(heading,intro,safety,controls,status,thread,form);
    if(view.kind==="client")view.root.append(section);
    else if(view.kind==="writer")view.root.append(section);
    else {
      // Admin messages are grouped inside the protected Administrator Workspace.
      const anchor=$("pehWriterAccountSection");
      if(anchor)anchor.before(section);else view.root.append(section);
    }
    Object.assign(view,{section,select,status,thread,form,body,send,refreshOrders,refreshMessages,
      orders:[],ownerId:null,loading:false,threadSeq:0,orderSeq:0,opened:false});
    view.setStatus=(msg,bad=false)=>{
      status.textContent=msg;
      status.className="form-status "+(bad?"feedback-error":"");
    };
    function clearAccount(){
      view.orderSeq++;
      view.threadSeq++;
      view.ownerId=null;
      view.orders=[];
      view.opened=false;
      select.replaceChildren(new Option("Select an order",""));
      thread.replaceChildren();
      body.value="";
      view.setStatus("Sign in to see your private order conversations.");
    }
    view.clear=clearAccount;
    view.loadOrders=async()=>{
      if(view.loading)return;
      view.loading=true;
      const seq=++view.orderSeq;
      view.setStatus("Loading authorized orders…");
      refreshOrders.disabled=true;
      try{
        if(typeof supabase==="undefined"||!supabase)throw new Error("Secure messaging is temporarily unavailable.");
        const {data:auth,error:authError}=await supabase.auth.getUser();
        if(authError||!auth?.user){clearAccount();return;}
        const user=auth.user;
        view.ownerId=user.id;
        let orders=[];
        if(view.kind==="client"){
          const {data,error}=await supabase.from("orders")
            .select("id,service,created_at,status").eq("user_id",user.id)
            .order("created_at",{ascending:false}).limit(50);
          if(error)throw error;
          orders=data||[];
        }else if(view.kind==="admin"){
          const {data:member,error:memberError}=await supabase.from("peh_admins")
            .select("user_id").eq("user_id",user.id).maybeSingle();
          if(memberError||!member){clearAccount();return;}
          const {data,error}=await supabase.from("orders")
            .select("id,service,created_at,status")
            .order("created_at",{ascending:false}).limit(100);
          if(error)throw error;
          orders=data||[];
        }else{
          const {data:member,error:memberError}=await supabase.from("peh_writer_accounts")
            .select("writer_id").eq("user_id",user.id).maybeSingle();
          if(memberError||!member){clearAccount();return;}
          const {data,error}=await supabase.rpc("peh_get_my_writer_projects");
          if(error)throw error;
          orders=data||[];
        }
        if(seq!==view.orderSeq||view.ownerId!==user.id)return;
        const previous=select.value;
        view.orders=orders;
        select.replaceChildren(new Option("Select an order",""));
        for(const order of orders){
          const opt=new Option(order.service+" · "+order.id.slice(0,8)+" · "+order.status,order.id);
          select.append(opt);
        }
        if(orders.some(o=>o.id===previous))select.value=previous;
        view.opened=true;
        if(!orders.length){
          thread.replaceChildren();
          view.setStatus("No authorized orders found.");
          return;
        }
        if(!select.value)select.value=orders[0].id;
        await view.loadMessages();
      }catch(err){
        if(seq===view.orderSeq)view.setStatus("Couldn't load conversations: "+(err?.message||String(err)),true);
      }finally{
        view.loading=false;
        refreshOrders.disabled=false;
      }
    };
    view.loadMessages=async({quiet=false}={})=>{
      const orderId=select.value;
      const token=++view.threadSeq;
      if(!orderId){
        thread.replaceChildren();
        view.setStatus("Select an order to view its private messages.");
        return;
      }
      if(!view.orders.some(o=>o.id===orderId)){
        thread.replaceChildren();
        view.setStatus("This order is not available to this account.",true);
        return;
      }
      if(!quiet)view.setStatus("Loading messages…");
      try{
        const {data:auth,error:authError}=await supabase.auth.getUser();
        if(authError||!auth?.user||auth.user.id!==view.ownerId)return;
        const {data,error}=await supabase.from("peh_order_messages")
          .select("id,order_id,sender_id,sender_role,body,created_at")
          .eq("order_id",orderId)
          .order("created_at",{ascending:false}).limit(100);
        if(token!==view.threadSeq||orderId!==select.value)return;
        if(error)throw error;
        thread.replaceChildren();
        const messages=(data||[]).slice().reverse();
        if(!messages.length){
          thread.append(make("p","muted","No messages yet. You can start this conversation below."));
        }else{
          for(const m of messages){
            const mine=m.sender_id===auth.user.id;
            const item=make("article","peh-message-item"+(mine?" is-mine":""));
            const meta=make("div","peh-message-meta");
            const label=mine?"You":m.sender_role==="admin"?"PEH Administrator":m.sender_role==="writer"?"Assigned specialist":"Client";
            meta.append(make("strong","",label),make("time","",new Date(m.created_at).toLocaleString()));
            item.append(meta,make("p","",m.body));
            if(!mine){
              const report=make("button","button secondary peh-report-button","Report this message");
              report.type="button";
              report.addEventListener("click",async()=>{
                if(!window.confirm("Report this message privately to PEH administrators? False reports may be reviewed."))return;
                const choices=["personal_information","off_platform_contact","payment_request","threat_or_extortion","harassment","other"];
                const reasonText=window.prompt(
                  "Choose a reason: personal_information, off_platform_contact, payment_request, threat_or_extortion, harassment, or other",
                  "personal_information"
                );
                if(reasonText===null)return;
                const reason=reasonText.trim().toLowerCase();
                if(!choices.includes(reason)){
                  view.setStatus("Use one of the listed report reasons.",true);return;
                }
                const details=window.prompt("Optional details for the PEH safeguarding team (do not enter passwords or payment information):","")||"";
                if(details.length>1000){view.setStatus("Report details must be under 1,000 characters.",true);return;}
                report.disabled=true;
                const {error:reportError}=await supabase.from("peh_message_reports").insert({
                  message_id:m.id,order_id:m.order_id,reason,details
                });
                report.disabled=false;
                if(reportError)view.setStatus("Could not file the report: "+reportError.message,true);
                else {view.setStatus("Your report was submitted confidentially to PEH administrators.");report.textContent="Reported";report.disabled=true;}
              });
              item.append(report);
            }
            thread.append(item);
          }
        }
        if(!quiet)view.setStatus(messages.length+" message(s) loaded. Only authorized order participants can read or send.");
      }catch(err){
        if(token===view.threadSeq)view.setStatus("Unable to load messages. Make sure Phase 9 SQL has been activated: "+(err?.message||String(err)),true);
      }
    };
    refreshOrders.addEventListener("click",view.loadOrders);
    refreshMessages.addEventListener("click",()=>view.loadMessages());
    select.addEventListener("change",()=>{
      thread.replaceChildren();
      view.loadMessages();
    });
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      const orderId=select.value,text=body.value.trim();
      if(!orderId||!view.orders.some(o=>o.id===orderId)){
        view.setStatus("Select a valid assigned or owned order.",true);return;
      }
      if(text.length<1||text.length>3000){
        view.setStatus("Enter a message between 1 and 3,000 characters.",true);return;
      }
      if(typeof supabase==="undefined"||!supabase){
        view.setStatus("Messaging is unavailable.",true);return;
      }
      send.disabled=true;
      try{
        const {data:auth,error:authError}=await supabase.auth.getUser();
        if(authError||!auth?.user||auth.user.id!==view.ownerId)throw new Error("Sign in again to send.");
        // The database fills in the real sender_id and sender_role securely.
        const {error}=await supabase.from("peh_order_messages").insert({order_id:orderId,body:text});
        if(error)throw error;
        body.value="";
        view.setStatus("Message sent securely.");
        await view.loadMessages({quiet:true});
      }catch(err){
        view.setStatus("Message not sent: "+(err?.message||String(err)),true);
      }finally{send.disabled=false;}
    });
    // Keep this form hidden until a suitable order is selected.
    const sync=()=>{form.classList.toggle("hidden",!select.value);refreshMessages.disabled=!select.value;};
    new MutationObserver(sync).observe(select,{childList:true});
    select.addEventListener("change",sync);
    sync();
  }

  let currentUser=null,started=false,authListener=null;
  const resetAll=()=>{
    for(const v of views){if(v.clear)v.clear();}
  };
  const updateCurrent=async()=>{
    if(typeof supabase==="undefined"||!supabase)return;
    try{
      const {data:auth}=await supabase.auth.getUser();
      const next=auth?.user?.id||null;
      if(currentUser!==next){
        currentUser=next;
        resetAll();
      }
      if(!next)return;
      for(const v of views){
        if(v.loadOrders&&!v.opened){
          if(v.kind==="client")v.loadOrders();
          // Admin/writer panels load on their workspace refresh or on click.
        }
      }
    }catch{resetAll();}
  };
  let tries=0;
  const startup=setInterval(()=>{
    tries++;
    if(typeof supabase!=="undefined"&&supabase){
      clearInterval(startup);
      if(!started){
        started=true;
        authListener=supabase.auth.onAuthStateChange(()=>setTimeout(updateCurrent,100));
      }
      updateCurrent();
    }else if(tries>=30)clearInterval(startup);
  },600);
  // Admin and writer conversations do not display any data without click.
  // 30-second polling only for a previously opened thread in a visible workspace.
  const polling=setInterval(()=>{
    if(document.hidden)return;
    for(const v of views){
      if(v.opened&&v.select?.value&&!v.section?.closest(".hidden")&&v.ownerId===currentUser)
        v.loadMessages({quiet:true});
    }
  },30000);
  window.addEventListener("pagehide",()=>{clearInterval(polling);clearInterval(startup);});
})();