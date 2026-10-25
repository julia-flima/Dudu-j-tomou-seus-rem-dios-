const MEDS_PADRAO = ["Mesacol MMX", "Duspatalin", "Revoc", "Doss"];

let meds = [...MEDS_PADRAO]; // lista que vale no dia visualizado
let medsPerm = [...MEDS_PADRAO]; // lista permanente (meds-lista)
let arquivados = []; // remédios que saíram da lista, mas cujo histórico continua salvo
let marcados = {}; // remédio -> horário em que foi marcado (ISO) ou true (registros antigos)
let editando = false;
let alarmes = [];
let configNotif = { inteligente: false };
let medsChipSelecionados = new Set();
let horariosInteligentes = {};
let abaAtiva = "remedios";

const img = (nome) => `img/${nome}.png`;
const $ = (id) => document.getElementById(id);
const ehAppTauri = () =>
  Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
const nomeAmbiente = () => (ehAppTauri() ? "app" : "navegador");

function dataDe(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

const chaveDe = (d) => `dia:${dataDe(d)}`;
const chaveLista = (d) => `lista:${dataDe(d)}`;
const hojeChave = () => chaveDe(new Date());

let diaAtual = hojeChave();
let diaSelecionado = diaAtual;
const vendoPassado = () => diaSelecionado !== diaAtual;

function dataDeChave(chave) {
  const [a, m, d] = chave.slice(4).split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0);
}

const store = {
  async get(k) {
    if (typeof window.storage !== "undefined") {
      try {
        const r = await window.storage.get(k);
        return r ? r.value : null;
      } catch {
        return null;
      }
    }
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  async set(k, v) {
    if (typeof window.storage !== "undefined") {
      try {
        await window.storage.set(k, v);
      } catch {}
      return;
    }
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

function lerJSON(raw, padrao) {
  if (!raw) return padrao;
  try {
    const val = JSON.parse(raw);
    return val ?? padrao;
  } catch {
    return padrao;
  }
}

function sanitizarListaMeds(val, padrao = []) {
  if (!Array.isArray(val)) return [...padrao];
  const vistos = new Set();
  const res = [];
  for (const item of val) {
    if (typeof item !== "string") continue;
    const nome = item.trim().slice(0, 40);
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (!vistos.has(chave)) {
      vistos.add(chave);
      res.push(nome);
    }
  }
  return res;
}

function sanitizarMarcados(val) {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const res = {};
  for (const [k, v] of Object.entries(val)) {
    const nome = k.trim();
    if (!nome) continue;
    if (v === true) {
      res[nome] = true;
    } else if (typeof v === "string" && !isNaN(new Date(v))) {
      res[nome] = v;
    }
  }
  return res;
}

const TIPOS_ALARME_VALIDOS = new Set(["alarme", "cheia", "notificacao"]);
const REGEX_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function sanitizarAlarmes(val) {
  if (!Array.isArray(val)) return [];
  const res = [];
  for (const item of val) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const hora =
      typeof item.hora === "string" && REGEX_HORA.test(item.hora)
        ? item.hora
        : "08:00";
    const tipo = TIPOS_ALARME_VALIDOS.has(item.tipo) ? item.tipo : "alarme";
    const medsAlarme = sanitizarListaMeds(item.meds, []);
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    res.push({
      id,
      hora,
      tipo,
      meds: medsAlarme,
      ativo: item.ativo !== false,
    });
  }
  return res.sort((a, b) => a.hora.localeCompare(b.hora));
}

function sanitizarConfigNotif(val) {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return { inteligente: false };
  }
  return { inteligente: Boolean(val.inteligente) };
}

// ---------- tema (claro / escuro / sistema) ----------
const MODOS_TEMA = ["sistema", "claro", "escuro"];
const ICONES_TEMA = { sistema: "🖥️", claro: "☀️", escuro: "🌙" };
const ROTULOS_TEMA = {
  sistema: "Tema do sistema",
  claro: "Tema claro",
  escuro: "Tema escuro",
};
let modoTema = "sistema";
try {
  const salvo = localStorage.getItem("tema");
  if (MODOS_TEMA.includes(salvo)) modoTema = salvo;
} catch {}
const midiaEscuro = window.matchMedia?.("(prefers-color-scheme: dark)");

function aplicarTema() {
  const escuro =
    modoTema === "escuro" || (modoTema === "sistema" && midiaEscuro?.matches);
  document.documentElement.dataset.tema = escuro ? "escuro" : "claro";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", escuro ? "#18161B" : "#F2A25C");
  const btn = $("btnTema");
  if (btn) {
    btn.textContent = `${ICONES_TEMA[modoTema]} ${ROTULOS_TEMA[modoTema]}`;
    btn.title = ROTULOS_TEMA[modoTema];
    btn.setAttribute(
      "aria-label",
      `${ROTULOS_TEMA[modoTema]} (toque para trocar)`,
    );
  }
}

midiaEscuro?.addEventListener?.("change", () => {
  if (modoTema === "sistema") aplicarTema();
});

$("btnTema").addEventListener("click", async () => {
  modoTema = MODOS_TEMA[(MODOS_TEMA.indexOf(modoTema) + 1) % MODOS_TEMA.length];
  aplicarTema();
  await store.set("tema", modoTema);
  mostrarToast(`${ICONES_TEMA[modoTema]} ${ROTULOS_TEMA[modoTema]} ativado`);
});
aplicarTema();

async function carregar(chaveDia) {
  esconderToast();
  const t = await store.get("tema");
  if (MODOS_TEMA.includes(t)) {
    modoTema = t;
    aplicarTema();
  }
  diaAtual = hojeChave();
  diaSelecionado = chaveDia || diaAtual;
  medsPerm = sanitizarListaMeds(
    lerJSON(await store.get("meds-lista"), null),
    MEDS_PADRAO,
  );
  arquivados = sanitizarListaMeds(
    lerJSON(await store.get("meds-arquivados"), null),
    [],
  ).filter((m) => !medsPerm.some((p) => p.toLowerCase() === m.toLowerCase()));
  alarmes = sanitizarAlarmes(lerJSON(await store.get("alarmes"), null));
  configNotif = sanitizarConfigNotif(
    lerJSON(await store.get("notif-config"), null),
  );
  if (medsChipSelecionados.size === 0) {
    medsPerm.forEach((m) => medsChipSelecionados.add(m));
  }
  if (vendoPassado()) {
    const listaSalva = lerJSON(
      await store.get(`lista:${diaSelecionado.slice(4)}`),
      null,
    );
    meds = Array.isArray(listaSalva)
      ? sanitizarListaMeds(listaSalva, medsPerm)
      : [...medsPerm];
  } else {
    meds = [...medsPerm];
    // guarda a lista do dia, para o histórico saber quantos remédios havia em cada dia
    await store.set(`lista:${diaAtual.slice(4)}`, JSON.stringify(meds));
  }
  marcados = sanitizarMarcados(lerJSON(await store.get(diaSelecionado), null));
  atualizarData();
  render();
  renderArquivados();
  renderHistorico();
  renderInfoBackup();
  await renderAbaAlarmes();
}

async function salvar() {
  await store.set("meds-lista", JSON.stringify(medsPerm));
  await store.set("meds-arquivados", JSON.stringify(arquivados));
  await store.set(diaSelecionado, JSON.stringify(marcados));
  await store.set(`lista:${diaSelecionado.slice(4)}`, JSON.stringify(meds));
  await store.set("alarmes", JSON.stringify(alarmes));
  await store.set("notif-config", JSON.stringify(configNotif));
  sincronizarNotificacoesSistema();
}

function atualizarData() {
  const d = dataDeChave(diaSelecionado);
  $("dataHoje").textContent = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const passado = vendoPassado();
  $("avisoPassado").hidden = !passado;
  if (passado) {
    $("textoPassado").textContent = `📅 Vendo ${d.toLocaleDateString("pt-BR")}`;
  }
}

$("btnVoltarHoje").addEventListener("click", () => carregar());

// se o app ficar aberto e virar o dia, começa a checklist do novo dia
function conferirVirada() {
  if (hojeChave() !== diaAtual) carregar();
  checarAlarmes();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) conferirVirada();
});
setInterval(conferirVirada, 20000);

