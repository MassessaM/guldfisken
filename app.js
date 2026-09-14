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
  quickReminder: document.querySelector("#quickReminder"),
  quickRecurrence: document.querySelector("#quickRecurrence"),
  quickCalendar: document.querySelector("#quickCalendar"),
  reminderHint: document.querySelector("#reminderHint"),
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
  editTaskSteps: document.querySelector("#editTaskSteps"),
  editTaskReminder: document.querySelector("#editTaskReminder"),
  editTaskRecurrence: document.querySelector("#editTaskRecurrence"),
  editTaskCalendar: document.querySelector("#editTaskCalendar"),
  notificationStatus: document.querySelector("#notificationStatus"),
  timerDisplay: document.querySelector("#timerDisplay"),
  timerLabel: document.querySelector("#timerLabel"),
  timerRingProgress: document.querySelector("#timerRingProgress"),
  timerStartBtn: document.querySelector("#timerStartBtn"),
  timerPauseBtn: document.querySelector("#timerPauseBtn"),
  timerResetBtn: document.querySelector("#timerResetBtn"),
  timerNotify: document.querySelector("#timerNotify"),
  weekList: document.querySelector("#weekList"),
  calendarEnabled: document.querySelector("#calendarEnabled"),
  leaveDialog: document.querySelector("#leaveDialog"),
  leaveChecklist: document.querySelector("#leaveChecklist"),
  syncStatus: document.querySelector("#syncStatus"),
  cloudStatus: document.querySelector("#cloudStatus"),
  iphoneDialog: document.querySelector("#iphoneDialog")
};

function defaultState(){
  return {
    tasks: [
      {id: crypto.randomUUID(), text:"Testa appen och lägg till en egen sak", date: todayISO(), time:"", status:"open", inbox:false, priority:"normal", steps:[], currentStep:0, reminder:false, reminderFired:false}
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
    currentStep: Number.isInteger(t.currentStep) ? t.currentStep : 0,
    reminder: !!t.reminder,
    reminderFired: !!t.reminderFired,
    recurrence: t.recurrence || "",
    calendar: !!t.calendar,
    calendarEventId: t.calendarEventId || ""
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
    return JSON.parse(localStorage.getItem(PREF_KEY)) || {reduceMotion:false, largeText:false, energy:"normal", calendarEnabled:false};
  }catch{
    return {reduceMotion:false, largeText:false, energy:"normal", calendarEnabled:false};
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
  setCloudStatus("busy");
  try{
    await fetch(apiUrl, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"sync", payload:state})
    });
    const stamp = new Date().toISOString();
    localStorage.setItem("min-hjalp-last-sync", stamp);
    setCloudStatus("ok");
    if(els.syncStatus) els.syncStatus.textContent = "Senast skickad till Google: " + new Date(stamp).toLocaleString("sv-SE");
  }catch(err){
    setCloudStatus("error");
    if(els.syncStatus) els.syncStatus.textContent = "Kunde inte synka. Datan finns kvar lokalt.";
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
  } else if(prefs.energy){
    tasks = tasks.sort((a,b) => energyScore(a) - energyScore(b) || (a.time||"99:99").localeCompare(b.time||"99:99"));
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

function renderEnergy(){
  document.querySelectorAll(".energy-chip").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.energy === (prefs.energy || "normal"));
  });
}

document.querySelectorAll(".energy-chip").forEach(btn => {
  btn.addEventListener("click", () => {
    prefs.energy = btn.dataset.energy;
    savePrefs();
    render();
  });
});

function energyScore(task){
  const steps = task.steps?.length || 0;
  if(prefs.energy === "low") return steps + (task.time ? 1 : 0);
  if(prefs.energy === "high") return -steps;
  return 0;
}

