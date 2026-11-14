/* PEH Workspace Navigation – organize existing mounted controls without changing
   data access or rebuilding forms. Runs after all feature scripts (defer order). */
(()=>{
  const $=id=>document.getElementById(id);
  const create=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=text;
    return e;
  };
  function buildSection(parent,id,eyebrow,title,description){
    const section=create("section","peh-workspace-section");
    section.id=id;
    const head=create("div","peh-workspace-section-heading");
    head.append(create("span","peh-section-eyebrow",eyebrow));
    head.append(create("h3","",title));
    head.append(create("p","",description));
    const content=create("div","peh-workspace-section-content");
    section.append(head,content);
    parent.append(section);
    return content;
  }
  function move(content,element){
    if(element&&element!==content&&!content.contains(element))content.append(element);
  }
  function nav(parent,label,items){
    const wrapper=create("nav","peh-workspace-nav");
    wrapper.setAttribute("aria-label",label);
    const heading=create("div","peh-workspace-nav-heading");
    heading.append(create("strong","","Quick access"),create("span","","Choose a task to jump directly to its section"));
    wrapper.append(heading);
    const links=create("div","peh-workspace-links");
    for(const item of items){
      const link=create("a","peh-workspace-link");
      link.href="#"+item.id;
      link.append(create("span","peh-workspace-link-icon",item.icon));
      const words=create("span","peh-workspace-link-words");
      words.append(create("strong","",item.title),create("small","",item.caption));
      link.append(words,create("span","peh-workspace-link-arrow","↗"));
      links.append(link);
    }
    wrapper.append(links);
    parent.append(wrapper);
    return wrapper;
  }

  function client(){
    const root=$("dashboard")?.querySelector(".container");
    if(!root||$("pehClientOverview"))return;
    const existingGrid=root.querySelector(".dashboard-grid");
    if(!existingGrid)return;
    const navBox=nav(root,"Client workspace shortcuts",[
      {id:"pehClientOverview",icon:"👤",title:"Account & orders",caption:"Sign in and track progress"},
      {id:"pehClientDocuments",icon:"📁",title:"My documents",caption:"Private files and downloads"},
      {id:"pehClientUpdates",icon:"🔔",title:"Notifications & revisions",caption:"Updates and feedback"},
      {id:"pehClientChat",icon:"💬",title:"Messages",caption:"Contact PEH about an order"}
    ]);
    root.insertBefore(navBox,existingGrid);
    const overview=buildSection(root,"pehClientOverview","01 / ACCOUNT","My account & order tracking","Your private account, project statuses, and quotations.");
    move(overview,existingGrid);
    const files=buildSection(root,"pehClientDocuments","02 / FILES","My documents","Download approved work and review files submitted with your requests.");
    move(files,root.querySelector(".peh-private-files"));
    const updates=buildSection(root,"pehClientUpdates","03 / UPDATES","Notifications & revisions","Track delivery notices and request improvements to completed work.");
    move(updates,$("pehNotificationsPanel"));
    move(updates,root.querySelector(".peh-revision-panel"));
    const messages=buildSection(root,"pehClientChat","04 / SUPPORT","Order messages","Communicate through PEH; keep all personal and payment details private.");
    move(messages,$("pehMessages-client"));
    // The message module already verifies order ownership on the server.
  }

  function writer(){
    const root=$("pehWriterWorkspace")?.querySelector(".container");
    if(!root||$("pehWriterTasks"))return;
    const intro=root.querySelector(".section-title");
    const panel=root.querySelector(".panel:not(.peh-message-panel)");
    const navbar=nav(root,"Writer workspace shortcuts",[
      {id:"pehWriterTasks",icon:"📋",title:"Assigned projects",caption:"Instructions and deadlines"},
      {id:"pehWriterCommunications",icon:"💬",title:"Project conversations",caption:"Ask PEH for clarification"}
    ]);
    if(intro?.nextSibling)root.insertBefore(navbar,intro.nextSibling);
    else root.insertBefore(navbar,root.firstChild);
    const work=buildSection(root,"pehWriterTasks","01 / PROJECTS","My assigned work","View the requests allocated to your approved specialist account, download source files and submit drafts.");
    move(work,panel);
    const talk=buildSection(root,"pehWriterCommunications","02 / MESSAGING","Project messages","Keep all project communication within PEH. Never request personal contact information or private payments.");
    move(talk,$("pehMessages-writer"));
  }

  function admin(){
    const root=$("admin")?.querySelector(".container");
    if(!root||$("pehAdminRequests"))return;
    const heading=root.querySelector(".section-title");
    const requestPanel=root.querySelector(".admin-panel");
    if(!requestPanel)return;
    const navbar=nav(root,"Administrator workspace shortcuts",[
      {id:"pehAdminRequests",icon:"📊",title:"Orders & quotations",caption:"Incoming requests and assignments"},
      {id:"pehAdminDelivery",icon:"📦",title:"Documents & delivery",caption:"Review, approve and send files"},
      {id:"pehAdminWriters",icon:"👥",title:"Writer management",caption:"Profiles, accounts and access"},
      {id:"pehAdminMessages",icon:"💬",title:"Order conversations",caption:"Respond to clients and writers"},
      {id:"pehAdminSafety",icon:"🛡️",title:"Safety & reports",caption:"Investigate misconduct"}
    ]);
    if(heading?.nextSibling)root.insertBefore(navbar,heading.nextSibling);
    else root.insertBefore(navbar,root.firstChild);

    // Move existing components, not their inner contents: listeners, form state
    // and Supabase permissions remain unchanged.
    const writerProfiles=root.querySelector(".writer-admin-panel");
    const writerLinks=$("pehWriterAccountSection");
    const draftReview=$("pehDraftReviewSection");
    const adminFiles=root.querySelector(".peh-private-files");
    const deliveryPanel=$("pehAdminDeliveryPanel")||root.querySelector(".peh-delivery-panel");
    const deliveryAction=$("pehOpenDelivery");
    const conversation=$("pehMessages-admin");
    const safeguard=$("pehSafeguardReview");

    const requests=buildSection(root,"pehAdminRequests","01 / OPERATIONS","Orders, quotes & assignments","Review new requests, set quotes, and assign approved specialists.");
    move(requests,requestPanel);
    const deliver=buildSection(root,"pehAdminDelivery","02 / DOCUMENTS","Review & deliver documents","Review writer drafts, upload approved deliverables, and check private order files.");
    move(deliver,draftReview);
    move(deliver,deliveryAction);
    move(deliver,deliveryPanel);
    move(deliver,adminFiles);
    const writers=buildSection(root,"pehAdminWriters","03 / TEAM","Writer profiles & access","Maintain verified profiles, authorize writer logins and revoke access when needed.");
    move(writers,writerProfiles);
    move(writers,writerLinks);
    const chat=buildSection(root,"pehAdminMessages","04 / CONVERSATIONS","Order conversations","Communicate securely with clients and assigned specialists.");
    move(chat,conversation);
    const safety=buildSection(root,"pehAdminSafety","05 / SAFETY","Safety reports & conduct","Review personal-information requests, private payments, threats and other reports.");
    move(safety,safeguard);
  }
  try{client();writer();admin();}
  catch(err){
    // Prevent layout enhancements from interfering with core account behavior.
    console.error("PEH workspace navigation could not be initialized",err);
  }
})();