function cena(bubu, shiba, clsShiba = "", clsBubu = "") {
  return (
    `<img class="bubu ${clsBubu}" src="${img(bubu)}" alt="Bubu">` +
    `<img class="shiba ${clsShiba}" src="${img(shiba)}" alt="Shiba">`
  );
}

function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

const fmtHora = (d) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ---------- diálogo de confirmação ----------
function confirmar(titulo, texto, sim = "Sim", nao = "Cancelar") {
  const dlg = $("dialogo");
  if (typeof dlg.showModal !== "function") {
    if (!nao) {
      alert(`${titulo}\n\n${texto}`);
      return Promise.resolve(true);
    }
    return Promise.resolve(confirm(`${titulo}\n\n${texto}`));
  }
  $("dialogoTitulo").textContent = titulo;
  $("dialogoTexto").textContent = texto;
  $("dialogoSim").textContent = sim;
  const btnNao = $("dialogoNao");
  btnNao.textContent = nao || "";
  btnNao.hidden = !nao;
  dlg.returnValue = "";
  dlg.showModal();
  return new Promise((res) =>
    dlg.addEventListener("close", () => res(dlg.returnValue === "sim"), {
      once: true,
    }),
  );
}

const avisar = (titulo, texto) => confirmar(titulo, texto, "Ok", null);

function confirmarDiaPassado(acao) {
  const dataFmt = dataDeChave(diaSelecionado).toLocaleDateString("pt-BR");
  return confirmar(
    "Alterar dia anterior?",
    `Você está vendo o dia ${dataFmt}. Tem certeza que quer ${acao} neste dia?`,
    "Sim, alterar",
  );
}

// ---------- toast de aviso / desfazer ----------
let timerToast = null;
let timerSairToast = null;
let acaoDesfazer = null;

function esconderToast(imediato = false) {
  clearTimeout(timerToast);
  clearTimeout(timerSairToast);
  timerToast = null;
  timerSairToast = null;
  acaoDesfazer = null;
  const toast = $("toast");
  if (imediato || toast.hidden) {
    toast.classList.remove("saindo");
    toast.hidden = true;
    return;
  }
  toast.classList.add("saindo");
  timerSairToast = setTimeout(() => {
    toast.classList.remove("saindo");
    toast.hidden = true;
  }, 220);
}

function mostrarToast(texto, desfazer = null) {
  clearTimeout(timerToast);
  clearTimeout(timerSairToast);
  acaoDesfazer = desfazer;
  const toast = $("toast");
  $("toastTexto").textContent = texto;
  $("btnDesfazer").hidden = !desfazer;
  toast.classList.remove("saindo");
  toast.hidden = false;
  toast.style.animation = "none";
  void toast.offsetWidth;
  toast.style.animation = "";
  timerToast = setTimeout(() => esconderToast(), 4500);
}

$("btnDesfazer").addEventListener("click", () => {
  const fn = acaoDesfazer;
  esconderToast(true);
  if (fn) fn();
});

// ---------- lista do dia ----------
let medAnimando = null;