function renderWeek(){
  if(!els.weekList) return;
  els.weekList.innerHTML = "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {weekday:"long", day:"numeric", month:"short"});
  for(let i=0;i<7;i++){
    const d = new Date();
    d.setDate(d.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const dayTasks = state.tasks
      .filter(t => t.date === iso && t.status !== "done")
      .sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));

    const card = document.createElement("section");
    card.className = "week-day";
    const h = document.createElement("h3");
    h.textContent = i === 0 ? "Idag" : formatter.format(d);
    card.appendChild(h);

    if(!dayTasks.length){
      const p = document.createElement("p");
      p.className = "muted compact";
      p.textContent = "Inget planerat.";
      card.appendChild(p);
    }else{
      dayTasks.forEach(task => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "week-task task-open";
        const left = document.createElement("span");
        left.textContent = task.text;
        const right = document.createElement("span");
        right.className = "week-task-time";
        right.textContent = task.time || "";
        row.append(left,right);
        row.addEventListener("click", ()=>{
          state.nowTaskId = task.id;
          saveState();
          window.scrollTo({top:0, behavior:prefs.reduceMotion ? "auto":"smooth"});
        });
        card.appendChild(row);
      });
    }
    els.weekList.appendChild(card);
  }
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
  renderWeek();
  renderEnergy();
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
    const bits = [];
    if(task.steps?.length) bits.push(`${task.steps.length} små steg`);
    if(task.reminder) bits.push("🔔 påminnelse");
    stepsMeta.textContent = bits.join(" • ");

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

  if(task.recurrence){
    const next = nextOccurrence(task.date || todayISO(), task.recurrence);
    task.date = next;
    task.status = "open";
    task.currentStep = 0;
    task.reminderFired = false;
    if(task.calendar) syncCalendarTask(task);
  }else{
    task.status = "done";
    if(state.nowTaskId === id) state.nowTaskId = null;
  }
  saveState();
}

function nextOccurrence(dateStr, recurrence){
  const d = new Date(`${dateStr}T12:00:00`);
  if(recurrence === "daily"){
    d.setDate(d.getDate()+1);
  }else if(recurrence === "weekly"){
    d.setDate(d.getDate()+7);
  }else if(recurrence === "weekdays"){
    do{ d.setDate(d.getDate()+1); }while(d.getDay()===0 || d.getDay()===6);
  }
  return d.toISOString().slice(0,10);
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
        currentStep:0,
        reminder:false,
        reminderFired:false,
        recurrence:"",
        calendar:false,
        calendarEventId:""
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
  els.quickReminder.checked = false;
  els.quickRecurrence.value = "";
  els.quickCalendar.checked = !!prefs.calendarEnabled;
  els.reminderHint.classList.add("hidden");
  setWhen(when);
  els.quickDialog.showModal();
  setTimeout(() => els.quickText.focus(), 50);
}

document.querySelector("#quickAddBtn").addEventListener("click", () => openQuick("later"));
document.querySelector("#addInboxBtn").addEventListener("click", () => openQuick("later"));
document.querySelectorAll(".capture-choice").forEach(btn => btn.addEventListener("click", () => openQuick(btn.dataset.capture)));
document.querySelectorAll(".choice-chip").forEach(btn => btn.addEventListener("click", () => setWhen(btn.dataset.when)));

els.quickReminder.addEventListener("change", async () => {
  els.reminderHint.classList.toggle("hidden", !els.quickReminder.checked);
  if(els.quickReminder.checked) await requestNotificationPermission();
});

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
    currentStep:0,
    reminder: !!els.quickReminder.checked,
    reminderFired:false,
    recurrence: els.quickRecurrence.value,
    calendar: !!els.quickCalendar.checked,
    calendarEventId:""
  };
  state.tasks.push(task);
  if(selectedWhen === "now") state.nowTaskId = task.id;
  saveState();
  if(task.calendar) syncCalendarTask(task);
  els.quickDialog.close();
});

