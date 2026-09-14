const STORAGE_KEY = "min-hjalp-v2";
const LEGACY_STORAGE_KEY = "min-hjalp-v1";
const API_KEY = "min-hjalp-api-url";
const PREF_KEY = "min-hjalp-prefs-v2";

let state = loadState();
let apiUrl = localStorage.getItem(API_KEY) || "";
let prefs = loadPrefs();
let selectedWhen = "later";
let focusMode = false;
let sortEasyFirst = false;

const els = {
  greeting: document.querySelector("#greeting"),
  todayDate: document.querySelector("#todayDate"),
  todayList: document.querySelector("#todayList"),
  todayEmpty: document.querySelector("#todayEmpty"),
  inboxList: document.querySelector("#inboxList"),
  inboxEmpty: document.querySelector("#inboxEmpty"),
  routineList: document.querySelector("#routineList"),
  routineEmpty: document.querySelector("#routineEmpty"),
  nowTaskText: document.querySelector("#nowTaskText"),
  nowStepText: document.querySelector("#nowStepText"),
  nowProgressWrap: document.querySelector("#nowProgressWrap"),
  nowProgressBar: document.querySelector("#nowProgressBar"),
  nowProgressLabel: document.querySelector("#nowProgressLabel"),
  doneNowBtn: document.querySelector("#doneNowBtn"),
  nextStepBtn: document.querySelector("#nextStepBtn"),
  skipNowBtn: document.querySelector("#skipNowBtn"),
  quickDialog: document.querySelector("#quickDialog"),
  quickText: document.querySelector("#quickText"),
  quickDate: document.querySelector("#quickDate"),
  quickTime: document.querySelector("#quickTime"),
  quickSteps: document.querySelector("#quickSteps"),
  dateTimeArea: document.querySelector("#dateTimeArea"),
  routineDialog: document.querySelector("#routineDialog"),
  routineName: document.querySelector("#routineName"),
  routineSteps: document.querySelector("#routineSteps"),
  settingsDialog: document.querySelector("#settingsDialog"),
  apiUrl: document.querySelector("#apiUrl"),
  reduceMotion: document.querySelector("#reduceMotion"),
  largeText: document.querySelector("#largeText"),
  helpResponse: document.querySelector("#helpResponse"),
  inboxSearch: document.querySelector("#inboxSearch"),
  editTaskDialog: document.querySelector("#editTaskDialog"),
  editTaskId: document.querySelector("#editTaskId"),
  editTaskText: document.querySelector("#editTaskText"),
  editTaskDate: document.querySelector("#editTaskDate"),
  editTaskTime: document.querySelector("#editTaskTime"),
  editTaskSteps: document.querySelector("#editTaskSteps")
};