function render() {
  const lista = $("lista");
  lista.innerHTML = "";
  lista.classList.toggle("editando", editando);
  $("acoesEdicao").hidden = !editando;

  meds.forEach((m, i) => {
    const v = marcados[m];
    const ok = Boolean(v);
    const animando = medAnimando === m;
    const div = el(
      "div",
      `med${ok ? " ok" : ""}${animando ? " animando-ok" : ""}`,
    );
    div.dataset.med = m;
    div.tabIndex = 0;
    if (editando) {
      div.setAttribute("role", "listitem");
    } else {
      div.setAttribute("role", "checkbox");
      div.setAttribute("aria-checked", ok);
    }

    div.appendChild(el("div", "check", "✓"));
    const info = el("div", "info");
    info.appendChild(el("div", "nome", m));
    if (typeof v === "string") {
      const h = new Date(v);
      if (!isNaN(h)) {
        const madrugada = h.getHours() < 4;
        const hora = el(
          "div",
          `hora${madrugada ? " madrugada" : ""}`,
          `tomado às ${fmtHora(h)}${madrugada ? " 🌙" : ""}`,
        );
        if (madrugada)
          hora.title =
            "Marcado de madrugada. Era pra ter sido no dia anterior?";
        info.appendChild(hora);
      }
    }
    div.appendChild(info);

    const mini = el("img", "mini");
    mini.src = img("shiba_sentado");
    mini.alt = "";
    div.appendChild(mini);

    const tirar = el("button", "tirar", "✕");
    tirar.type = "button";
    tirar.setAttribute("aria-label", `Tirar ${m} da lista`);
    div.appendChild(tirar);

    const alca = el("div", "alca", "⠿");
    alca.setAttribute("aria-hidden", "true");
    div.appendChild(alca);

    div.addEventListener("click", async (e) => {
      if (ignorarClique) {
        ignorarClique = false;
        return;
      }
      if (e.target.closest(".tirar")) {
        removerMed(m);
        return;
      }
      if (editando) return;
      const anterior = marcados[m];
      if (vendoPassado()) {
        const confirma = await confirmarDiaPassado(
          `${anterior ? "desmarcar" : "marcar"} "${m}"`,
        );
        if (!confirma) return;
      }
      if (anterior) {
        delete marcados[m];
        medAnimando = null;
      } else {
        marcados[m] = vendoPassado() ? true : new Date().toISOString();
        medAnimando = m;
      }
      salvar().then(renderHistorico);
      render();
      medAnimando = null;
      mostrarToast(anterior ? `${m} desmarcado` : `${m} marcado`, () => {
        if (anterior) {
          marcados[m] = anterior;
          medAnimando = m;
        } else {
          delete marcados[m];
          medAnimando = null;
        }
        salvar().then(renderHistorico);
        render();
        medAnimando = null;
      });
      const novo = document.querySelectorAll("#lista .med")[i];
      if (novo && document.activeElement === document.body)
        novo.focus({ preventScroll: true });
    });

    div.addEventListener("keydown", (e) => {
      if (e.target !== div) return;
      if (e.key === "Escape" && editando) {
        editando = false;
        render();
        return;
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        moverMed(i, e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        div.click();
      }
    });

    div.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      prepararArrasto(div, e, Boolean(e.target.closest(".alca")));
    });

    div.addEventListener("contextmenu", (e) => e.preventDefault());
    lista.appendChild(div);
  });

  const total = meds.length;
  const feitos = meds.filter((m) => marcados[m]).length;
  $("barra").style.width = total ? `${(feitos / total) * 100}%` : "0%";

  const palco = $("palco");
  const desenho = $("desenho");
  const humor = $("humor");
  palco.classList.remove("completo");

  if (total > 0 && feitos === total) {
    palco.classList.add("completo");
    desenho.innerHTML = cena(
      "bubu_comemorando",
      "shiba_lingua",
      "pulando",
      "pulando",
    );
    humor.textContent = "Todos os remédios tomados! 🎉";
  } else if (feitos === 0) {
    desenho.innerHTML = cena("bubu_triste", "shiba_sentado_triste");
    humor.textContent = "A Bubu e o shiba estão esperando os remédios... 🥺";
  } else if (feitos === 1) {
    desenho.innerHTML = cena("bubu_neutra", "shiba_deitado");
    humor.textContent = `Boa, Dudu! ${feitos} de ${total}. O shiba levantou a orelha! 🐾`;
  } else {
    desenho.innerHTML = cena("bubu_feliz", "shiba_rindo", "", "balancando");
    humor.textContent = `Quase lá! ${feitos} de ${total}. A Bubu já tá sorrindo! 💪`;
  }
}

// ---------- editar a lista permanente ----------
async function removerMed(m) {
  const textoAviso = vendoPassado()
    ? `Você está vendo o dia ${dataDeChave(diaSelecionado).toLocaleDateString("pt-BR")}. "${m}" vai sair deste dia e também da lista permanente para "Remédios guardados" (com histórico salvo).`
    : 'Ele vai para "Remédios guardados". O histórico continua salvo e dá pra trazer de volta quando quiser.';
  const ok = await confirmar(`Tirar "${m}" da lista?`, textoAviso, "Tirar");
  if (!ok) return;
  meds = meds.filter((x) => x !== m);
  medsPerm = medsPerm.filter((x) => x !== m);
  if (!arquivados.includes(m)) arquivados.push(m);
  await salvar();
  render();
  renderArquivados();
  renderHistorico();
}

async function restaurarMed(m) {
  if (vendoPassado()) {
    const ok = await confirmarDiaPassado(`voltar "${m}" para a lista`);
    if (!ok) return;
  }
  arquivados = arquivados.filter((x) => x !== m);
  if (!meds.includes(m)) meds.push(m);
  if (!medsPerm.includes(m)) medsPerm.push(m);
  await salvar();
  render();
  renderArquivados();
  renderHistorico();
}

function renderArquivados() {
  const cont = $("listaArquivados");
  cont.innerHTML = "";
  arquivados.forEach((m) => {
    const linha = el("div", "guardado");
    linha.appendChild(el("span", "", m));
    const b = el("button", "botao-sec", "↩ Voltar pra lista");
    b.setAttribute("aria-label", `Voltar ${m} pra lista`);
    b.addEventListener("click", () => restaurarMed(m));
    linha.appendChild(b);
    cont.appendChild(linha);
  });
  $("arquivados").hidden = arquivados.length === 0;
}

function sincronizarOrdemPerm() {
  if (!vendoPassado()) {
    medsPerm = [...meds];
    return;
  }
  const setDia = new Set(meds);
  const presentes = meds.filter((m) => medsPerm.includes(m));
  let idx = 0;
  medsPerm = medsPerm.map((m) => (setDia.has(m) ? presentes[idx++] : m));
}

async function moverMed(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= meds.length) return;
  if (vendoPassado()) {
    const ok = await confirmarDiaPassado("reordenar a lista");
    if (!ok) return;
  }
  [meds[i], meds[j]] = [meds[j], meds[i]];
  sincronizarOrdemPerm();
  await salvar();
  render();
  document.querySelectorAll("#lista .med")[j]?.focus();
}

// ---------- segurar e arrastar para reordenar ----------
let pre = null;
let drag = null;
let ignorarClique = false;

function cancelarPre() {
  if (pre) {
    clearTimeout(pre.timer);
    pre = null;
  }
}

function prepararArrasto(div, e, imediato) {
  cancelarPre();
  if (drag) return;
  pre = { el: div, id: e.pointerId, x: e.clientX, y: e.clientY, timer: null };
  if (imediato) iniciarArrasto();
  else pre.timer = setTimeout(iniciarArrasto, editando ? 120 : 450);
}

function iniciarArrasto() {
  if (!pre) return;
  const { el: div, id, y } = pre;
  pre = null;
  if (!editando) {
    editando = true;
    $("lista").classList.add("editando");
    $("acoesEdicao").hidden = false;
    document.querySelectorAll("#lista .med").forEach((item) => {
      item.setAttribute("role", "listitem");
      item.removeAttribute("aria-checked");
    });
  }
  drag = { el: div, id, inicioY: y, mudou: false };
  div.classList.add("arrastando");
  document.body.classList.add("arrastando");
  try {
    div.setPointerCapture(id);
  } catch {}
  try {
    navigator.vibrate?.(25);
  } catch {}
  div.style.transform = "scale(1.03)";
}

function moverArrasto(y) {
  const div = drag.el;
  const lista = div.parentNode;
  for (let n = 0; n < meds.length; n++) {
    const prev = div.previousElementSibling;
    const next = div.nextElementSibling;
    let antes = null;
    if (prev) {
      const r = prev.getBoundingClientRect();
      if (y < r.top + r.height / 2) antes = prev;
    }
    if (!antes && next) {
      const r = next.getBoundingClientRect();
      if (y > r.top + r.height / 2) antes = next.nextElementSibling || "fim";
    }
    if (!antes) break;
    const topoAntes = div.offsetTop;
    lista.insertBefore(div, antes === "fim" ? null : antes);
    drag.inicioY += div.offsetTop - topoAntes;
    drag.mudou = true;
  }
  div.style.transform = `translateY(${y - drag.inicioY}px) scale(1.03)`;
}