function openEditTask(task){
  els.editTaskId.value = task.id;
  els.editTaskText.value = task.text;
  els.editTaskDate.value = task.date || "";
  els.editTaskTime.value = task.time || "";
  els.editTaskSteps.value = (task.steps || []).join("\n");
  els.editTaskReminder.checked = !!task.reminder;
  els.editTaskRecurrence.value = task.recurrence || "";
  els.editTaskCalendar.checked = !!task.calendar;
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
  task.reminder = !!els.editTaskReminder.checked;
  if(!task.reminder) task.reminderFired = false;
  task.recurrence = els.editTaskRecurrence.value;
  task.calendar = !!els.editTaskCalendar.checked;
  saveState();
  if(task.calendar) syncCalendarTask(task);
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
  els.calendarEnabled.checked = !!prefs.calendarEnabled;
  if("Notification" in window){
    updateNotificationStatus(
      Notification.permission === "granted" ? "Notiser är tillåtna." :
      Notification.permission === "denied" ? "Notiser är blockerade." :
      "Notiser är inte aktiverade ännu."
    );
  }else{
    updateNotificationStatus("Notiser stöds inte av den här webbläsaren.");
  }
  const lastSync = localStorage.getItem("min-hjalp-last-sync");
  if(els.syncStatus && lastSync){
    els.syncStatus.textContent = "Senast synkad: " + new Date(lastSync).toLocaleString("sv-SE");
  }
  els.settingsDialog.showModal();
});

document.querySelector("#saveSettingsBtn").addEventListener("click", (e) => {
  e.preventDefault();
  apiUrl = els.apiUrl.value.trim();
  localStorage.setItem(API_KEY, apiUrl);
  prefs.reduceMotion = els.reduceMotion.checked;
  prefs.largeText = els.largeText.checked;
  prefs.calendarEnabled = els.calendarEnabled.checked;
  savePrefs();
  els.settingsDialog.close();
  syncState();
});

const helpText = {
  start: "Välj inte hela uppgiften. Välj bara första lilla rörelsen. Om uppgiften har steg visar NU-rutan bara nästa steg.",
  overload: "Tryck på “Få ur huvudet”. Skriv en sak per rad eller skapa flera poster. Du behöver inte bestämma när allt ska göras.",
  lost: "Gå till NU. Om inget finns där, välj en uppgift under Idag och tryck på den. Bara en sak behöver vara aktiv.",
  forgot: "Skriv ner det lilla du minns i Kom ihåg. Du kan öppna och redigera det senare när mer kommer tillbaka.",
  leave: "Öppna checklistan och gå igenom en sak i taget."
};

const leaveItems = ["Nycklar","Mobil","Plånbok / kort","Det jag ska ta med","Ytterkläder","Lås dörren"];
function renderLeaveChecklist(){
  els.leaveChecklist.innerHTML = "";
  const saved = JSON.parse(localStorage.getItem("min-hjalp-leave") || "{}");
  leaveItems.forEach((text,i)=>{
    const row = document.createElement("label");
    row.className = "leave-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!saved[i];
    cb.addEventListener("change", ()=>{
      saved[i] = cb.checked;
      localStorage.setItem("min-hjalp-leave", JSON.stringify(saved));
    });
    const span = document.createElement("span");
    span.textContent = text;
    row.append(cb,span);
    els.leaveChecklist.appendChild(row);
  });
}
document.querySelector("#resetLeaveBtn")?.addEventListener("click", ()=>{
  localStorage.removeItem("min-hjalp-leave");
  renderLeaveChecklist();
});
document.querySelectorAll(".help-card").forEach(btn => {
  btn.addEventListener("click", () => {
    if(btn.dataset.help === "leave"){
      renderLeaveChecklist();
      els.leaveDialog.showModal();
      return;
    }
    els.helpResponse.textContent = helpText[btn.dataset.help];
    els.helpResponse.classList.remove("hidden");
  });
});




