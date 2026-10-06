// ==========================================
// CONFIGURAÇÃO
// ==========================================

const setores = [
  "Equipe diretiva",
  "Logotipo",
  "Fachada",
  "Planta baixa",
  "Protótipo da maquete",
  "DP",
  "Marketing",
  "Vendas",
  "Fornecedores",
  "Manutenção / Almoxarifado",
  "Controle de qualidade",
];

// ==========================================
// DADOS
// ==========================================

let eventos = JSON.parse(localStorage.getItem("eventos")) || [];

eventos.forEach((evento, indice) => {
  if (evento.id === undefined || evento.id === null) {
    evento.id = Date.now() + indice;
  }
});

let notas = JSON.parse(localStorage.getItem("notas")) || {};

let setorAtual = null;

const supabaseConfiguracao = window.AGENDA_SUPABASE || {};
const supabaseUrl = (supabaseConfiguracao.url || "").replace(/\/+$/, "");
const supabaseChave = supabaseConfiguracao.anonKey || "";
const supabaseAtivo = Boolean(supabaseUrl && supabaseChave);

async function requisitarSupabase(caminho, opcoes = {}) {
  const resposta = await fetch(`${supabaseUrl}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: supabaseChave,
      Authorization: `Bearer ${supabaseChave}`,
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    },
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(detalhe || `Erro HTTP ${resposta.status}`);
  }

  const corpo = await resposta.text();

  return corpo ? JSON.parse(corpo) : null;
}

function eventoParaBanco(evento) {
  return {
    id: String(evento.id),
    titulo: evento.titulo,
    tipo: evento.tipo,
    data: evento.data,
    hora: evento.hora || null,
    setor: evento.setor,
    descricao: evento.descricao,
    autor: evento.autor || "Não informado",
  };
}

async function salvarEventoNoBanco(evento) {
  await requisitarSupabase("agenda_eventos?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(eventoParaBanco(evento)),
  });
}

async function salvarNotaNoBanco(setor, conteudo) {
  await requisitarSupabase("agenda_notas?on_conflict=setor", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ setor, conteudo }),
  });
}

async function carregarDadosCompartilhados() {
  const [eventosBanco, notasBanco] = await Promise.all([
    requisitarSupabase("agenda_eventos?select=*&order=data.asc"),
    requisitarSupabase("agenda_notas?select=setor,conteudo"),
  ]);

  const idsRemotos = new Set(eventosBanco.map((evento) => String(evento.id)));
  const eventosLocaisNovos = eventos.filter(
    (evento) => !idsRemotos.has(String(evento.id)),
  );

  await Promise.all(eventosLocaisNovos.map(salvarEventoNoBanco));

  const notasRemotas = Object.fromEntries(
    notasBanco.map((nota) => [nota.setor, nota.conteudo]),
  );
  const notasLocaisNovas = Object.entries(notas).filter(
    ([setor]) => !Object.prototype.hasOwnProperty.call(notasRemotas, setor),
  );

  await Promise.all(
    notasLocaisNovas.map(([setor, conteudo]) =>
      salvarNotaNoBanco(setor, conteudo),
    ),
  );

  eventos = [...eventosBanco, ...eventosLocaisNovos];
  notas = { ...Object.fromEntries(notasLocaisNovas), ...notasRemotas };
}

async function iniciarAgenda() {
  const status = document.getElementById("status-sincronizacao");

  if (!supabaseAtivo) {
    status.hidden = false;
    status.innerText =
      "Banco compartilhado não configurado. Por enquanto, os dados ficam apenas neste navegador.";
    atualizarTela();
    return;
  }

  status.hidden = false;
  status.innerText = "Conectando ao banco compartilhado...";

  try {
    await carregarDadosCompartilhados();
    status.hidden = true;
  } catch (erro) {
    status.innerText = `Falha ao conectar ao banco compartilhado: ${erro.message}`;
  }

  atualizarTela();
}

// ==========================================
// MENU
// ==========================================

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

document.getElementById("menuButton").addEventListener("click", abrirMenu);

document.getElementById("closeMenu").addEventListener("click", fecharMenu);

overlay.addEventListener("click", fecharMenu);

function abrirMenu() {
  sidebar.classList.add("ativo");

  overlay.classList.add("ativo");
}

function fecharMenu() {
  sidebar.classList.remove("ativo");

  overlay.classList.remove("ativo");
}

// ==========================================
// PÁGINAS
// ==========================================

function esconderPaginas() {
  document.querySelectorAll(".pagina").forEach((pagina) => {
    pagina.classList.add("escondida");
  });

  document.getElementById("pagina-inicio").style.display = "none";
}

function mostrarPagina(pagina) {
  fecharMenu();

  esconderPaginas();

  if (pagina === "inicio") {
    document.getElementById("pagina-inicio").style.display = "block";

    atualizarTela();

    return;
  }

  const elemento = document.getElementById("pagina-" + pagina);

  if (elemento) {
    elemento.classList.remove("escondida");
  }

  if (pagina === "calendario") {
    gerarCalendario();
  }

  if (pagina === "comunicados") {
    mostrarComunicados();
  }

  if (pagina === "reunioes") {
    mostrarReunioes();
  }
}

// ==========================================
// FORMULÁRIO
// ==========================================

function abrirFormulario() {
  document.getElementById("modal").classList.add("ativo");

  document.getElementById("titulo-modal").innerText = "➕ Novo comunicado";
}

function abrirFormularioReuniao() {
  abrirFormulario();

  document.getElementById("tipo").value = "reuniao";

  document.getElementById("titulo-modal").innerText = "📋 Nova reunião";
}

function fecharFormulario() {
  document.getElementById("modal").classList.remove("ativo");

  document.getElementById("formEvento").reset();
}

// ==========================================
// SALVAR EVENTO
// ==========================================

document
  .getElementById("formEvento")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const autor = document.getElementById("autor").value.trim();

    if (!autor) {
      alert("Informe seu nome para identificar a publicação.");
      document.getElementById("autor").focus();
      return;
    }

    const novoEvento = {
      id: String(Date.now()),

      autor,

      titulo: document.getElementById("titulo").value,

      tipo: document.getElementById("tipo").value,

      data: document.getElementById("data").value,

      hora: document.getElementById("hora").value,

      setor: document.getElementById("setor").value,

      descricao: document.getElementById("descricao").value,
    };

    try {
      if (supabaseAtivo) {
        await salvarEventoNoBanco(novoEvento);
      }

      eventos.push(novoEvento);
      salvarEventos();
    } catch (erro) {
      alert(`Não foi possível publicar: ${erro.message}`);
      return;
    }

    fecharFormulario();

    atualizarTela();

    alert("Publicado com sucesso! 📢");
  });

// ==========================================
// SALVAR EVENTOS
// ==========================================

function salvarEventos() {
  if (!supabaseAtivo) {
    localStorage.setItem("eventos", JSON.stringify(eventos));
  }
}

async function removerEvento(id) {
  const evento = eventos.find((item) => String(item.id) === id);

  if (!evento) return;

  const confirmar = confirm(
    `Deseja remover "${evento.titulo}"? Esta ação não pode ser desfeita.`,
  );

  if (!confirmar) return;

  try {
    if (supabaseAtivo) {
      await requisitarSupabase(
        `agenda_eventos?id=eq.${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
    }
  } catch (erro) {
    alert(`Não foi possível remover: ${erro.message}`);
    return;
  }

  eventos = eventos.filter((item) => String(item.id) !== id);

  salvarEventos();

  atualizarTela();

  gerarCalendario();
}

