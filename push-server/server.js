import express from "express";
import cors from "cors";
import webpush from "web-push";

const app = express();
app.use(cors());
app.use(express.json({limit:"1mb"}));

const PORT = Number(process.env.PORT || 8080);
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:example@example.com";
const APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || "").replace(/\/+$/,"");
const PUSH_BACKEND_TOKEN = process.env.PUSH_BACKEND_TOKEN || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

if(!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY){
  console.warn("VAPID keys are not configured.");
}else{
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const subscriptions = new Map();

app.get("/health", (_req,res)=>res.json({ok:true}));
app.get("/vapid-public-key", (_req,res)=>res.json({publicKey:VAPID_PUBLIC_KEY}));

app.post("/subscribe", (req,res)=>{
  const sub = req.body?.subscription;
  if(!sub?.endpoint) return res.status(400).json({ok:false,error:"subscription missing"});
  subscriptions.set(sub.endpoint, sub);
  res.json({ok:true});
});

app.post("/unsubscribe", (req,res)=>{
  const endpoint = req.body?.endpoint;
  if(endpoint) subscriptions.delete(endpoint);
  res.json({ok:true});
});

app.post("/test", async (req,res)=>{
  const endpoint = req.body?.endpoint;
  const sub = subscriptions.get(endpoint);
  if(!sub) return res.status(404).json({ok:false,error:"subscription not registered on this server instance"});
  try{
    await webpush.sendNotification(sub, JSON.stringify({
      title:"Min hjälp",
      body:"Testnotisen fungerar.",
      badgeCount:1,
      url:"./"
    }), {TTL:60, urgency:"high"});
    res.json({ok:true});
  }catch(err){
    console.error(err);
    res.status(500).json({ok:false,error:"push failed"});
  }
});

async function fetchPushBundle(){
  if(!APPS_SCRIPT_URL || !PUSH_BACKEND_TOKEN) throw new Error("APPS_SCRIPT_URL/PUSH_BACKEND_TOKEN missing");
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action","pushBundle");
  url.searchParams.set("token",PUSH_BACKEND_TOKEN);
  const response = await fetch(url);
  if(!response.ok) throw new Error("Apps Script bundle request failed");
  const data = await response.json();
  if(!data.ok) throw new Error(data.error || "Apps Script returned error");
  return data;
}

async function markSent(ids){
  if(!ids.length) return;
  await fetch(APPS_SCRIPT_URL, {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action:"pushMarkSent",payload:{ids}})
  });
}

async function tick(){
  const bundle = await fetchPushBundle();
  const due = Array.isArray(bundle.due) ? bundle.due : [];
  const stored = Array.isArray(bundle.subscriptions) ? bundle.subscriptions : [];
  const allSubs = new Map();
  for(const s of stored) if(s?.endpoint) allSubs.set(s.endpoint,s);
  for(const [endpoint,s] of subscriptions) allSubs.set(endpoint,s);

  if(!due.length || !allSubs.size){
    return {due:due.length,subscriptions:allSubs.size,sent:0};
  }

  let sent = 0;
  const successfulTaskIds = new Set();

  for(const task of due){
    const payload = JSON.stringify({
      title:"Min hjälp",
      body:task.text || "Du har en påminnelse.",
      badgeCount:Number(task.badgeCount || 0),
      url:"./"
    });

    let taskSent = false;
    for(const sub of allSubs.values()){
      try{
        await webpush.sendNotification(sub, payload, {TTL:300, urgency:"high"});
        sent++;
        taskSent = true;
      }catch(err){
        const code = err?.statusCode;
        if(code === 404 || code === 410){
          subscriptions.delete(sub.endpoint);
        }
        console.error("Push failed", code, err?.message);
      }
    }
    if(taskSent) successfulTaskIds.add(task.id);
  }

  await markSent([...successfulTaskIds]);
  return {due:due.length,subscriptions:allSubs.size,sent};
}

app.post("/tick", async (req,res)=>{
  const token = req.get("x-cron-secret") || req.query.token || "";
  if(!CRON_SECRET || token !== CRON_SECRET) return res.status(401).json({ok:false,error:"Unauthorized"});
  try{
    const result = await tick();
    res.json({ok:true,...result});
  }catch(err){
    console.error(err);
    res.status(500).json({ok:false,error:err.message});
  }
});

app.listen(PORT, ()=>console.log(`Min hjälp push server listening on ${PORT}`));
