const SUPABASE_URL = "https://qtiqywmdtgwvmkstrzob.supabase.co";
const SUPABASE_KEY = "sb_publishable_8tgaaQbcXCINTRPUReTtpQ_DFK9Vo91";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const botoes = document.querySelectorAll(".tab-btn");
const abas = document.querySelectorAll(".tab");

let usuarioAtual = null;
let usuarioAtualId = null;
let figurinhas = [];
let albumUsuario = {};

botoes.forEach(botao => {
  botao.addEventListener("click", () => {
    if (botao.dataset.tab === "gerencial" && (!usuarioAtual || !usuarioAtual.admin)) {
      alert("Você não tem acesso à área gerencial.");
      return;
    }

    botoes.forEach(b => b.classList.remove("active"));
    abas.forEach(aba => aba.classList.remove("active"));

    botao.classList.add("active");
    document.getElementById(botao.dataset.tab).classList.add("active");
  });
});

function mostrarCadastro() {
  document.getElementById("areaLogin").classList.add("hidden");
  document.getElementById("areaCadastro").classList.remove("hidden");
}

function mostrarLogin() {
  document.getElementById("areaCadastro").classList.add("hidden");
  document.getElementById("areaLogin").classList.remove("hidden");
}

function limparTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function verificarAdmin(nome, login) {
  const nomeLimpo = limparTexto(nome);
  const loginLimpo = limparTexto(login);

  return (
    nomeLimpo === "pedro" ||
    nomeLimpo === "janaina" ||
    loginLimpo === "pedro" ||
    loginLimpo === "janaina"
  );
}

async function cadastrarFuncionario() {
  const nome = document.getElementById("cadastroNome").value.trim();
  const setor = document.getElementById("cadastroSetor").value;
  const login = document.getElementById("cadastroLogin").value.trim().toLowerCase();
  const senha = document.getElementById("cadastroSenha").value;
  const erro = document.getElementById("erroCadastro");

  erro.textContent = "";

  if (!nome || !setor || !login || !senha) {
    erro.textContent = "Preencha todos os campos.";
    return;
  }

  if (login.length < 3) {
    erro.textContent = "O usuário precisa ter pelo menos 3 caracteres.";
    return;
  }

  if (senha.length < 6) {
    erro.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }

  const { data: perfilComLogin } = await db
    .from("profiles")
    .select("id")
    .eq("login", login)
    .maybeSingle();

  if (perfilComLogin) {
    erro.textContent = "Esse usuário já está em uso.";
    return;
  }

  const emailFake = `${login}@sances.app`;

  const { data, error } = await db.auth.signUp({
    email: emailFake,
    password: senha
  });

  if (error) {
    erro.textContent = "Erro ao cadastrar: " + error.message;
    return;
  }

  const admin = verificarAdmin(nome, login);

  const { error: profileError } = await db.from("profiles").insert({
    id: data.user.id,
    sticker_id: null,
    nome,
    login,
    setor,
    admin,
    pacotes: 0
  });

  if (profileError) {
    erro.textContent = "Erro ao criar perfil: " + profileError.message;
    return;
  }

  alert(`Cadastro criado com sucesso. Seu usuário é: ${login}`);

  mostrarLogin();

  document.getElementById("loginFuncionario").value = login;
  document.getElementById("senhaFuncionario").value = "";
  document.getElementById("cadastroNome").value = "";
  document.getElementById("cadastroSetor").value = "";
  document.getElementById("cadastroLogin").value = "";
  document.getElementById("cadastroSenha").value = "";
}

async function fazerLoginFuncionario() {
  const login = document.getElementById("loginFuncionario").value.trim().toLowerCase();
  const senha = document.getElementById("senhaFuncionario").value;
  const erro = document.getElementById("erroLoginFuncionario");

  erro.textContent = "";

  if (!login || !senha) {
    erro.textContent = "Informe usuário e senha.";
    return;
  }

  const emailFake = `${login}@sances.app`;

  const { data, error } = await db.auth.signInWithPassword({
    email: emailFake,
    password: senha
  });

  if (error) {
    erro.textContent = "Usuário ou senha incorretos.";
    return;
  }

  await carregarPerfil(data.user.id);
}