function defaultState(){
  return {
    tasks: [
      {id: crypto.randomUUID(), text:"Testa appen och lägg till en egen sak", date: todayISO(), time:"", status:"open", inbox:false, priority:"normal", steps:[], currentStep:0}
    ],
    routines: [
      {id: crypto.randomUUID(), name:"Morgon", steps:[
        {text:"Klä på mig", done:false},
        {text:"Borsta tänderna", done:false},
        {text:"Ta det jag behöver med mig", done:false}
      ]}
    ],
    nowTaskId: null,
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(s){
  const copy = s || defaultState();
  copy.tasks = (copy.tasks || []).map(t => ({
    id: t.id || crypto.randomUUID(),
    text: t.text || "",
    date: t.date || "",
    time: t.time || "",
    status: t.status || "open",
    inbox: typeof t.inbox === "boolean" ? t.inbox : !t.date,
    priority: t.priority || "normal",
    steps: Array.isArray(t.steps) ? t.steps : [],
    currentStep: Number.isInteger(t.currentStep) ? t.currentStep : 0
  }));
  copy.routines = (copy.routines || []).map(r => ({
    id: r.id || crypto.randomUUID(),
    name: r.name || "Rutin",
    steps: (r.steps || []).map(s => typeof s === "string" ? {text:s, done:false} : {text:s.text || "", done:!!s.done})
  }));
  copy.nowTaskId = copy.nowTaskId || null;
  return copy;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return normalizeState(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if(legacy){
      const migrated = normalizeState(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return defaultState();
  }catch{
    return defaultState();
  }
}

function loadPrefs(){
  try{
    return JSON.parse(localStorage.getItem(PREF_KEY)) || {reduceMotion:false, largeText:false};
  }catch{
    return {reduceMotion:false, largeText:false};
  }
}

function savePrefs(){
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  applyPrefs();
}

function applyPrefs(){
  document.body.classList.toggle("reduce-motion", !!prefs.reduceMotion);
  document.body.classList.toggle("large-text", !!prefs.largeText);
}

function saveState(){
  state.updatedAt = new Date().toISOString();
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
    localStorage.setItem("min-hjalp-last-sync", new Date().toISOString());
  }catch(err){
    console.warn("Synk misslyckades. Data finns kvar lokalt.", err);
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

function formatGreeting(){
  const h = new Date().getHours();
  if(h < 10) return "God morgon 👋";
  if(h < 17) return "Hej 👋";
  return "God kväll 👋";
}

function getOpenToday(){
  let tasks = state.tasks.filter(t => t.date === todayISO() && !t.inbox && t.status !== "done");
  tasks = tasks.sort((a,b) => (a.time||"99:99").localeCompare(b.time||"99:99"));
  if(sortEasyFirst){
    tasks = tasks.sort((a,b) => (a.steps?.length || 0) - (b.steps?.length || 0));
  }
  return tasks;
}

function getNowTask(){
  let task = state.tasks.find(t => t.id === state.nowTaskId && t.status !== "done");
  if(!task){
    task = getOpenToday()[0] || null;
    if(task) state.nowTaskId = task.id;
  }
  return task;
}

function render(){
  els.greeting.textContent = formatGreeting();
  els.todayDate.textContent = formatToday();

  const todayTasks = getOpenToday();
  const q = (els.inboxSearch?.value || "").trim().toLowerCase();
  const inboxTasks = state.tasks.filter(t => t.inbox && t.status !== "done" && (!q || t.text.toLowerCase().includes(q)));

  renderTaskList(els.todayList, todayTasks);
  renderTaskList(els.inboxList, inboxTasks);
  els.todayEmpty.style.display = todayTasks.length ? "none" : "block";
  els.inboxEmpty.style.display = inboxTasks.length ? "none" : "block";

  renderNow();
  renderRoutines();
}

function renderNow(){
  const task = getNowTask();
  if(!task){
    els.nowTaskText.textContent = "Inget valt ännu.";
    els.nowStepText.classList.add("hidden");
    els.nowProgressWrap.classList.add("hidden");
    els.doneNowBtn.disabled = true;
    els.skipNowBtn.disabled = true;
    els.nextStepBtn.classList.add("hidden");
    return;
  }

  els.nowTaskText.textContent = task.text;
  els.doneNowBtn.disabled = false;
  els.skipNowBtn.disabled = false;

  if(task.steps && task.steps.length){
    const idx = Math.min(task.currentStep || 0, task.steps.length - 1);
    els.nowStepText.textContent = "Nästa lilla steg: " + task.steps[idx];
    els.nowStepText.classList.remove("hidden");
    els.nowProgressWrap.classList.remove("hidden");
    els.nowProgressBar.style.width = `${Math.round((idx / task.steps.length) * 100)}%`;
    els.nowProgressLabel.textContent = `Steg ${idx + 1} av ${task.steps.length}`;
    els.nextStepBtn.classList.remove("hidden");
    els.nextStepBtn.disabled = false;
    els.doneNowBtn.textContent = "✓ Hela klar";
  }else{
    els.nowStepText.classList.add("hidden");
    els.nowProgressWrap.classList.add("hidden");
    els.nextStepBtn.classList.add("hidden");
    els.doneNowBtn.textContent = "✓ Klar";
  }
}

function renderTaskList(container, tasks){
  container.innerHTML = "";
  for(const task of tasks){
    const node = document.querySelector("#taskTemplate").content.cloneNode(true);
    node.querySelector(".task-text").textContent = task.text;
    node.querySelector(".task-meta").textContent = [task.date === todayISO() ? "Idag" : task.date, task.time].filter(Boolean).join(" • ");
    const stepsMeta = node.querySelector(".task-steps-meta");
    if(task.steps?.length) stepsMeta.textContent = `${task.steps.length} små steg`;

    node.querySelector(".check-btn").addEventListener("click", () => completeTask(task.id));
    node.querySelector(".task-open").addEventListener("click", () => {
      state.nowTaskId = task.id;
      saveState();
      window.scrollTo({top:0, behavior:prefs.reduceMotion ? "auto" : "smooth"});
    });
    node.querySelector(".more-btn").addEventListener("click", () => openEditTask(task));
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

    const titleRow = document.createElement("div");
    titleRow.className = "routine-title-row";
    const title = document.createElement("h3");
    title.textContent = routine.name;
    const doneCount = routine.steps.filter(s => s.done).length;
    const progress = document.createElement("span");
    progress.className = "routine-progress";
    progress.textContent = `${doneCount}/${routine.steps.length}`;
    titleRow.append(title, progress);
    card.appendChild(titleRow);

    routine.steps.forEach(step => {
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

    const actions = document.createElement("div");
    actions.className = "routine-actions";

    const reset = document.createElement("button");
    reset.className = "small-btn";
    reset.textContent = "Börja om";
    reset.addEventListener("click", () => {
      routine.steps.forEach(s => s.done = false);
      saveState();
    });

    const useNow = document.createElement("button");
    useNow.className = "small-btn";
    useNow.textContent = "Gör nu";
    useNow.addEventListener("click", () => {
      const task = {
        id: crypto.randomUUID(),
        text: routine.name,
        date: todayISO(),
        time:"",
        status:"open",
        inbox:false,
        priority:"normal",
        steps:routine.steps.map(s => s.text),
        currentStep:0
      };
      state.tasks.push(task);
      state.nowTaskId = task.id;
      saveState();
      window.scrollTo({top:0, behavior:prefs.reduceMotion ? "auto" : "smooth"});
    });

    actions.append(useNow, reset);
    card.appendChild(actions);
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

function setWhen(when){
  selectedWhen = when;
  document.querySelectorAll(".choice-chip").forEach(b => b.classList.toggle("active", b.dataset.when === when));
  if(when === "today"){
    els.quickDate.value = todayISO();
    els.dateTimeArea.classList.remove("hidden");
  }else if(when === "now"){
    els.quickDate.value = todayISO();
    els.quickTime.value = "";
    els.dateTimeArea.classList.add("hidden");
  }else{
    els.quickDate.value = "";
    els.quickTime.value = "";
    els.dateTimeArea.classList.add("hidden");
  }
}

function openQuick(when="later"){
  els.quickText.value = "";
  els.quickSteps.value = "";
  setWhen(when);
  els.quickDialog.showModal();
  setTimeout(() => els.quickText.focus(), 50);
}

document.querySelector("#quickAddBtn").addEventListener("click", () => openQuick("later"));
document.querySelector("#addInboxBtn").addEventListener("click", () => openQuick("later"));
document.querySelectorAll(".capture-choice").forEach(btn => btn.addEventListener("click", () => openQuick(btn.dataset.capture)));
document.querySelectorAll(".choice-chip").forEach(btn => btn.addEventListener("click", () => setWhen(btn.dataset.when)));

document.querySelector("#quickForm").addEventListener("submit", (e) => {
  if(e.submitter?.value === "cancel") return;
  e.preventDefault();
  const text = els.quickText.value.trim();
  if(!text) return;
  const steps = els.quickSteps.value.split("\n").map(s => s.trim()).filter(Boolean);
  const date = selectedWhen === "later" ? "" : (els.quickDate.value || todayISO());
  const task = {
    id: crypto.randomUUID(),
    text,
    date,
    time: els.quickTime.value,
    status:"open",
    inbox:selectedWhen === "later",
    priority:"normal",
    steps,
    currentStep:0
  };
  state.tasks.push(task);
  if(selectedWhen === "now") state.nowTaskId = task.id;
  saveState();
  els.quickDialog.close();
});

function openEditTask(task){
  els.editTaskId.value = task.id;
  els.editTaskText.value = task.text;
  els.editTaskDate.value = task.date || "";
  els.editTaskTime.value = task.time || "";
  els.editTaskSteps.value = (task.steps || []).join("\n");
  els.editTaskDialog.showModal();
}

document.querySelector("#editTaskForm").addEventListener("submit", (e) => {
  if(e.submitter?.value === "cancel") return;
  e.preventDefault();
  const task = state.tasks.find(t => t.id === els.editTaskId.value);
  if(!task) return;
  task.text = els.editTaskText.value.trim() || task.text;
  task.date = els.editTaskDate.value;
  task.time = els.editTaskTime.value;
  task.inbox = !task.date;
  task.steps = els.editTaskSteps.value.split("\n").map(s => s.trim()).filter(Boolean);
  task.currentStep = Math.min(task.currentStep || 0, Math.max(0, task.steps.length - 1));
  saveState();
  els.editTaskDialog.close();
});

document.querySelector("#deleteTaskBtn").addEventListener("click", () => {
  const id = els.editTaskId.value;
  state.tasks = state.tasks.filter(t => t.id !== id);
  if(state.nowTaskId === id) state.nowTaskId = null;
  saveState();
  els.editTaskDialog.close();
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

els.nextStepBtn.addEventListener("click", () => {
  const task = getNowTask();
  if(!task || !task.steps?.length) return;
  if((task.currentStep || 0) < task.steps.length - 1){
    task.currentStep = (task.currentStep || 0) + 1;
    saveState();
  }else{
    completeTask(task.id);
  }
});

els.skipNowBtn.addEventListener("click", () => {
  const openToday = getOpenToday();
  if(!openToday.length) return;
  const idx = Math.max(0, openToday.findIndex(t => t.id === state.nowTaskId));
  const next = openToday[(idx + 1) % openToday.length];
  state.nowTaskId = next.id;
  saveState();
});

document.querySelector("#focusBtn").addEventListener("click", () => {
  focusMode = !focusMode;
  document.body.classList.toggle("focus-mode", focusMode);
  document.querySelector("#focusBtn").textContent = focusMode ? "Avsluta fokus" : "Fokus";
});

document.querySelector("#sortTodayBtn").addEventListener("click", () => {
  sortEasyFirst = !sortEasyFirst;
  document.querySelector("#sortTodayBtn").textContent = sortEasyFirst ? "Tid först" : "Enklast först";
  render();
});

els.inboxSearch.addEventListener("input", render);

document.querySelector("#settingsBtn").addEventListener("click", () => {
  els.apiUrl.value = apiUrl;
  els.reduceMotion.checked = !!prefs.reduceMotion;
  els.largeText.checked = !!prefs.largeText;
  els.settingsDialog.showModal();
});

document.querySelector("#saveSettingsBtn").addEventListener("click", (e) => {
  e.preventDefault();
  apiUrl = els.apiUrl.value.trim();
  localStorage.setItem(API_KEY, apiUrl);
  prefs.reduceMotion = els.reduceMotion.checked;
  prefs.largeText = els.largeText.checked;
  savePrefs();
  els.settingsDialog.close();
  syncState();
});

const helpText = {
  start: "Välj inte hela uppgiften. Välj bara första lilla rörelsen. Om uppgiften har steg visar NU-rutan bara nästa steg.",
  overload: "Tryck på “Få ur huvudet”. Skriv en sak per rad eller skapa flera poster. Du behöver inte bestämma när allt ska göras.",
  lost: "Gå till NU. Om inget finns där, välj en uppgift under Idag och tryck på den. Bara en sak behöver vara aktiv.",
  forgot: "Skriv ner det lilla du minns i Kom ihåg. Du kan öppna och redigera det senare när mer kommer tillbaka."
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

applyPrefs();
render();
