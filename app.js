const STORAGE_KEY = "min-hjalp-v1";
const API_KEY = "min-hjalp-api-url";

const state = loadState();
let apiUrl = localStorage.getItem(API_KEY) || "";

const els = {
  todayDate: document.querySelector("#todayDate"),
  todayList: document.querySelector("#todayList"),
  todayEmpty: document.querySelector("#todayEmpty"),
  inboxList: document.querySelector("#inboxList"),
  inboxEmpty: document.querySelector("#inboxEmpty"),
  routineList: document.querySelector("#routineList"),
  routineEmpty: document.querySelector("#routineEmpty"),
  nowTaskText: document.querySelector("#nowTaskText"),
  doneNowBtn: document.querySelector("#doneNowBtn"),
  skipNowBtn: document.querySelector("#skipNowBtn"),
  quickDialog: document.querySelector("#quickDialog"),
  routineDialog: document.querySelector("#routineDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
  quickText: document.querySelector("#quickText"),
  quickDate: document.querySelector("#quickDate"),
  quickTime: document.querySelector("#quickTime"),
  quickMakeNow: document.querySelector("#quickMakeNow"),
  routineName: document.querySelector("#routineName"),
  routineSteps: document.querySelector("#routineSteps"),
  apiUrl: document.querySelector("#apiUrl"),
  helpResponse: document.querySelector("#helpResponse"),
};

function defaultState(){
  return {
    tasks: [
      {id: crypto.randomUUID(), text:"Testa appen och lägg till en egen sak", date: todayISO(), time:"", status:"open", inbox:false}
    ],
    routines: [
      {id: crypto.randomUUID(), name:"Morgon", steps:[
        {text:"Klä på mig", done:false},
        {text:"Borsta tänderna", done:false},
        {text:"Ta det jag behöver med mig", done:false}
      ]}
    ],
    nowTaskId: null
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  }catch{
    return defaultState();
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  syncState();
}

async function syncState(){
  if(!apiUrl) return;
  try{
    await fetch(apiUrl, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"sync", payload:state})
    });
  }catch(err){
    console.warn("Synk misslyckades, data finns kvar lokalt.", err);
  }
}

function todayISO(){
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0,10);
}

function formatToday(){
  return new Intl.DateTimeFormat("sv-SE", {weekday:"long", day:"numeric", month:"long"}).format(new Date());
}

function render(){
  els.todayDate.textContent = formatToday();

  const todayTasks = state.tasks
    .filter(t => t.date === todayISO() && !t.inbox && t.status !== "done")
    .sort((a,b) => (a.time||"99:99").localeCompare(b.time||"99:99"));

  const inboxTasks = state.tasks.filter(t => t.inbox && t.status !== "done");

  renderTaskList(els.todayList, todayTasks);
  renderTaskList(els.inboxList, inboxTasks);
  els.todayEmpty.style.display = todayTasks.length ? "none" : "block";
  els.inboxEmpty.style.display = inboxTasks.length ? "none" : "block";

  const nowTask = state.tasks.find(t => t.id === state.nowTaskId && t.status !== "done");
  if(nowTask){
    els.nowTaskText.textContent = nowTask.text;
    els.doneNowBtn.disabled = false;
    els.skipNowBtn.disabled = false;
  }else{
    els.nowTaskText.textContent = todayTasks[0]?.text || "Inget valt ännu.";
    els.doneNowBtn.disabled = !todayTasks[0];
    els.skipNowBtn.disabled = !todayTasks[0];
    if(todayTasks[0]) state.nowTaskId = todayTasks[0].id;
  }

  renderRoutines();
}

function renderTaskList(container, tasks){
  container.innerHTML = "";
  for(const task of tasks){
    const node = document.querySelector("#taskTemplate").content.cloneNode(true);
    const article = node.querySelector(".task-item");
    node.querySelector(".task-text").textContent = task.text;
    node.querySelector(".task-meta").textContent = [task.date === todayISO() ? "Idag" : task.date, task.time].filter(Boolean).join(" • ");
    node.querySelector(".check-btn").addEventListener("click", () => completeTask(task.id));
    node.querySelector(".more-btn").addEventListener("click", () => {
      const choice = prompt("Skriv 'nu' för att göra den till NU-uppgift, eller 'ta bort' för att radera.");
      if(choice?.toLowerCase() === "nu"){
        state.nowTaskId = task.id;
        saveState();
      }else if(choice?.toLowerCase() === "ta bort"){
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        if(state.nowTaskId === task.id) state.nowTaskId = null;
        saveState();
      }
    });
    container.appendChild(node);
  }
}