async function carregarPerfil(idUsuario) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", idUsuario)
    .single();

  if (error || !data) {
    alert("Perfil não encontrado.");
    return;
  }

  usuarioAtual = data;
  usuarioAtualId = data.id;

  document.getElementById("telaLogin").classList.add("hidden");
  document.getElementById("appPrincipal").classList.remove("hidden");

  document.getElementById("nomeUsuarioLogado").textContent = data.nome;
  document.getElementById("setorUsuarioLogado").textContent = data.setor;

  if (data.admin) {
    document.getElementById("btnGerencial").classList.remove("hidden");
  } else {
    document.getElementById("btnGerencial").classList.add("hidden");
  }

  await carregarTudoOnline();
}

async function sair() {
  await db.auth.signOut();
  location.reload();
}

async function carregarFigurinhasBanco() {
  const { data, error } = await db
    .from("stickers")
    .select("*")
    .eq("ativo", true)
    .order("setor", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    alert("Erro ao carregar figurinhas.");
    return;
  }

  figurinhas = data || [];
}

function classeRaridade(fig) {
  if (fig.raridade === "normal") return "card-normal";
  if (fig.raridade === "rara") return "card-rara";
  if (fig.raridade === "lendaria") return "card-lendaria";
}

function textoRaridade(fig) {
  if (fig.raridade === "normal") return "Normal • 25%";
  if (fig.raridade === "rara") return "Head • 10%";
  if (fig.raridade === "lendaria") return "CEO • 5%";
}

function criarCardFigurinha(fig, bloqueada = false) {
  return `
    <div class="card ${classeRaridade(fig)} ${bloqueada ? "locked" : ""}">
      <div class="photo">${bloqueada ? "❓" : fig.emoji}</div>
      <h3>${fig.nome}</h3>
      <span>${fig.setor}</span>
      <small class="raridade raridade-${fig.raridade}">
        ${textoRaridade(fig)}
      </small>
    </div>
  `;
}

function carregarFigurinhasDisponiveis() {
  const lista = document.getElementById("listaFigurinhas");
  lista.innerHTML = "";

  const ordemSetores = [
    "CEO",
    "Implantação",
    "RH",
    "Suporte",
    "DEV",
    "Comercial",
    "Marketing"
  ];

  const setores = [
    ...ordemSetores,
    ...new Set(figurinhas.map(fig => fig.setor).filter(setor => !ordemSetores.includes(setor)))
  ];

  setores.forEach(setor => {
    const grupo = figurinhas
      .filter(fig => fig.setor === setor)
      .sort((a, b) => {
        const ordemRaridade = {
          lendaria: 1,
          rara: 2,
          normal: 3
        };

        return ordemRaridade[a.raridade] - ordemRaridade[b.raridade];
      });

    if (grupo.length === 0) return;

    let cards = "";

    grupo.forEach(fig => {
      cards += criarCardFigurinha(fig);
    });

    lista.innerHTML += `
      <div class="setor-bloco">
        <h3 class="setor-titulo">${setor}</h3>
        <div class="cards">${cards}</div>
      </div>
    `;
  });
}

async function carregarAlbumUsuario() {
  const { data, error } = await db
    .from("album")
    .select("*")
    .eq("usuario_id", usuarioAtualId);

  if (error) {
    alert("Erro ao carregar álbum.");
    return;
  }

  albumUsuario = {};

  data.forEach(item => {
    const fig = figurinhas.find(f => f.id === item.figurinha_id);

    if (fig) {
      albumUsuario[item.figurinha_id] = {
        ...fig,
        quantidade: item.quantidade
      };
    }
  });
}

async function atualizarPerfilUsuario() {
  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("id", usuarioAtualId)
    .single();

  if (data) {
    usuarioAtual = data;
  }
}

function atualizarContadorPacotes() {
  document.getElementById("contadorPacotes").textContent = usuarioAtual.pacotes || 0;
}

function sortearFigurinhaPorChance() {
  const soma = figurinhas.reduce((total, fig) => total + fig.chance, 0);
  let numero = Math.random() * soma;

  for (const fig of figurinhas) {
    numero -= fig.chance;

    if (numero <= 0) {
      return fig;
    }
  }

  return figurinhas[figurinhas.length - 1];
}

async function abrirPacote() {
  if (!usuarioAtual || usuarioAtual.pacotes <= 0) {
    alert("Você não tem pacotes disponíveis.");
    return;
  }

  const novoTotal = usuarioAtual.pacotes - 1;

  const { error } = await db
    .from("profiles")
    .update({ pacotes: novoTotal })
    .eq("id", usuarioAtualId);

  if (error) {
    alert("Erro ao abrir pacote.");
    return;
  }

  usuarioAtual.pacotes = novoTotal;
  atualizarContadorPacotes();

  criarPopupPacote();

  setTimeout(async () => {
    fecharPopupPacote();
    await revelarFigurinhas();
  }, 2800);
}