function setCloudStatus(mode){
  if(!els.cloudStatus) return;
  els.cloudStatus.className = "cloud-status" + (mode ? " " + mode : "");
  els.cloudStatus.textContent = mode === "ok" ? "☁︎✓" : mode === "busy" ? "☁︎…" : "☁︎";
}

function pullStateFromGoogle(){
  return new Promise((resolve, reject) => {
    if(!apiUrl) return reject(new Error("Ingen backend-URL"));
    const callbackName = "__minHjalpState_" + Date.now();
    const script = document.createElement("script");
    const sep = apiUrl.includes("?") ? "&" : "?";
    const timeout = setTimeout(() => cleanup(new Error("Timeout")), 10000);

    function cleanup(err, data){
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if(err) reject(err); else resolve(data);
    }

    window[callbackName] = (data) => cleanup(null, data);
    script.onerror = () => cleanup(new Error("Kunde inte läsa Google-data"));
    script.src = `${apiUrl}${sep}action=state&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function syncNow(){
  if(!apiUrl){
    if(els.syncStatus) els.syncStatus.textContent = "Lägg först in din Apps Script Web App URL.";
    return;
  }
  setCloudStatus("busy");
  if(els.syncStatus) els.syncStatus.textContent = "Synkar…";
  try{
    const remote = await pullStateFromGoogle();
    if(remote?.ok && remote.state){
      const remoteTime = new Date(remote.state.updatedAt || 0).getTime();
      const localTime = new Date(state.updatedAt || 0).getTime();
      if(remoteTime > localTime){
        state = normalizeState(remote.state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
        if(els.syncStatus) els.syncStatus.textContent = "Hämtade nyare data från Google.";
      }else{
        await syncState();
        if(els.syncStatus) els.syncStatus.textContent = "Google är uppdaterat med den här enheten.";
      }
    }else{
      await syncState();
      if(els.syncStatus) els.syncStatus.textContent = "Skickade lokal data till Google.";
    }
    setCloudStatus("ok");
  }catch(err){
    console.warn(err);
    await syncState();
    if(els.syncStatus) els.syncStatus.textContent = "Kunde inte läsa tillbaka data, men skickade lokal backup.";
  }
}

document.querySelector("#syncNowBtn")?.addEventListener("click", syncNow);
document.querySelector("#installHelpBtn")?.addEventListener("click", () => els.iphoneDialog?.showModal());

async function syncCalendarTask(task){
  if(!apiUrl || !task.date || !task.time) return;
  try{
    await fetch(apiUrl, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"calendarUpsert", payload:task})
    });
  }catch(err){
    console.warn("Calendar-synk misslyckades.", err);
  }
}

async function requestNotificationPermission(){
  if(!("Notification" in window)){
    updateNotificationStatus("Notiser stöds inte av den här webbläsaren.");
    return false;
  }
  if(Notification.permission === "granted"){
    updateNotificationStatus("Notiser är tillåtna.");
    return true;
  }
  if(Notification.permission === "denied"){
    updateNotificationStatus("Notiser är blockerade i webbläsarens inställningar.");
    return false;
  }
  const result = await Notification.requestPermission();
  updateNotificationStatus(result === "granted" ? "Notiser är tillåtna." : "Notiser är inte tillåtna.");
  return result === "granted";
}

function updateNotificationStatus(text){
  if(els.notificationStatus) els.notificationStatus.textContent = text;
}

document.querySelector("#notificationPermissionBtn")?.addEventListener("click", requestNotificationPermission);

function maybeFireTaskReminders(){
  const now = new Date();
  let changed = false;
  state.tasks.forEach(task => {
    if(!task.reminder || task.reminderFired || task.status === "done" || !task.date || !task.time) return;
    const due = new Date(`${task.date}T${task.time}:00`);
    if(Number.isNaN(due.getTime())) return;
    const delta = now - due;
    if(delta >= 0 && delta < 5 * 60 * 1000){
      task.reminderFired = true;
      changed = true;
      if("Notification" in window && Notification.permission === "granted"){
        new Notification("Min hjälp", {body: task.text});
      }
    }
  });
  if(changed){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    syncState();
  }
}
setInterval(maybeFireTaskReminders, 30000);
window.addEventListener("focus", maybeFireTaskReminders);

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceBtn = document.querySelector("#voiceCaptureBtn");
if(!SpeechRecognitionCtor){
  if(voiceBtn) voiceBtn.title = "Röstinmatning stöds inte här. Använd mikrofonen i tangentbordet istället.";
}else if(voiceBtn){
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "sv-SE";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  voiceBtn.addEventListener("click", () => {
    try{
      voiceBtn.classList.add("listening");
      voiceBtn.textContent = "🎙️ Lyssnar…";
      recognition.start();
    }catch{}
  });

  recognition.addEventListener("result", event => {
    const text = event.results?.[0]?.[0]?.transcript?.trim();
    if(text){
      openQuick("later");
      els.quickText.value = text;
    }
  });

  recognition.addEventListener("end", () => {
    voiceBtn.classList.remove("listening");
    voiceBtn.textContent = "🎤 Säg det istället";
  });

  recognition.addEventListener("error", () => {
    voiceBtn.classList.remove("listening");
    voiceBtn.textContent = "🎤 Säg det istället";
  });
}

let timerTotal = 10 * 60;
let timerRemaining = timerTotal;
let timerInterval = null;
let timerRunning = false;
const circumference = 2 * Math.PI * 50;

function formatTimer(seconds){
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function renderTimer(){
  if(!els.timerDisplay) return;
  els.timerDisplay.textContent = formatTimer(timerRemaining);
  els.timerLabel.textContent = `${Math.round(timerTotal/60)} minuter`;
  const progress = timerTotal ? timerRemaining / timerTotal : 0;
  els.timerRingProgress.style.strokeDasharray = circumference;
  els.timerRingProgress.style.strokeDashoffset = circumference * (1 - progress);
  els.timerStartBtn.textContent = timerRunning ? "Pågår…" : (timerRemaining < timerTotal ? "Fortsätt" : "Starta");
  els.timerStartBtn.disabled = timerRunning;
  els.timerPauseBtn.disabled = !timerRunning;
}

function chooseTimer(minutes){
  clearInterval(timerInterval);
  timerRunning = false;
  timerTotal = minutes * 60;
  timerRemaining = timerTotal;
  document.querySelectorAll(".timer-preset").forEach(b => b.classList.toggle("active", Number(b.dataset.minutes) === minutes));
  renderTimer();
}

document.querySelectorAll(".timer-preset").forEach(btn => {
  btn.addEventListener("click", () => chooseTimer(Number(btn.dataset.minutes)));
});

els.timerStartBtn?.addEventListener("click", async () => {
  if(els.timerNotify.checked) await requestNotificationPermission();
  if(timerRemaining <= 0) timerRemaining = timerTotal;
  timerRunning = true;
  const expectedEnd = Date.now() + timerRemaining * 1000;
  timerInterval = setInterval(() => {
    timerRemaining = Math.max(0, Math.ceil((expectedEnd - Date.now()) / 1000));
    renderTimer();
    if(timerRemaining <= 0){
      clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
      renderTimer();
      if(els.timerNotify.checked && "Notification" in window && Notification.permission === "granted"){
        new Notification("Tiden är slut", {body:"Bra. Stanna upp och välj vad som är nästa lilla steg."});
      }
      if(navigator.vibrate) navigator.vibrate([200,120,200]);
    }
  }, 250);
  renderTimer();
});

els.timerPauseBtn?.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  renderTimer();
});

els.timerResetBtn?.addEventListener("click", () => chooseTimer(Math.round(timerTotal/60)));

renderTimer();
maybeFireTaskReminders();

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
}

applyPrefs();
render();
if(apiUrl){
  setTimeout(() => syncNow().catch(console.warn), 800);
}