document.addEventListener("click", (event) => {
  const botao = event.target.closest(".btn-remover-evento");

  if (botao) {
    removerEvento(botao.dataset.eventoId);
  }
});

// ==========================================
// ATUALIZAR TELA
// ==========================================

function atualizarTela() {
  mostrarLista(eventos, "lista-inicio");

  mostrarLista(
    eventos.filter((evento) => evento.tipo !== "comunicado"),
    "lista-eventos",
  );

  mostrarComunicados();

  mostrarReunioes();
}

// ==========================================
// COMUNICADOS
// ==========================================

function mostrarComunicados() {
  mostrarLista(
    eventos.filter((evento) => evento.tipo === "comunicado"),

    "lista-comunicados",
  );
}

// ==========================================
// REUNIÕES
// ==========================================

function mostrarReunioes() {
  mostrarLista(
    eventos.filter((evento) => evento.tipo === "reuniao"),

    "lista-reunioes",
  );
}

// ==========================================
// SETORES
// ==========================================

function abrirSetor(setor) {
  setorAtual = setor;

  fecharMenu();

  esconderPaginas();

  document.getElementById("pagina-setor").classList.remove("escondida");

  document.getElementById("titulo-setor").innerText = "🏢 " + setor;

  const eventosSetor = eventos.filter(
    (evento) => evento.setor === setor || evento.setor === "Todos",
  );

  mostrarLista(eventosSetor, "lista-setor");
}