function completeTask(id){
  const task = state.tasks.find(t => t.id === id);
  if(!task) return;
  task.status = "done";
  if(state.nowTaskId === id) state.nowTaskId = null;
  saveState();
}

function renderRoutines(){
  els.routineList.innerHTML = "";
  for(const routine of state.routines){
    const card = document.createElement("article");
    card.className = "routine-card";
    const title = document.createElement("h3");
    title.textContent = routine.name;
    card.appendChild(title);

    routine.steps.forEach((step, index) => {
      const row = document.createElement("label");
      row.className = "routine-step";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!step.done;
      checkbox.addEventListener("change", () => {
        step.done = checkbox.checked;
        saveState();
      });
      const span = document.createElement("span");
      span.textContent = step.text;
      row.append(checkbox, span);
      card.appendChild(row);
    });

    const reset = document.createElement("button");
    reset.className = "small-btn";
    reset.textContent = "Börja om";
    reset.addEventListener("click", () => {
      routine.steps.forEach(s => s.done = false);
      saveState();
    });
    card.appendChild(reset);
    els.routineList.appendChild(card);
  }
  els.routineEmpty.style.display = state.routines.length ? "none" : "block";
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector("#" + btn.dataset.tab).classList.add("active");
  });
});

function openQuick(){
  els.quickText.value = "";
  els.quickDate.value = "";
  els.quickTime.value = "";
  els.quickMakeNow.checked = false;
  els.quickDialog.showModal();
  setTimeout(() => els.quickText.focus(), 50);
}

document.querySelector("#quickAddBtn").addEventListener("click", openQuick);
document.querySelector("#addInboxBtn").addEventListener("click", openQuick);

document.querySelector("#quickForm").addEventListener("submit", (e) => {
  if(e.submitter?.value === "cancel") return;
  e.preventDefault();
  const text = els.quickText.value.trim();
  if(!text) return;
  const date = els.quickDate.value;
  const task = {
    id: crypto.randomUUID(),
    text,
    date,
    time: els.quickTime.value,
    status:"open",
    inbox: !date
  };
  state.tasks.push(task);
  if(els.quickMakeNow.checked) state.nowTaskId = task.id;
  saveState();
  els.quickDialog.close();
});

document.querySelector("#addRoutineBtn").addEventListener("click", () => {
  els.routineName.value = "";
  els.routineSteps.value = "";
  els.routineDialog.showModal();
});

document.querySelector("#routineForm").addEventListener("submit", (e) => {
  if(e.submitter?.value === "cancel") return;
  e.preventDefault();
  const name = els.routineName.value.trim();
  const steps = els.routineSteps.value.split("\n").map(s => s.trim()).filter(Boolean);
  if(!name || !steps.length) return;
  state.routines.push({
    id: crypto.randomUUID(),
    name,
    steps: steps.map(text => ({text, done:false}))
  });
  saveState();
  els.routineDialog.close();
});

els.doneNowBtn.addEventListener("click", () => {
  if(state.nowTaskId) completeTask(state.nowTaskId);
});

els.skipNowBtn.addEventListener("click", () => {
  const openToday = state.tasks.filter(t => t.date === todayISO() && t.status !== "done");
  if(!openToday.length) return;
  const idx = Math.max(0, openToday.findIndex(t => t.id === state.nowTaskId));
  const next = openToday[(idx + 1) % openToday.length];
  state.nowTaskId = next.id;
  saveState();
});

document.querySelector("#settingsBtn").addEventListener("click", () => {
  els.apiUrl.value = apiUrl;
  els.settingsDialog.showModal();
});

document.querySelector("#saveSettingsBtn").addEventListener("click", (e) => {
  e.preventDefault();
  apiUrl = els.apiUrl.value.trim();
  localStorage.setItem(API_KEY, apiUrl);
  els.settingsDialog.close();
  syncState();
});

const helpText = {
  start: "Välj bara en liten början. Titta på NU-rutan ovan. Gör första möjliga steg i två minuter. Det räcker.",
  overload: "Skriv ner allt i Kom ihåg. Du behöver inte sortera eller lösa det nu. Få bara ut det ur huvudet.",
  lost: "Gå tillbaka till NU. Om inget finns där, välj den minsta saken som gör resten lättare.",
  forgot: "Öppna Kom ihåg och skriv det du minns. Lägg till datum först när du vet när det behöver göras."
};

document.querySelectorAll(".help-card").forEach(btn => {
  btn.addEventListener("click", () => {
    els.helpResponse.textContent = helpText[btn.dataset.help];
    els.helpResponse.classList.remove("hidden");
  });
});

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
}

render();