function criarPopupPacote() {
  const popup = document.createElement("div");
  popup.classList.add("pack-popup");

  popup.innerHTML = `
    <div class="pack-modal">
      <div class="sparkles"></div>
      <div class="mystery-pack">
        <div class="pack-top"></div>
        <div class="pack-body"><span>?</span></div>
        <div class="pack-bottom"></div>
      </div>
      <div class="energy-ring"></div>
      <div class="cards-shadow"></div>
    </div>
  `;

  document.body.appendChild(popup);
}

function fecharPopupPacote() {
  const popup = document.querySelector(".pack-popup");
  if (popup) {
    popup.remove();
  }
}

async function salvarFigurinhaNoAlbum(fig) {
  const atual = albumUsuario[fig.id] ? albumUsuario[fig.id].quantidade : 0;
  const novaQuantidade = atual + 1;

  const { error } = await db.from("album").upsert({
    usuario_id: usuarioAtualId,
    figurinha_id: fig.id,
    quantidade: novaQuantidade
  });

  if (error) {
    alert("Erro ao salvar figurinha.");
    return false;
  }

  albumUsuario[fig.id] = {
    ...fig,
    quantidade: novaQuantidade
  };

  return true;
}

async function revelarFigurinhas() {
  const resultado = document.getElementById("resultadoPacote");
  resultado.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const sorteada = sortearFigurinhaPorChance();
    const repetida = !!albumUsuario[sorteada.id];

    const ok = await salvarFigurinhaNoAlbum(sorteada);

    if (!ok) return;

    resultado.innerHTML += `
      <div class="card new-card ${classeRaridade(sorteada)}">
        <div class="photo">${sorteada.emoji}</div>
        <h3>${sorteada.nome}</h3>
        <span>${sorteada.setor}</span>
        <small class="raridade raridade-${sorteada.raridade}">
          ${textoRaridade(sorteada)}
        </small>
        ${repetida ? `<small class="repeat">Repetida</small>` : `<small class="new">Nova figurinha</small>`}
      </div>
    `;
  }

  await carregarAlbumUsuario();
  await atualizarPerfilUsuario();

  atualizarAlbum();
  atualizarContadorPacotes();
  await atualizarRanking();
  await atualizarGerencial();
}

function atualizarAlbum() {
  const albumSection = document.getElementById("album");

  const total = figurinhas.length;
  const conquistadas = Object.keys(albumUsuario).length;
  const porcentagem = Math.round((conquistadas / total) * 100);

  let cards = "";

  figurinhas.forEach(fig => {
    if (albumUsuario[fig.id]) {
      cards += `
        <div class="card album-card ${classeRaridade(fig)}">
          <div class="quantity-badge">${albumUsuario[fig.id].quantidade}</div>
          <div class="photo">${fig.emoji}</div>
          <h3>${fig.nome}</h3>
          <span>${fig.setor}</span>
          <small class="raridade raridade-${fig.raridade}">
            ${textoRaridade(fig)}
          </small>
        </div>
      `;
    } else {
      cards += criarCardFigurinha(fig, true);
    }
  });

  albumSection.innerHTML = `
    <h2>Meu Álbum</h2>
    <p>Veja todas as figurinhas do álbum, incluindo as bloqueadas.</p>

    <div class="progress-box">
      <h3>Progresso</h3>
      <div class="progress-bar">
        <div class="progress" style="width:${porcentagem}%;"></div>
      </div>
      <span>${porcentagem}% completo — ${conquistadas}/${total} figurinhas</span>
    </div>

    <div class="cards album-grid">${cards}</div>
  `;
}

async function atualizarRanking() {
  const rankingLista = document.getElementById("rankingLista");

  const { data: usuarios, error: erroUsuarios } = await db.from("profiles").select("*");
  const { data: albuns, error: erroAlbuns } = await db.from("album").select("*");

  if (erroUsuarios || erroAlbuns) {
    rankingLista.innerHTML = "<p>Erro ao carregar ranking.</p>";
    return;
  }

  const ranking = usuarios.map(usuario => {
    const album = albuns.filter(item => item.usuario_id === usuario.id);
    const unicas = album.length;
    const total = album.reduce((soma, item) => soma + item.quantidade, 0);

    return {
      ...usuario,
      unicas,
      total
    };
  }).sort((a, b) => b.unicas - a.unicas || b.total - a.total);

  rankingLista.innerHTML = "";

  ranking.forEach((pessoa, index) => {
    rankingLista.innerHTML += `
      <div>
        <strong>${index + 1}º</strong>
        ${pessoa.nome} - ${pessoa.setor}
        <span>${pessoa.unicas}/${figurinhas.length} únicas | ${pessoa.total} total</span>
      </div>
    `;
  });
}