function abrirNotasDoSetorAtual() {
  if (!setorAtual) return;

  mostrarNotas(setorAtual);
}

// ==========================================
// NOTAS
// ==========================================

function mostrarNotas(tipo) {
  fecharMenu();

  esconderPaginas();

  document.getElementById("pagina-notas").classList.remove("escondida");

  document.getElementById("titulo-notas").innerText =
    tipo === "Geral" ? "📝 Notas gerais" : "📝 Notas — " + tipo;

  const campo = document.getElementById("campo-notas");

  campo.value = notas[tipo] || "";

  campo.dataset.tipo = tipo;

  document.getElementById("status-nota").innerText = "Última anotação salva";
}

async function salvarNota() {
  const campo = document.getElementById("campo-notas");

  const tipo = campo.dataset.tipo || "Geral";

  notas[tipo] = campo.value;

  try {
    if (supabaseAtivo) {
      await salvarNotaNoBanco(tipo, campo.value);
    } else {
      localStorage.setItem("notas", JSON.stringify(notas));
    }
  } catch (erro) {
    document.getElementById("status-nota").innerText =
      `Não foi possível salvar: ${erro.message}`;
    return;
  }

  document.getElementById("status-nota").innerText = supabaseAtivo
    ? "✅ Nota compartilhada salva para todos."
    : "✅ Notas salvas neste navegador.";

  setTimeout(() => {
    document.getElementById("status-nota").innerText = "Última anotação salva";
  }, 2000);
}

// ==========================================
// REMOVER REUNIÕES PASSADAS
// ==========================================

async function removerReunioesPassadas() {
  const hoje = new Date().toISOString().split("T")[0];

  const reunioesPassadas = eventos.filter(
    (evento) => evento.tipo === "reuniao" && evento.data < hoje,
  );

  if (reunioesPassadas.length === 0) {
    alert("Não existem reuniões passadas para remover.");

    return;
  }

  const confirmar = confirm(
    `Existem ${reunioesPassadas.length} reunião(ões) passada(s).\n\nDeseja removê-las?`,
  );

  if (!confirmar) return;

  try {
    if (supabaseAtivo) {
      await Promise.all(
        reunioesPassadas.map((evento) =>
          requisitarSupabase(
            `agenda_eventos?id=eq.${encodeURIComponent(String(evento.id))}`,
            { method: "DELETE" },
          ),
        ),
      );
    }
  } catch (erro) {
    alert(`Não foi possível remover as reuniões: ${erro.message}`);
    return;
  }

  eventos = eventos.filter(
    (evento) => !(evento.tipo === "reuniao" && evento.data < hoje),
  );

  salvarEventos();

  atualizarTela();

  alert("Reuniões passadas removidas com sucesso! 🗑️");
}

