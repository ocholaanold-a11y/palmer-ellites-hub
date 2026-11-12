
const SERVICES=[
["✍️","Essay Writing","Essay planning, outlining, argument development, model examples and feedback to help students write their own original essays.",["Planning","Writing guidance"]],
["🎓","Research, Thesis & Dissertations","Research proposals, topic refinement, methodology coaching, literature search strategy, thesis/dissertation editing and chapter feedback.",["Research","Thesis support"]],
["💼","Business & Content Writing","Business reports, professional proposals, marketing copy, website content and articles for permitted professional use.",["Business","Content"]],
["📈","Excel Related Analysis","Excel formulas, pivot tables, data cleaning, dashboards, spreadsheet automation and analysis explanations.",["Spreadsheets","Analytics"]],
["🎨","PowerPoint & Canva Designs","Slide design, presentation redesign, infographics, posters, Canva templates and visual storytelling.",["Slides","Design"]],
["🌐","Website Analysis","Website usability reviews, accessibility audits, SEO basics, performance assessment and actionable recommendations.",["UX","Website audits"]],
["📊","Data Visualization","Graphs, charts, interactive dashboards, reports and clear explanation of data insights.",["Charts","Dashboards"]],
["📉","SPSS Analysis","Descriptive statistics, regression, hypothesis tests, ANOVA, SPSS output guidance and findings interpretation.",["Statistics","SPSS"]],
["📝","Proofreading & Editing","Grammar, clarity, style, structure and readability feedback while preserving the author's ideas and voice.",["Proofreading","Editing"]],
["📚","Tutoring & Study Support","Subject tutoring, concept explanations, study plans and constructive learning support.",["Learning","Coaching"]],
["📑","Report Checking","Checks for report organization, coherence, evidence use, formatting, citations and actionable revision suggestions.",["Review","Quality"]],
["🧾","Referencing & Formatting","APA, MLA, Harvard, Chicago and IEEE referencing guidance, citations and document formatting.",["Citations","Formatting"]],
["🔄","Revisions","Follow-up revisions to eligible design, editing and professional writing deliverables, plus improvement feedback and refinement.",["Updates","Feedback"]]
];
/* TEMPLATE DATA ONLY: never publish as genuine team member credentials. Edit with authorized facts. */
const WRITERS=[
{id:"statistics",initials:"DA",name:"Sample Specialist A",role:"Statistical Analysis Specialist",bio:"Illustrative profile for the SPSS, Excel and research methods team. Replace with a real professional's approved biography.",skills:["SPSS","Excel","Regression","Data interpretation"],qualifications:[],achievements:[],portfolio:[]},
{id:"editing",initials:"EB",name:"Sample Specialist B",role:"Editing & Report Review Specialist",bio:"Illustrative profile for proofreading, academic writing guidance, referencing and report checking.",skills:["Report review","APA style","Proofreading","Feedback"],qualifications:[],achievements:[],portfolio:[]},
{id:"design",initials:"PC",name:"Sample Specialist C",role:"Presentation & Design Specialist",bio:"Illustrative profile for PowerPoint, Canva, infographics and visual storytelling services.",skills:["PowerPoint","Canva","Slides","Infographics"],qualifications:[],achievements:[],portfolio:[]}
];
const $=id=>document.getElementById(id);
const escapeHtml = str=>String(str ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
$("year").textContent=new Date().getFullYear();
$("menuToggle").addEventListener("click",()=>{$("nav").classList.toggle("open")});
document.querySelectorAll(".nav-links a").forEach(x=>x.addEventListener("click",()=>$("nav").classList.remove("open")));
$("servicesGrid").innerHTML=SERVICES.map(s=>'<article class="service-card"><div class="service-icon">'+s[0]+'</div><h3>'+s[1]+'</h3><p>'+s[2]+'</p><a class="text-link service-select" href="#request" data-service="'+escapeHtml(s[1])+'">Request this service ↗</a></article>').join("");
$("serviceInput").innerHTML='<option value="">Select a service</option>'+SERVICES.map(s=>'<option value="'+escapeHtml(s[1])+'">'+s[1]+'</option>').join("");
const currencyCodes = Array.isArray(window.PEH_CONFIG?.currencyOptions) ? window.PEH_CONFIG.currencyOptions : ["USD","KES","EUR","GBP","CAD","AUD","INR","MYR","PHP","SGD","AED"];
const allowedCurrencies = [...new Set(currencyCodes.filter(c=>/^[A-Z]{3}$/.test(c)))];
$("currencyInput").innerHTML=allowedCurrencies.map(code=>'<option value="'+escapeHtml(code)+'">'+escapeHtml(code)+'</option>').join("");
$("currencyInput").value=allowedCurrencies.includes(window.PEH_CONFIG?.defaultCurrency)?window.PEH_CONFIG.defaultCurrency:(allowedCurrencies[0]||"USD");
$("currencyInput").addEventListener("change",()=>{ $("selectedCurrency").textContent=$("currencyInput").value; });
$("selectedCurrency").textContent=$("currencyInput").value;
document.querySelectorAll(".service-select").forEach(x=>x.addEventListener("click",()=>$("serviceInput").value=x.dataset.service));
$("writersGrid").innerHTML=WRITERS.map(w=>'<article class="writer-card"><div class="avatar" aria-hidden="true">'+escapeHtml(w.initials)+'</div><div class="role">'+escapeHtml(w.role)+'</div><h3>'+escapeHtml(w.name)+'</h3><p class="bio">'+escapeHtml(w.bio)+'</p><div class="tags">'+w.skills.map(t=>'<span class="tag">'+escapeHtml(t)+'</span>').join("")+'</div><div class="writer-footer"><span class="demo-tag">Sample — unverified</span><button type="button" class="button secondary view-profile" data-id="'+escapeHtml(w.id)+'">View Profile →</button></div></article>').join("");
$("writerInput").innerHTML='<option value="">No preference</option>'+WRITERS.map(w=>'<option value="'+escapeHtml(w.name)+'">'+escapeHtml(w.name)+' (sample)</option>').join("");
document.querySelectorAll(".view-profile").forEach(b=>b.addEventListener("click",()=>showProfile(b.dataset.id)));
const section=(heading,items,empty)=>'<section class="profile-section"><h4>'+heading+'</h4>'+(items.length?'<ul>'+items.map(item=>'<li>'+escapeHtml(item)+'</li>').join("")+'</ul>':'<p class="muted">'+empty+'</p>')+'</section>';
function showProfile(id){
 const w=WRITERS.find(x=>x.id===id);if(!w)return;
 $("profileContent").innerHTML='<span class="eyebrow">SPECIALIST PROFILE · SAMPLE TEMPLATE</span><div class="avatar">'+escapeHtml(w.initials)+'</div><h2>'+escapeHtml(w.name)+'</h2><strong>'+escapeHtml(w.role)+'</strong><p>'+escapeHtml(w.bio)+'</p>'+section("Areas of expertise",w.skills,"Not specified")+section("Qualifications",w.qualifications,"Awaiting verification of credentials")+section("Achievements",w.achievements,"No verified achievements published yet")+section("Portfolio and previous work",w.portfolio,"Sample work will appear here once authorized")+'<p class="form-status">This demonstration profile does not represent a verified PEH team member.</p><a href="#request" class="button primary" id="chooseWriter">Request this specialist →</a>';
 $("profileModal").showModal();
 $("chooseWriter").addEventListener("click",()=>{$("writerInput").value=w.name;$("profileModal").close();});
}
$("closeModal").addEventListener("click",()=>$("profileModal").close());
$("profileModal").addEventListener("click",e=>{if(e.target===$("profileModal"))$("profileModal").close()});
const settings=window.PEH_CONFIG||{};
const isConfigured=typeof settings.supabaseUrl==="string"&&/^https:\/\/.+supabase.co\/?$/.test(settings.supabaseUrl)&&settings.supabaseAnonKey&&settings.supabaseAnonKey!=="REPLACE_ME";
let supabase=null;
async function initSupabase(){
 if(!isConfigured)return;
 try{
  const mod=await import("https://esm.sh/@supabase/supabase-js@2.57.0");
  supabase=mod.createClient(settings.supabaseUrl,settings.supabaseAnonKey);
  const {data:{session}}=await supabase.auth.getSession();
  showAuth(session?.user);
  supabase.auth.onAuthStateChange((_event,s)=>{showAuth(s?.user);if(s?.user)loadOrders();});
 }catch(err){showNotice("authStatus","Secure account service is currently unavailable.","error")}
}
function showNotice(id,msg,type){const el=$(id);el.textContent=msg;el.className="form-status "+(type==="error"?"feedback-error":type==="success"?"feedback-success":"")}
function showAuth(user){
 if(!supabase)return;
 $("authState").textContent=user?"Signed in as "+user.email:"Sign in to view your requests and order progress.";
 $("signOut").classList.toggle("hidden",!user);
 $("signIn").classList.toggle("hidden",!!user);$("signUp").classList.toggle("hidden",!!user);
 $("authPassword").required=!user;$("authEmail").required=!user;
 $("authForm").classList.toggle("hidden",!!user);
 if(user)loadOrders();else $("ordersPanel").innerHTML='<p>Sign in to see your projects.</p>';
}
async function authAction(type){
 if(!supabase)return showNotice("authStatus","Accounts are not yet enabled. PEH must connect a secure database before registration opens.","error");
 const email=$("authEmail").value.trim(),password=$("authPassword").value;
 if(!email||password.length<8)return showNotice("authStatus","Enter an email address and password (at least 8 characters).","error");
 let result;
 if(type==="signup"){
  if(!confirm("Please confirm you are at least 18 years old. Under-18 registration is not available in this launch version."))return;
  result=await supabase.auth.signUp({email,password});
 }else result=await supabase.auth.signInWithPassword({email,password});
 if(result.error)return showNotice("authStatus",result.error.message,"error");
 showNotice("authStatus",type==="signup"?"Account request received. Check email for verification, if required.":"Signed in successfully.","success");
}
$("signIn").addEventListener("click",()=>authAction("signin"));
$("signUp").addEventListener("click",()=>authAction("signup"));
$("signOut").addEventListener("click",async()=>{if(supabase)await supabase.auth.signOut();});
async function loadOrders(){
 if(!supabase)return;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return;
 const {data,error}=await supabase.from("orders").select("id,service,description,deadline,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);
 if(error){$("ordersPanel").innerHTML='<p>Orders will appear when the secure PEH database and access policies are configured.</p>';return;}
 $("ordersPanel").innerHTML=data?.length?data.map(o=>'<div class="screen-line"><div><b>'+escapeHtml(o.service)+'</b><small>'+escapeHtml(new Date(o.created_at).toLocaleDateString())+' · '+escapeHtml(o.status)+'</small></div></div>').join(""):'<div class="empty-state"><div class="empty-icon">📦</div><b>No projects yet</b><p>Your project updates will appear here.</p></div>';
}
$("requestForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const f=$("attachment").files[0];
 if(f&&f.size>5*1024*1024)return showNotice("requestStatus","Your file exceeds 5 MB. Please choose a smaller file.","error");
 if(!supabase)return showNotice("requestStatus","The order backend has not been connected yet. This form has NOT sent your request or uploaded any files. Please do not submit sensitive information here.","error");
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return showNotice("requestStatus","Sign in to your student account first. Your request has not been submitted.","error");
 if(f)return showNotice("requestStatus","Secure file upload is not configured in this preview. Please remove the attachment before submitting, or ask the administrator to enable private storage.","error");
 const payload={user_id:user.id,service:$("serviceInput").value,description:$("description").value,deadline:new Date($("deadline").value).toISOString(),contact_email:$("requestEmail").value,preferred_writer:$("writerInput").value||null,requested_currency:$("currencyInput").value,status:"submitted"};
 const {error}=await supabase.from("orders").insert(payload);
 if(error)return showNotice("requestStatus","Submission was unsuccessful: "+error.message,"error");
 showNotice("requestStatus","Your request was received. Check your dashboard for updates.","success");$("requestForm").reset();loadOrders();
});
initSupabase();