async function atualizarGerencial() {
  if (!usuarioAtual || !usuarioAtual.admin) return;

  const lista = document.getElementById("listaGerencial");

  const { data: usuarios, error } = await db
    .from("profiles")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    lista.innerHTML = "<p>Erro ao carregar painel gerencial.</p>";
    return;
  }

  lista.innerHTML = "";

  usuarios.forEach(usuario => {
    lista.innerHTML += `
      <div class="admin-row">
        <div>
          <h4>${usuario.nome}</h4>
          <span>${usuario.setor}</span>
        </div>

        <div class="admin-count">${usuario.pacotes || 0}</div>

        <div class="admin-actions">
          <input type="number" id="pacoteInput${usuario.id}" min="1" value="1">
          <button onclick="adicionarPacotes('${usuario.id}')">+</button>
          <button onclick="removerPacotes('${usuario.id}')">-</button>
        </div>
      </div>
    `;
  });
}

async function adicionarPacotes(idPessoa) {
  if (!usuarioAtual || !usuarioAtual.admin) return;

  const input = document.getElementById(`pacoteInput${idPessoa}`);
  const quantidade = Number(input.value);

  if (quantidade <= 0) return;

  const { data: perfil, error } = await db
    .from("profiles")
    .select("pacotes")
    .eq("id", idPessoa)
    .single();

  if (error) {
    alert("Erro ao buscar funcionário.");
    return;
  }

  const novoTotal = (perfil.pacotes || 0) + quantidade;

  await db
    .from("profiles")
    .update({ pacotes: novoTotal })
    .eq("id", idPessoa);

  if (idPessoa === usuarioAtualId) {
    usuarioAtual.pacotes = novoTotal;
    atualizarContadorPacotes();
  }

  await atualizarGerencial();
  await atualizarRanking();
}

async function removerPacotes(idPessoa) {
  if (!usuarioAtual || !usuarioAtual.admin) return;

  const input = document.getElementById(`pacoteInput${idPessoa}`);
  const quantidade = Number(input.value);

  if (quantidade <= 0) return;

  const { data: perfil, error } = await db
    .from("profiles")
    .select("pacotes")
    .eq("id", idPessoa)
    .single();

  if (error) {
    alert("Erro ao buscar funcionário.");
    return;
  }

  let novoTotal = (perfil.pacotes || 0) - quantidade;

  if (novoTotal < 0) {
    novoTotal = 0;
  }

  await db
    .from("profiles")
    .update({ pacotes: novoTotal })
    .eq("id", idPessoa);

  if (idPessoa === usuarioAtualId) {
    usuarioAtual.pacotes = novoTotal;
    atualizarContadorPacotes();
  }

  await atualizarGerencial();
  await atualizarRanking();
}

async function adicionarFigurinha() {
  if (!usuarioAtual || !usuarioAtual.admin) return;

  const nome = document.getElementById("novaNome").value.trim();
  const setor = document.getElementById("novoSetor").value.trim();
  const raridade = document.getElementById("novaRaridade").value;
  const emoji = document.getElementById("novoEmoji").value || "👤";

  if (!nome || !setor) {
    alert("Preencha nome e setor.");
    return;
  }

  let chance = 25;

  if (raridade === "rara") {
    chance = 10;
  }

  if (raridade === "lendaria") {
    chance = 5;
  }

  const { error } = await db.from("stickers").insert({
    nome,
    setor,
    raridade,
    chance,
    emoji,
    admin: false,
    ativo: true
  });

  if (error) {
    alert("Erro ao adicionar figurinha.");
    return;
  }

  document.getElementById("novaNome").value = "";
  document.getElementById("novoSetor").value = "";
  document.getElementById("novoEmoji").value = "👤";

  await carregarTudoOnline();
}

async function carregarTudoOnline() {
  await carregarFigurinhasBanco();
  carregarFigurinhasDisponiveis();
  await carregarAlbumUsuario();
  await atualizarPerfilUsuario();

  atualizarAlbum();
  atualizarContadorPacotes();
  await atualizarRanking();
  await atualizarGerencial();
}

async function verificarSessaoAtiva() {
  await carregarFigurinhasBanco();

  const { data } = await db.auth.getSession();

  if (data.session && data.session.user) {
    await carregarPerfil(data.session.user.id);
  }
}

verificarSessaoAtiva();