async function terminarArrasto(e) {
  if (pre && e.pointerId === pre.id) cancelarPre();
  if (!drag || e.pointerId !== drag.id) return;
  const div = drag.el;
  drag = null;
  div.classList.remove("arrastando");
  document.body.classList.remove("arrastando");
  div.style.transform = "";
  // o "clique" que vem logo depois de soltar não deve marcar o remédio
  ignorarClique = true;
  setTimeout(() => {
    ignorarClique = false;
  }, 350);
  const nova = [...document.querySelectorAll("#lista .med")].map(
    (d) => d.dataset.med,
  );
  if (nova.join("\n") !== meds.join("\n")) {
    if (vendoPassado()) {
      const ok = await confirmarDiaPassado("reordenar a lista");
      if (!ok) {
        render();
        return;
      }
    }
    meds = nova;
    sincronizarOrdemPerm();
    await salvar();
  }
  render();
}

document.addEventListener("pointermove", (e) => {
  if (pre && e.pointerId === pre.id) {
    if (Math.hypot(e.clientX - pre.x, e.clientY - pre.y) > 8) cancelarPre(); // é rolagem, não arrasto
    return;
  }
  if (drag && e.pointerId === drag.id) {
    e.preventDefault();
    moverArrasto(e.clientY);
  }
});
document.addEventListener("pointerup", terminarArrasto);
document.addEventListener("pointercancel", terminarArrasto);
document.addEventListener(
  "touchmove",
  (e) => {
    if (drag) e.preventDefault();
  },
  { passive: false },
);

// ---------- histórico ----------
async function renderHistorico() {
  const cont = $("dias");
  const hoje = new Date();
  const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  cont.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const ch = chaveDe(d);
    const dados =
      ch === diaSelecionado
        ? marcados
        : sanitizarMarcados(lerJSON(await store.get(ch), null));
    // lista de remédios que valia naquele dia (dias antigos sem registro usam a lista permanente)
    const listaDiaBruta =
      ch === diaSelecionado
        ? meds
        : i === 0
          ? medsPerm
          : lerJSON(await store.get(chaveLista(d)), null);
    const listaDia = Array.isArray(listaDiaBruta)
      ? sanitizarListaMeds(listaDiaBruta, [])
      : null;
    let total, feitos;
    if (Array.isArray(listaDia)) {
      total = listaDia.length;
      feitos = listaDia.filter((m) => dados[m]).length;
    } else {
      total = medsPerm.length;
      feitos = Math.min(
        total,
        Object.keys(dados).filter((k) => dados[k]).length,
      );
    }
    let cls, iconeSrc;
    if (total > 0 && feitos >= total) {
      cls = "completo";
      iconeSrc = img("bubu_comemorando");
    } else if (feitos > 0) {
      cls = "parcial";
      iconeSrc = img("bubu_feliz");
    } else {
      cls = "vazio";
      iconeSrc = img("shiba_sentado");
    }
    if (i === 0) cls += " hoje";
    if (ch === diaSelecionado) cls += " selecionado";
    const rot = i === 0 ? "hoje" : fmt.format(d).replace(".", "");
    const dataCurta = d.toLocaleDateString("pt-BR");
    const item = el("div", `dia ${cls}`);
    item.title = dataCurta;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute(
      "aria-label",
      `${rot} (${dataCurta}): ${feitos} de ${total} tomados`,
    );
    if (ch === diaSelecionado) item.setAttribute("aria-current", "date");
    const carinha = el("div", "carinha");
    const icone = el("img");
    icone.src = iconeSrc;
    icone.alt = "";
    carinha.appendChild(icone);
    item.appendChild(carinha);
    item.appendChild(el("div", "rotulo", rot));
    item.appendChild(el("div", "placar", `${feitos}/${total}`));
    item.addEventListener("click", () => {
      if (ch !== diaSelecionado) carregar(ch);
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        item.click();
      }
    });
    cont.appendChild(item);
  }
}

// ---------- backup ----------
const CHAVE_DADO =
  /^(dia:|lista:|meds-lista$|meds-arquivados$|alarmes$|notif-config$)/;

async function coletarDados() {
  const dados = {};
  if (typeof window.storage === "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (CHAVE_DADO.test(k)) dados[k] = localStorage.getItem(k);
      }
    } catch {}
    return dados;
  }
  for (const k of [
    "meds-lista",
    "meds-arquivados",
    "alarmes",
    "notif-config",
  ]) {
    const v = await store.get(k);
    if (v !== null) dados[k] = v;
  }
  const d = new Date();
  for (let i = 0; i < 730; i++) {
    for (const k of [chaveDe(d), chaveLista(d)]) {
      const v = await store.get(k);
      if (v !== null) dados[k] = v;
    }
    d.setDate(d.getDate() - 1);
  }
  return dados;
}

