/* Palmer Ellites Hub – private, signed-in customer notifications.
   Database RLS controls visibility. This panel never accesses private server keys. */
(()=>{
 const $$=(id)=>document.getElementById(id);
 const dashboard=$$("dashboard");
 if(!dashboard)return;
 const panel=document.createElement("section");
 panel.id="pehNotificationsPanel";
 panel.className="panel peh-notifications-panel";
 panel.innerHTML='<div class="peh-notification-heading"><h3>My Notifications <span id="pehUnreadCount" class="peh-unread-count" aria-live="polite"></span></h3><button id="pehRefreshNotifications" type="button" class="button secondary">Refresh notifications</button></div><p id="pehNotificationStatus" class="form-status" aria-live="polite">Sign in to see order updates.</p><div id="pehNotificationItems"></div>';
 dashboard.querySelector(".dashboard-grid")?.after(panel);
 const items=$$("pehNotificationItems"), status=$$("pehNotificationStatus"), unread=$$("pehUnreadCount");
 const refresh=$$("pehRefreshNotifications");
 let loading=false;
 function show(message,bad=false){status.className="form-status "+(bad?"feedback-error":"");status.textContent=message;}
 async function loadNotifications(){
   if(loading)return;
   if(typeof supabase==="undefined"||!supabase){show("Connecting your account…");return;}
   loading=true;refresh.disabled=true;
   try{
     const {data:auth,error:authError}=await supabase.auth.getUser();
     if(authError||!auth?.user){
       items.replaceChildren();
       unread.textContent="";
       show("Sign in to view your private notifications.");
       return;
     }
     const {data,error}=await supabase.from("peh_notifications")
       .select("id,title,message,read_at,created_at,order_id")
       .eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(50);
     if(error){show("Notifications unavailable. Ask PEH to enable the notification database, or refresh your account.",true);return;}
     const rows=data||[];
     items.replaceChildren();
     const count=rows.filter(n=>!n.read_at).length;
     unread.textContent=count?count+" new":"";
     if(!rows.length){show("You have no notifications yet.");return;}
     show(count?count+" unread notification(s).":"You're all caught up.");
     for(const n of rows){
       const card=document.createElement("article");card.className="peh-notification"+(n.read_at?"":" is-unread");
       const title=document.createElement("strong");title.textContent=n.title;
       const body=document.createElement("p");body.textContent=n.message;
       const time=document.createElement("small");time.textContent=new Date(n.created_at).toLocaleString();
       const controls=document.createElement("div");controls.className="button-row";
       const files=document.createElement("a");files.href="#dashboard";files.className="button secondary";files.textContent="View my files";
       files.addEventListener("click",()=>dashboard.querySelector(".peh-private-files")?.scrollIntoView({behavior:"smooth"}));
       controls.append(files);
       if(!n.read_at){
         const read=document.createElement("button");read.type="button";read.className="button secondary";read.textContent="Mark as read";
         read.addEventListener("click",async()=>{
           read.disabled=true;
           const {error:updateError}=await supabase.from("peh_notifications")
              .update({read_at:new Date().toISOString()}).eq("id",n.id).eq("user_id",auth.user.id);
           if(updateError){show("Unable to mark notification as read. Please try again.",true);read.disabled=false;return;}
           await loadNotifications();
         });
         controls.append(read);
       }
       card.append(title,body,time,controls);items.append(card);
     }
   }catch(e){show("Couldn't load notifications. Check your connection and try again.",true);}
   finally{loading=false;refresh.disabled=false;}
 }
 refresh.addEventListener("click",loadNotifications);
 // Refresh on login changes, and whenever the user returns to the tab.
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadNotifications();});
 const interval=setInterval(()=>{if(!document.hidden)loadNotifications();},60000);
 window.addEventListener("pagehide",()=>clearInterval(interval),{once:true});
 // Supabase initializes asynchronously. Only load after an authenticated event,
 // or on manual refresh; startup check is delayed until the account is ready.
 let attempts=0;
 const check=setInterval(()=>{
   attempts++;
   if(typeof supabase!=="undefined"&&supabase){
     clearInterval(check);
     loadNotifications();
     supabase.auth.onAuthStateChange(()=>setTimeout(loadNotifications,100));
   }else if(attempts>=20)clearInterval(check);
 },700);
})();