// ==========================================
// LISTAR EVENTOS
// ==========================================

function mostrarLista(lista, elementoId) {
  const container = document.getElementById(elementoId);

  if (!container) return;

  container.innerHTML = "";

  if (lista.length === 0) {
    container.innerHTML = `

            <div class="sem-eventos">

                Nenhum evento cadastrado.

            </div>

        `;

    return;
  }

  const listaOrdenada = [...lista].sort(
    (a, b) => new Date(a.data) - new Date(b.data),
  );

  listaOrdenada.forEach((evento) => {
    const data = formatarData(evento.data);

    let icone = "📅";

    if (evento.tipo === "comunicado") {
      icone = "📢";
    }

    if (evento.tipo === "reuniao") {
      icone = "📋";
    }

    container.innerHTML += `

                <div class="evento">

                    <div class="evento-header">

                        <div>

                            <h3>
                                ${icone}
                                ${escapeHTML(evento.titulo)}
                            </h3>

                            <p>
                                ${escapeHTML(evento.descricao)}
                            </p>

                            <p class="evento-autor">
                              Publicado por: ${escapeHTML(evento.autor || "Autor não informado")}
                            </p>

                        </div>

                        <button
                            type="button"
                            class="btn-remover-evento"
                            data-evento-id="${escapeHTML(String(evento.id))}"
                            aria-label="Remover ${escapeHTML(evento.titulo)}"
                            title="Remover item"
                        >
                            🗑️ Remover
                        </button>

                    </div>


                    <div class="evento-info">

                        <span class="tag">
                            📅 ${data}
                        </span>


                        ${
                          evento.hora
                            ? `<span class="tag">
                                🕐 ${evento.hora}
                            </span>`
                            : ""
                        }


                        <span class="tag">
                            👥 ${escapeHTML(evento.setor)}
                        </span>

                    </div>

                </div>

            `;
  });
}

// ==========================================
// CALENDÁRIO
// ==========================================

function gerarCalendario() {
  const container = document.getElementById("calendario");

  const agora = new Date();

  const mes = agora.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  let html = `

        <div class="mes">
            ${mes}
        </div>

    `;

  const eventosOrdenados = [...eventos].sort(
    (a, b) => new Date(a.data) - new Date(b.data),
  );

  if (eventosOrdenados.length === 0) {
    html += `

            <div class="sem-eventos">
                Nenhum evento cadastrado.
            </div>

        `;
  } else {
    eventosOrdenados.forEach((evento) => {
      html += `

                    <div class="evento-calendario">

                        <div>
                            <strong>
                                ${formatarData(evento.data)}
                            </strong>

                            ${evento.hora ? ` - ${evento.hora}` : ""}

                            <br>

                            ${escapeHTML(evento.titulo)}

                            <br>

                            <small>Publicado por: ${escapeHTML(evento.autor || "Autor não informado")}</small>
                        </div>

                        <button
                            type="button"
                            class="btn-remover-evento"
                            data-evento-id="${escapeHTML(String(evento.id))}"
                            aria-label="Remover ${escapeHTML(evento.titulo)}"
                            title="Remover item"
                        >
                            🗑️ Remover
                        </button>

                    </div>

                `;
    });
  }

  container.innerHTML = html;
}

// ==========================================
// FORMATAR DATA
// ==========================================

function formatarData(data) {
  if (!data) return "";

  const partes = data.split("-");

  return `
        ${partes[2]}/${partes[1]}/${partes[0]}
    `;
}

// ==========================================
// PROTEÇÃO CONTRA HTML
// ==========================================

function escapeHTML(texto) {
  const div = document.createElement("div");

  div.textContent = texto;

  return div.innerHTML;
}

// ==========================================
// INICIAR
// ==========================================

document.getElementById("pagina-inicio").style.display = "block";

iniciarAgenda();