async function exportarBackup() {
  const dados = await coletarDados();
  const conteudo = JSON.stringify(
    {
      app: "dudu-remedios",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      dados,
    },
    null,
    1,
  );
  const nomeArquivo = `remedios-do-dudu-${dataDe(new Date())}.json`;
  const tauri = window.__TAURI__;
  if (tauri?.dialog && tauri?.fs) {
    // no aplicativo (Tauri), o WebView não faz downloads: pergunta onde salvar e grava o arquivo
    let destino = null;
    try {
      destino = await tauri.dialog.save({
        defaultPath: nomeArquivo,
        filters: [{ name: "Backup", extensions: ["json"] }],
      });
    } catch {
      destino = null; // no Android, cancelar o diálogo cai aqui
    }
    if (!destino) return;
    try {
      await tauri.fs.writeTextFile(destino, conteudo);
    } catch (e) {
      await avisar("Não deu pra salvar 🥺", String(e));
      return;
    }
  } else {
    const blob = new Blob([conteudo], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  await store.set("backup-ultimo", new Date().toISOString());
  renderInfoBackup();
}

async function importarBackup(arquivo) {
  let obj = null;
  try {
    obj = JSON.parse(await arquivo.text());
  } catch {}
  if (
    !obj ||
    obj.app !== "dudu-remedios" ||
    !obj.dados ||
    typeof obj.dados !== "object"
  ) {
    await avisar(
      "Arquivo inválido 🥺",
      'Esse arquivo não parece ser um backup do "Dudu já tomou seus remédios?".',
    );
    return;
  }
  const quando = obj.exportadoEm
    ? new Date(obj.exportadoEm).toLocaleDateString("pt-BR")
    : "data desconhecida";
  const ok = await confirmar(
    "Restaurar backup?",
    `Backup de ${quando}. A lista de remédios e os dias que estão no backup vão substituir os deste aparelho.`,
    "Restaurar",
  );
  if (!ok) return;
  for (const [k, v] of Object.entries(obj.dados)) {
    if (!CHAVE_DADO.test(k) || typeof v !== "string") continue;
    const val = lerJSON(v, null);
    if (val === null) continue;
    let limpo = null;
    if (k === "meds-lista") {
      limpo = sanitizarListaMeds(val, MEDS_PADRAO);
    } else if (k === "meds-arquivados" || k.startsWith("lista:")) {
      limpo = sanitizarListaMeds(val, []);
    } else if (k.startsWith("dia:")) {
      limpo = sanitizarMarcados(val);
    } else if (k === "alarmes") {
      limpo = sanitizarAlarmes(val);
    } else if (k === "notif-config") {
      limpo = sanitizarConfigNotif(val);
    }
    if (limpo !== null) {
      await store.set(k, JSON.stringify(limpo));
    }
  }
  await carregar();
  await avisar(
    "Backup restaurado! 🎉",
    "A Bubu e o shiba já recuperaram tudo.",
  );
}

async function renderInfoBackup() {
  const txtBackup = $("textoBackup");
  if (txtBackup) {
    const amb = nomeAmbiente();
    txtBackup.textContent = `Os dados ficam só neste ${amb}. Se você limpar os dados do ${amb}, eles somem, então salve um backup antes e restaure depois!`;
  }
  const ultimo = await store.get("backup-ultimo");
  $("infoBackup").textContent = ultimo
    ? `Último backup salvo em ${new Date(ultimo).toLocaleDateString("pt-BR")}`
    : "Nenhum backup salvo ainda neste aparelho.";
}

$("btnExportar").addEventListener("click", exportarBackup);
$("arqBackup").addEventListener("change", async (e) => {
  const arq = e.target.files?.[0];
  e.target.value = "";
  if (arq) await importarBackup(arq);
});
$("lblImportar").addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    $("arqBackup").click();
  }
});

// ---------- adicionar / editar ----------
$("btnAdd").addEventListener("click", async () => {
  const inp = $("novoMed");
  const nome = inp.value.trim();
  if (!nome) return;
  inp.value = "";
  if (meds.some((m) => m.toLowerCase() === nome.toLowerCase())) return;
  // se o remédio estava guardado, traz de volta com o mesmo nome (e o mesmo histórico)
  const guardado = arquivados.find(
    (m) => m.toLowerCase() === nome.toLowerCase(),
  );
  if (guardado) {
    await restaurarMed(guardado);
    return;
  }
  if (vendoPassado()) {
    const ok = await confirmarDiaPassado(`adicionar "${nome}" na lista`);
    if (!ok) return;
  }
  meds.push(nome);
  if (!medsPerm.some((m) => m.toLowerCase() === nome.toLowerCase()))
    medsPerm.push(nome);
  medsChipSelecionados.add(nome);
  await salvar();
  renderHistorico();
  render();
  renderAbaAlarmes();
});

$("novoMed").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btnAdd").click();
});
$("btnPronto").addEventListener("click", () => {
  editando = false;
  render();
});
document.addEventListener("pointerdown", (e) => {
  if (!editando || drag || pre) return;
  if (e.target.closest("#lista, #acoesEdicao, .add, #arquivados, dialog"))
    return;
  editando = false;
  render();
});

// ---------- abas, gestos de deslizar e barra flutuante ----------
function trocarAba(nova) {
  if (nova !== "remedios" && nova !== "alarmes") return;
  abaAtiva = nova;
  if (nova === "remedios" && editando) {
    // mantém estado se já estava
  } else if (nova !== "remedios" && editando) {
    editando = false;
    render();
  }
  const trilho = $("abasTrilho");
  trilho.classList.remove("arrastando-aba");
  trilho.style.transform = "";
  trilho.dataset.aba = nova;
  const secRem = $("abaRemedios");
  const secAla = $("abaAlarmes");
  secRem.classList.toggle("ativa", nova === "remedios");
  secAla.classList.toggle("ativa", nova === "alarmes");
  secRem.inert = nova !== "remedios";
  secAla.inert = nova !== "alarmes";
  document.querySelectorAll(".aba-btn").forEach((btn) => {
    const ativa = btn.dataset.aba === nova;
    btn.classList.toggle("ativo", ativa);
    btn.setAttribute("aria-selected", ativa);
  });
  if (nova === "alarmes") renderAbaAlarmes();
}

document.querySelectorAll(".aba-btn").forEach((btn) => {
  btn.addEventListener("click", () => trocarAba(btn.dataset.aba));
});

let ultimoScrollY = window.scrollY;
window.addEventListener(
  "scroll",
  () => {
    const atual = window.scrollY;
    const delta = atual - ultimoScrollY;
    if (delta > 8 && atual > 48) {
      $("navAbas").classList.add("escondida");
    } else if (delta < -8 || atual <= 24) {
      $("navAbas").classList.remove("escondida");
    }
    ultimoScrollY = atual;
  },
  { passive: true },
);

let gestoAba = null;
document.addEventListener(
  "touchstart",
  (e) => {
    if (
      e.touches.length !== 1 ||
      drag ||
      pre ||
      editando ||
      !$("alarmeCheio").hidden
    )
      return;
    if (e.target.closest("input, select, dialog, .nav-abas")) return;
    const t = e.touches[0];
    gestoAba = {
      x0: t.clientX,
      y0: t.clientY,
      dx: 0,
      t0: Date.now(),
      ativo: false,
      bloqueado: false,
      largura: $("abasConteudo").clientWidth + 24,
    };
  },
  { passive: true },
);

document.addEventListener(
  "touchmove",
  (e) => {
    if (
      !gestoAba ||
      gestoAba.bloqueado ||
      e.touches.length !== 1 ||
      drag ||
      pre
    )
      return;
    const t = e.touches[0];
    const dx = t.clientX - gestoAba.x0;
    const dy = t.clientY - gestoAba.y0;
    if (!gestoAba.ativo) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        gestoAba.bloqueado = true;
        return;
      }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        gestoAba.ativo = true;
        $("abasTrilho").classList.add("arrastando-aba");
        if (abaAtiva === "remedios") renderAbaAlarmes();
      } else {
        return;
      }
    }
    e.preventDefault();
    const base = abaAtiva === "alarmes" ? -gestoAba.largura : 0;
    let offset = base + dx;
    if (offset > 0) offset *= 0.25;
    if (offset < -gestoAba.largura) {
      offset = -gestoAba.largura + (offset + gestoAba.largura) * 0.25;
    }
    gestoAba.dx = dx;
    $("abasTrilho").style.transform = `translateX(${offset}px)`;
  },
  { passive: false },
);

function finalizarGestoAba() {
  if (!gestoAba) return;
  const g = gestoAba;
  gestoAba = null;
  if (!g.ativo) return;
  const dt = Math.max(1, Date.now() - g.t0);
  const vel = g.dx / dt;
  const limiar = g.largura * 0.26;
  let destino = abaAtiva;
  if (abaAtiva === "remedios" && (g.dx < -limiar || vel < -0.35)) {
    destino = "alarmes";
  } else if (abaAtiva === "alarmes" && (g.dx > limiar || vel > 0.35)) {
    destino = "remedios";
  }
  trocarAba(destino);
}

document.addEventListener("touchend", finalizarGestoAba, { passive: true });
document.addEventListener("touchcancel", finalizarGestoAba, { passive: true });

// ---------- alarmes e lembretes inteligentes ----------
const ROTULO_TIPO_ALARME = {
  alarme: "🚨 Alarme (tela cheia + som)",
  cheia: "📱 Alerta em tela cheia",
  notificacao: "🔔 Notificação discreta",
};

const apiNotifTauri = () => window.__TAURI__?.notification || null;

let canaisNotifCriados = false;
async function garantirCanaisNotificacao() {
  const tn = apiNotifTauri();
  if (!tn?.createChannel || canaisNotifCriados) return;
  try {
    await tn.createChannel({
      id: "dudu-alarmes",
      name: "Alarmes de remédios",
      description: "Alertas importantes com som e vibração para tomar remédios",
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightsColor: "#F2A25C",
    });
    await tn.createChannel({
      id: "dudu-lembretes",
      name: "Lembretes discretos",
      description: "Notificações suaves para lembrar dos remédios",
      importance: 3,
      visibility: 1,
      vibration: true,
    });
    canaisNotifCriados = true;
  } catch {}
}

async function estadoPermissaoNotificacao() {
  const tn = apiNotifTauri();
  if (tn) {
    try {
      const res = await window.__TAURI_INTERNALS__?.invoke?.(
        "plugin:notification|is_permission_granted",
      );
      if (res === true) return "granted";
      if (res === false) {
        return window.Notification?.permission === "denied"
          ? "denied"
          : "default";
      }
      return "default";
    } catch {
      try {
        const ok = await tn.isPermissionGranted();
        return ok ? "granted" : "default";
      } catch {
        return "default";
      }
    }
  }
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function atualizarStatusPermissao() {
  const txt = $("statusPermissao");
  const btn = $("btnPermissao");
  const amb = nomeAmbiente();
  const perm = await estadoPermissaoNotificacao();
  if (perm === "unsupported") {
    txt.textContent = `Este ${amb} não suporta notificações do sistema, mas o alarme em tela cheia com som funciona com o app aberto!`;
    btn.hidden = true;
    return;
  }
  if (perm === "granted") {
    await garantirCanaisNotificacao();
    txt.textContent = ehAppTauri()
      ? "Notificações e alarmes do sistema ativos! A Bubu vai te chamar mesmo com o app em segundo plano. 💕"
      : "Notificações do sistema ativas! A Bubu vai te avisar nos horários combinados. 💕";
    btn.hidden = true;
  } else if (perm === "denied") {
    txt.textContent = `As notificações foram bloqueadas no ${amb}. Você ainda recebe alarmes em tela cheia com o app aberto.`;
    btn.hidden = true;
  } else {
    txt.textContent =
      "Ative as notificações para a Bubu te chamar na hora certa, além do alarme na tela!";
    btn.hidden = false;
  }
}

$("btnPermissao").addEventListener("click", async () => {
  const tn = apiNotifTauri();
  try {
    let res = "default";
    if (tn?.requestPermission) {
      res = await tn.requestPermission();
    } else if ("Notification" in window) {
      res = await Notification.requestPermission();
    }
    await atualizarStatusPermissao();
    if (res === "granted") {
      await sincronizarNotificacoesSistema();
      mostrarToast("🔔 Notificações ativadas!");
    }
  } catch {}
});

async function calcularHorariosInteligentes() {
  const hoje = new Date();
  const amostrasPorMed = {};
  for (let i = 0; i <= 14; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const ch = chaveDe(d);
    const reg =
      ch === diaSelecionado
        ? marcados
        : sanitizarMarcados(lerJSON(await store.get(ch), null));
    const peso = 0.85 ** i;
    for (const [med, val] of Object.entries(reg)) {
      if (typeof val !== "string") continue;
      const dt = new Date(val);
      if (isNaN(dt)) continue;
      let min = dt.getHours() * 60 + dt.getMinutes();
      // tomadas de madrugada contam como fim da noite para não distorcer a média
      if (min < 240) min += 1440;
      (amostrasPorMed[med] ??= []).push({ min, peso });
    }
  }
  const resultado = {};
  for (const m of medsPerm) {
    const lista = amostrasPorMed[m];
    if (!lista?.length) continue;
    const somaPesos = lista.reduce((s, x) => s + x.peso, 0);
    const media =
      Math.round(lista.reduce((s, x) => s + x.min * x.peso, 0) / somaPesos) %
      1440;
    const hh = String(Math.floor(media / 60)).padStart(2, "0");
    const mm = String(media % 60).padStart(2, "0");
    resultado[m] = `${hh}:${mm}`;
  }
  horariosInteligentes = resultado;
  return resultado;
}

async function renderAbaAlarmes() {
  await atualizarStatusPermissao();
  $("chkInteligente").checked = Boolean(configNotif.inteligente);

  const sugestoes = await calcularHorariosInteligentes();
  sincronizarNotificacoesSistema();
  const contSug = $("listaSugestoes");
  contSug.innerHTML = "";
  medsPerm.forEach((m) => {
    const item = el("div", "sugestao-item");
    item.appendChild(el("span", "", m));
    const h = sugestoes[m];
    item.appendChild(
      el(
        "span",
        "sugestao-hora",
        h ? `✨ Sugerido: ${h}` : "Sem histórico suficiente",
      ),
    );
    contSug.appendChild(item);
  });

  const contChips = $("chipsMedsAlarme");
  contChips.innerHTML = "";
  medsPerm.forEach((m) => {
    const ativo = medsChipSelecionados.has(m);
    const chip = el("button", `chip-med${ativo ? " ativo" : ""}`, m);
    chip.type = "button";
    chip.setAttribute("aria-pressed", ativo);
    chip.addEventListener("click", () => {
      if (medsChipSelecionados.has(m)) medsChipSelecionados.delete(m);
      else medsChipSelecionados.add(m);
      renderAbaAlarmes();
    });
    contChips.appendChild(chip);
  });

  const contAlarmes = $("listaAlarmes");
  contAlarmes.innerHTML = "";
  if (alarmes.length === 0) {
    contAlarmes.appendChild(
      el(
        "div",
        "dica",
        "Nenhum horário fixo agendado. Agende um acima ou use os lembretes inteligentes!",
      ),
    );
    return;
  }
  alarmes.forEach((al) => {
    const item = el("div", `alarme-item${al.ativo ? "" : " inativo"}`);
    const info = el("div", "alarme-info");
    info.appendChild(el("div", "alarme-hora", al.hora));
    const nomes = al.meds?.length ? al.meds.join(", ") : "Todos os remédios";
    info.appendChild(
      el(
        "div",
        "alarme-meta",
        `${ROTULO_TIPO_ALARME[al.tipo] || ROTULO_TIPO_ALARME.alarme} · ${nomes}`,
      ),
    );
    item.appendChild(info);

    const ctrl = el("div", "alarme-controles");
    const chk = el("input");
    chk.type = "checkbox";
    chk.checked = Boolean(al.ativo);
    chk.setAttribute("aria-label", `Ativar horário das ${al.hora}`);
    chk.addEventListener("change", async () => {
      al.ativo = chk.checked;
      await salvar();
      renderAbaAlarmes();
    });
    ctrl.appendChild(chk);

    const btnDel = el("button", "tirar", "✕");
    btnDel.type = "button";
    btnDel.setAttribute("aria-label", `Apagar horário das ${al.hora}`);
    btnDel.addEventListener("click", async () => {
      alarmes = alarmes.filter((x) => x.id !== al.id);
      await salvar();
      renderAbaAlarmes();
      mostrarToast("Horário removido");
    });
    ctrl.appendChild(btnDel);

    item.appendChild(ctrl);
    contAlarmes.appendChild(item);
  });
}

$("chkInteligente").addEventListener("change", async (e) => {
  configNotif.inteligente = e.target.checked;
  await salvar();
  mostrarToast(
    configNotif.inteligente
      ? "✨ Lembretes inteligentes ativados"
      : "Lembretes inteligentes desativados",
  );
});

$("horaAlarme").addEventListener("click", (e) => {
  try {
    e.currentTarget.showPicker?.();
  } catch {}
});

$("btnCriarAlarme").addEventListener("click", async () => {
  const hora = $("horaAlarme").value || "08:00";
  const tipo = $("tipoAlarme").value || "alarme";
  const escolhidos = medsPerm.filter((m) => medsChipSelecionados.has(m));
  if (escolhidos.length === 0) {
    mostrarToast("Escolha pelo menos um remédio!");
    return;
  }
  alarmes.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hora,
    tipo,
    meds: escolhidos,
    ativo: true,
  });
  alarmes.sort((a, b) => a.hora.localeCompare(b.hora));
  await salvar();
  renderAbaAlarmes();
  mostrarToast(
    tipo === "notificacao"
      ? `🔔 Notificação agendada para ${hora}`
      : `⏰ Alarme agendado para ${hora}`,
  );
});

// ---------- agendamento nativo (Tauri), som de alarme e disparo ----------
let timerSomAlarme = null;
let ctxAudio = null;
let medsAlarmeAtual = [];
let sonecas = [];
const disparosHoje = new Set();

function hashIdNotif(chave) {
  let h = 2166136261;
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h & 0x3fffffff || 1;
}

async function sincronizarNotificacoesSistema() {
  const tn = apiNotifTauri();
  if (!tn?.cancelAll || !tn?.Schedule) return;
  try {
    const perm = await estadoPermissaoNotificacao();
    if (perm !== "granted") return;
    await garantirCanaisNotificacao();
    await tn.cancelAll();

    const ehHoje = diaSelecionado === hojeChave();
    const agendamentos = [];

    for (const al of alarmes) {
      if (!al.ativo) continue;
      const [hh, mm] = (al.hora || "08:00").split(":").map(Number);
      if (isNaN(hh) || isNaN(mm)) continue;
      const listaMeds = al.meds?.length ? al.meds : medsPerm;
      const pendentes = ehHoje
        ? listaMeds.filter((m) => !marcados[m])
        : listaMeds;
      const nomes = (pendentes.length > 0 ? pendentes : listaMeds).join(", ");
      if (!nomes) continue;
      agendamentos.push({
        id: hashIdNotif(`al:${al.id}`),
        title: "Hora do remédio, Dudu! 💊",
        body: `Hora de tomar ${nomes}!`,
        channelId:
          al.tipo === "notificacao" ? "dudu-lembretes" : "dudu-alarmes",
        schedule: tn.Schedule.interval({ hour: hh, minute: mm }, true),
        autoCancel: true,
        extra: { meds: listaMeds, tipo: al.tipo },
      });
    }

    if (configNotif.inteligente) {
      for (const [med, hSug] of Object.entries(horariosInteligentes)) {
        const [hh, mm] = hSug.split(":").map(Number);
        if (isNaN(hh) || isNaN(mm)) continue;
        agendamentos.push({
          id: hashIdNotif(`int:${med}`),
          title: "✨ Lembrete inteligente da Bubu! 💊",
          body: `Hora de tomar ${med}!`,
          channelId: "dudu-alarmes",
          schedule: tn.Schedule.interval({ hour: hh, minute: mm }, true),
          autoCancel: true,
          extra: {
            meds: [med],
            tipo: "alarme",
            origem: "✨ Lembrete inteligente",
          },
        });
      }
    }

    for (const item of agendamentos) {
      try {
        await window.__TAURI_INTERNALS__?.invoke?.(
          "plugin:notification|notify",
          { options: item },
        );
      } catch {}
    }
  } catch {}
}

function tocarBipeCarinhoso() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctxAudio) ctxAudio = new AudioCtx();
    if (ctxAudio.state === "suspended") ctxAudio.resume();
    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((freq, idx) => {
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const inicio = ctxAudio.currentTime + idx * 0.14;
      gain.gain.setValueAtTime(0.001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.18, inicio + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.28);
      osc.connect(gain);
      gain.connect(ctxAudio.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.3);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

function pararSomAlarme() {
  clearInterval(timerSomAlarme);
  timerSomAlarme = null;
}

async function enviarNotificacaoSistema(titulo, corpo, tipo = "alarme") {
  const perm = await estadoPermissaoNotificacao();
  if (perm !== "granted") return;
  const tn = apiNotifTauri();
  if (tn) {
    try {
      await garantirCanaisNotificacao();
      await window.__TAURI_INTERNALS__?.invoke?.("plugin:notification|notify", {
        options: {
          id: hashIdNotif(`now:${titulo}:${Date.now()}`),
          title: titulo,
          body: corpo,
          channelId: tipo === "notificacao" ? "dudu-lembretes" : "dudu-alarmes",
          autoCancel: true,
        },
      });
      return;
    } catch {}
  }
  if (!("Notification" in window)) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(titulo, {
        body: corpo,
        icon: "icon-192.png",
        badge: "icon-192.png",
        tag: "dudu-alarme",
        renotify: true,
        requireInteraction: tipo !== "notificacao",
        vibrate: tipo === "notificacao" ? [150] : [250, 100, 250, 100, 300],
      });
      return;
    }
    new Notification(titulo, { body: corpo, icon: "icon-192.png" });
  } catch {}
}

let wakeLockAtivo = null;
async function gerenciarWakeLock(ativar) {
  if (!("wakeLock" in navigator)) return;
  try {
    if (ativar && !wakeLockAtivo) {
      wakeLockAtivo = await navigator.wakeLock.request("screen");
      wakeLockAtivo.addEventListener("release", () => {
        wakeLockAtivo = null;
      });
    } else if (!ativar && wakeLockAtivo) {
      await wakeLockAtivo.release();
      wakeLockAtivo = null;
    }
  } catch {}
}

function dispararAviso(
  medsAlvo,
  tipo = "alarme",
  origem = "",
  notificarSistema = true,
) {
  const pendentes = medsAlvo.filter((m) => !marcados[m]);
  const listaNomes = pendentes.length > 0 ? pendentes : medsAlvo;
  if (listaNomes.length === 0) return;
  const texto = `${origem ? `${origem}: ` : ""}Hora de tomar ${listaNomes.join(", ")}!`;
  if (notificarSistema) {
    enviarNotificacaoSistema("Hora do remédio, Dudu! 💊", texto, tipo);
  }

  if (tipo === "notificacao") {
    mostrarToast(`🔔 ${texto}`);
    return;
  }

  medsAlarmeAtual = listaNomes;
  $("alarmeTexto").textContent = texto;
  $("alarmeCheio").hidden = false;
  gerenciarWakeLock(true);
  pararSomAlarme();
  if (tipo === "alarme") {
    tocarBipeCarinhoso();
    timerSomAlarme = setInterval(tocarBipeCarinhoso, 3200);
  }
}

function fecharAlarmeCheio() {
  pararSomAlarme();
  gerenciarWakeLock(false);
  $("alarmeCheio").hidden = true;
  medsAlarmeAtual = [];
}

$("btnAlarmeFechar").addEventListener("click", fecharAlarmeCheio);

$("btnAlarmeSoneca").addEventListener("click", async () => {
  const copia = [...medsAlarmeAtual];
  fecharAlarmeCheio();
  const alvo = new Date(Date.now() + 10 * 60000);
  const hh = String(alvo.getHours()).padStart(2, "0");
  const mm = String(alvo.getMinutes()).padStart(2, "0");
  sonecas.push({ hora: `${hh}:${mm}`, meds: copia });
  const tn = apiNotifTauri();
  if (tn?.Schedule) {
    try {
      await garantirCanaisNotificacao();
      await window.__TAURI_INTERNALS__?.invoke?.("plugin:notification|notify", {
        options: {
          id: hashIdNotif(`soneca:${hh}:${mm}`),
          title: "💤 Soneca da Bubu! 💊",
          body: `Hora de tomar ${copia.join(", ")}!`,
          channelId: "dudu-alarmes",
          schedule: tn.Schedule.at(alvo, false, true),
          autoCancel: true,
          extra: { meds: copia, tipo: "alarme", origem: "💤 Soneca" },
        },
      });
    } catch {}
  }
  mostrarToast(`💤 Soneca ativada para ${hh}:${mm}`);
});

$("btnAlarmeTomar").addEventListener("click", async () => {
  const copia = [...medsAlarmeAtual];
  fecharAlarmeCheio();
  if (vendoPassado()) await carregar();
  const agora = new Date().toISOString();
  copia.forEach((m) => {
    if (!marcados[m]) {
      marcados[m] = agora;
      medAnimando = m;
    }
  });
  await salvar();
  render();
  renderHistorico();
  medAnimando = null;
  mostrarToast(`✅ ${copia.join(", ")} marcado!`);
});

$("btnTestarAlarme").addEventListener("click", () => {
  dispararAviso(
    medsPerm.length ? [medsPerm[0]] : ["Remédio"],
    "alarme",
    "Teste",
  );
});

function checarAlarmes() {
  const agora = new Date();
  const chHoje = hojeChave();
  const hh = String(agora.getHours()).padStart(2, "0");
  const mm = String(agora.getMinutes()).padStart(2, "0");
  const horaAtual = `${hh}:${mm}`;

  // se estiver vendo hoje, usa marcados em memória
  if (diaSelecionado !== chHoje) return;

  alarmes.forEach((al) => {
    if (!al.ativo || al.hora !== horaAtual) return;
    const chaveDisp = `${chHoje}:al:${al.id}:${horaAtual}`;
    if (disparosHoje.has(chaveDisp)) return;
    const pendentes = (al.meds || medsPerm).filter((m) => !marcados[m]);
    if (pendentes.length === 0) return;
    disparosHoje.add(chaveDisp);
    dispararAviso(pendentes, al.tipo);
  });

  if (configNotif.inteligente) {
    for (const [med, hSug] of Object.entries(horariosInteligentes)) {
      if (hSug !== horaAtual || marcados[med]) continue;
      const chaveDisp = `${chHoje}:int:${med}:${horaAtual}`;
      if (disparosHoje.has(chaveDisp)) continue;
      disparosHoje.add(chaveDisp);
      dispararAviso([med], "alarme", "✨ Lembrete inteligente");
    }
  }

  const restantes = [];
  for (const s of sonecas) {
    if (s.hora === horaAtual) {
      dispararAviso(s.meds, "alarme", "💤 Soneca");
    } else {
      restantes.push(s);
    }
  }
  sonecas = restantes;
}

function configurarEventosNotificacaoNativa() {
  const tn = apiNotifTauri();
  if (!tn) return;
  try {
    tn.onAction?.((ev) => {
      const extra = ev?.notification?.extra;
      const medsAlvo = Array.isArray(extra?.meds) ? extra.meds : medsPerm;
      const tipo = extra?.tipo || "alarme";
      const origem = extra?.origem || "";
      if (tipo !== "notificacao") {
        dispararAviso(medsAlvo, tipo, origem, false);
      }
    });
    tn.onNotificationReceived?.((notif) => {
      if (document.hidden) return;
      const extra = notif?.extra;
      const medsAlvo = Array.isArray(extra?.meds) ? extra.meds : medsPerm;
      const tipo = extra?.tipo || "alarme";
      const origem = extra?.origem || "";
      dispararAviso(medsAlvo, tipo, origem, false);
    });
  } catch {}
}

navigator.storage?.persist?.().catch(() => {});
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
configurarEventosNotificacaoNativa();
carregar();
