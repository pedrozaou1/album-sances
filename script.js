const SUPABASE_URL = "https://qtiqywmdtgwvmkstrzob.supabase.co";
const SUPABASE_KEY = "sb_publishable_8tgaaQbcXCINTRPUReTtpQ_DFK9Vo91";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const botoes = document.querySelectorAll(".tab-btn");
const abas = document.querySelectorAll(".tab");

let usuarioAtual = null;
let usuarioAtualId = null;
let figurinhas = [];
let albumUsuario = {};
let participantesSorteio = [];
let sorteioEmAndamento = false;
let usuarioSenhaSelecionado = null;

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

    if (botao.dataset.tab === "transparencia") carregarLogs();
    if (botao.dataset.tab === "sorteio") carregarSorteios();
    fecharMenuMobile();
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

  if (senha.length < 6) {
    erro.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }

//  const nomesReservados = ["pedro", "jana", "janaina"];
//  const loginsReservados = ["pedro", "jana", "janaina"];

  //if (nomesReservados.includes(limparTexto(nome)) || loginsReservados.includes(limparTexto(login))) {
  //  erro.textContent = "Esse nome ou usuário é reservado. Fale com o administrador.";
  //  return;
 // }

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

  const { error: profileError } = await db.from("profiles").insert({
    id: data.user.id,
    sticker_id: null,
    nome,
    login,
    setor,
    admin: false,
    pacotes: 1,
    pacotes_abertos: 0
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

  if (data.admin === true) {
    document.getElementById("btnGerencial").classList.remove("hidden");
    document.getElementById("controlesSorteio")?.classList.remove("hidden");
  } else {
    document.getElementById("btnGerencial").classList.add("hidden");
    document.getElementById("controlesSorteio")?.classList.add("hidden");
  }
  document.getElementById("btnMenuMobile")?.classList.remove("hidden");
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
  if (fig.raridade === "incomum" || fig.raridade === "normal") return "card-incomum";
  if (fig.raridade === "rara") return "card-rara";
  if (fig.raridade === "lendaria") return "card-lendaria";
}

function classeLogRaridade(fig) {
  if (fig.raridade === "incomum" || fig.raridade === "normal") return "log-raridade-incomum";
  if (fig.raridade === "rara") return "log-raridade-rara";
  if (fig.raridade === "lendaria") return "log-raridade-lendaria";
  return "log-raridade-incomum";
}

function textoRaridade(fig) {
  if (fig.raridade === "incomum" || fig.raridade === "normal") return `Incomum • ${fig.chance}%`;
  if (fig.raridade === "rara") return `Épica • ${fig.chance}%`;
  if (fig.raridade === "lendaria") return `Lendária • ${fig.chance}%`;
}

function gerarSlugFoto(nome) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function imagemOuEmoji(fig, bloqueada = false) {
  if (bloqueada) {
    return "❓";
  }

  const slug = gerarSlugFoto(fig.nome);
  const fotoJpg = `img/${slug}_sances.jpg`;
  const fotoPng = `img/${slug}_sances.png`;
  const emoji = fig.emoji || "👤";

  return `
    <img
      loading="lazy"
      src="${fotoJpg}"
      alt="${fig.nome}"
      onerror="
        if (!this.dataset.tentouPng) {
          this.dataset.tentouPng = 'true';
          this.src = '${fotoPng}';
        } else {
          this.parentElement.innerHTML = '${emoji}';
        }
      "
    >
  `;
}

function criarCardFigurinha(fig, bloqueada = false) {
  return `
    <div class="card ${classeRaridade(fig)} ${bloqueada ? "locked" : ""}">
      <div class="photo">${imagemOuEmoji(fig, bloqueada)}</div>
      <h3>${fig.nome}</h3>
      <span>${fig.setor}</span>
      <small class="raridade raridade-${fig.raridade === "normal" ? "incomum" : fig.raridade}">
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
    "Comercial",
    "Marketing",
    "Implantação",
    "ADM",
    "Suporte",
    "DEV"
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
          incomum: 3,
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

  const contadorAbertos = document.getElementById("contadorPacotesAbertos");

  if (contadorAbertos) {
    contadorAbertos.textContent = usuarioAtual.pacotes_abertos || 0;
  }
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
  const novoTotalAbertos = (usuarioAtual.pacotes_abertos || 0) + 1;

  const { error } = await db
    .from("profiles")
    .update({
      pacotes: novoTotal,
      pacotes_abertos: novoTotalAbertos
    })
    .eq("id", usuarioAtualId);

  if (error) {
    alert("Erro ao abrir pacote.");
    return;
  }

  usuarioAtual.pacotes = novoTotal;
  usuarioAtual.pacotes_abertos = novoTotalAbertos;

  atualizarContadorPacotes();
  criarPopupPacote();

  setTimeout(async () => {
    fecharPopupPacote();
    await revelarFigurinhas();
  }, 4300);
}

function criarPopupPacote() {
  const popup = document.createElement("div");
  popup.classList.add("pack-popup", "pack-cinematic");

  popup.innerHTML = `
    <div class="cinematic-vignette"></div>
    <div class="cinematic-aurora aurora-one"></div>
    <div class="cinematic-aurora aurora-two"></div>

    <div class="pack-modal pack-modal-cinematic">
      <div class="pack-scene-title">
        <small>ÁLBUM SANCES</small>
        <strong>Preparando a surpresa...</strong>
      </div>

      <div class="cinematic-rays"></div>
      <div class="cinematic-particles">
        ${Array.from({ length: 18 }, (_, index) => `<i style="--particle:${index}"></i>`).join("")}
      </div>

      <div class="cinematic-rings">
        <span></span><span></span><span></span>
      </div>

      <div class="cinematic-card-fan">
        <div class="cinematic-card card-fan-one"><b>?</b></div>
        <div class="cinematic-card card-fan-two"><b>?</b></div>
        <div class="cinematic-card card-fan-three"><b>?</b></div>
      </div>

      <div class="mystery-pack mystery-pack-cinematic">
        <div class="pack-tear-strip"></div>
        <div class="pack-lid pack-lid-cinematic"></div>
        <div class="pack-body pack-body-cinematic">
          <div class="pack-brand-mark">
            <img src="img/principal.png" alt="Sances">
          </div>
          <strong>PACK</strong>
          <small>3 FIGURINHAS</small>
          <div class="pack-foil-shine"></div>
        </div>
        <div class="pack-bottom pack-bottom-cinematic"></div>
      </div>

      <div class="cinematic-flash"></div>
      <div class="cinematic-ground-glow"></div>
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

function montarMensagemFigurinhasEncontradas(figs) {
  const nomesColoridos = figs.map(fig => {
    return `<span class="log-card-name ${classeLogRaridade(fig)}">${fig.nome}</span>`;
  });

  let nomesTexto = "";

  if (nomesColoridos.length === 1) {
    nomesTexto = nomesColoridos[0];
  } else if (nomesColoridos.length === 2) {
    nomesTexto = `${nomesColoridos[0]} e ${nomesColoridos[1]}`;
  } else {
    nomesTexto = `${nomesColoridos[0]}, ${nomesColoridos[1]} e ${nomesColoridos[2]}`;
  }

  return `${usuarioAtual.nome} encontrou ${nomesTexto}.`;
}

async function revelarFigurinhas() {
  const resultado = document.getElementById("resultadoPacote");
  resultado.innerHTML = "";

  const figurinhasDoPacote = [];

  for (let i = 0; i < 3; i++) {
    const sorteada = sortearFigurinhaPorChance();
    const repetida = !!albumUsuario[sorteada.id];

    figurinhasDoPacote.push(sorteada);

    const ok = await salvarFigurinhaNoAlbum(sorteada);

    if (!ok) return;

    resultado.innerHTML += `
      <div class="card new-card ${classeRaridade(sorteada)}">
        <div class="photo">${imagemOuEmoji(sorteada, false)}</div>
        <h3>${sorteada.nome}</h3>
        <span>${sorteada.setor}</span>
        <small class="raridade raridade-${sorteada.raridade === "normal" ? "incomum" : sorteada.raridade}">
          ${textoRaridade(sorteada)}
        </small>
        ${repetida ? `<small class="repeat">Repetida</small>` : `<small class="new">Nova figurinha</small>`}
      </div>
    `;
  }

  await registrarLog(
    "FIGURINHA ENCONTRADA",
    montarMensagemFigurinhasEncontradas(figurinhasDoPacote)
  );

  await carregarAlbumUsuario();
  await atualizarPerfilUsuario();

  atualizarAlbum();
  atualizarContadorPacotes();
  await atualizarRanking();
  await atualizarGerencial();
  await carregarSorteios();
  await carregarLogs();
}

function fraseDaFigurinha(fig) {
  const frasesPorRaridade = {
    incomum: [
      "Toda grande coleção começa com pessoas que fazem a diferença todos os dias.",
      "Talento, parceria e atitude: uma combinação que merece estar no álbum.",
      "Uma presença que deixa o time mais forte e a rotina mais leve.",
      "Pequenas atitudes constroem grandes resultados — e essa carta prova isso."
    ],
    normal: [
      "Toda grande coleção começa com pessoas que fazem a diferença todos os dias.",
      "Talento, parceria e atitude: uma combinação que merece estar no álbum."
    ],
    rara: [
      "Uma carta épica para quem transforma desafios em conquistas.",
      "Liderança que inspira, atitude que movimenta e resultado que aparece.",
      "Quando experiência e energia se encontram, nasce uma presença épica.",
      "Uma daquelas pessoas que elevam o nível de todo o time."
    ],
    lendaria: [
      "Uma presença lendária, feita para marcar a história da Sances.",
      "Visão, coragem e propósito: atributos dignos de uma carta lendária.",
      "Não é apenas uma figurinha — é um capítulo importante da nossa história.",
      "Rara de encontrar, impossível de esquecer."
    ]
  };

  const lista = frasesPorRaridade[fig.raridade] || frasesPorRaridade.incomum;
  const soma = Array.from(fig.nome || "").reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return lista[soma % lista.length];
}

function abrirInspecaoCarta(figId) {
  const fig = figurinhas.find(item => String(item.id) === String(figId));
  const itemAlbum = albumUsuario[figId];

  if (!fig || !itemAlbum) return;

  const modal = document.getElementById("modalCarta");
  const carta = document.getElementById("cartaInspecionada");
  const nome = document.getElementById("modalCartaNome");
  const frase = document.getElementById("modalCartaFrase");
  const classe = fig.raridade === "normal" ? "incomum" : fig.raridade;

  carta.innerHTML = `
    <div class="inspect-card inspect-${classe} ${classeRaridade(fig)}">
      <div class="inspect-card-glow"></div>
      <div class="inspect-card-pattern"></div>
      <div class="inspect-card-topline">
        <span>${textoRaridade(fig).split("•")[0].trim()}</span>
        <strong>x${itemAlbum.quantidade}</strong>
      </div>
      <div class="inspect-photo">${imagemOuEmoji(fig, false)}</div>
      <div class="inspect-card-info">
        <small>${fig.setor}</small>
        <h3>${fig.nome}</h3>
        <p>${fraseDaFigurinha(fig)}</p>
      </div>
      <div class="inspect-card-brand">
        <img src="img/principal.png" alt="Sances">
        <span>Álbum Digital</span>
      </div>
    </div>
  `;

  nome.textContent = fig.nome;
  frase.textContent = fraseDaFigurinha(fig);
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function fecharInspecaoCarta() {
  document.getElementById("modalCarta")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function copiarInstagram() {
  const texto = "@sances_dms";
  try {
    await navigator.clipboard.writeText(texto);
    const botao = document.getElementById("btnCopiarInstagram");
    botao.textContent = "Copiado! ✓";
    setTimeout(() => botao.textContent = "Copiar @sances_dms", 1800);
  } catch {
    alert("Instagram: @sances_dms");
  }
}

function atualizarAlbum() {
  const albumSection = document.getElementById("album");
  const total = figurinhas.length;
  const conquistadas = Object.keys(albumUsuario).length;
  const totalFigurinhas = Object.values(albumUsuario).reduce((s,i)=>s+Number(i.quantidade||0),0);
  const repetidas = Object.values(albumUsuario).reduce((s,i)=>s+Math.max(Number(i.quantidade||0)-1,0),0);
  const porcentagem = total ? Math.round((conquistadas/total)*100) : 0;
  let cards = "";

  figurinhas.forEach(fig => {
    if (albumUsuario[fig.id]) {
      cards += `
        <button class="album-card-button" type="button" onclick="abrirInspecaoCarta('${fig.id}')" aria-label="Inspecionar carta de ${fig.nome}">
          <div class="card album-card album-card-premium ${classeRaridade(fig)}">
            <div class="album-card-shimmer"></div>
            <div class="quantity-badge">${albumUsuario[fig.id].quantidade}</div>
            <div class="album-card-rarity">${textoRaridade(fig).split("•")[0].trim()}</div>
            <div class="photo">${imagemOuEmoji(fig,false)}</div>
            <div class="album-card-content">
              <span>${fig.setor}</span>
              <h3>${fig.nome}</h3>
              <small>Clique para inspecionar</small>
            </div>
          </div>
        </button>`;
    } else {
      cards += criarCardFigurinha(fig,true);
    }
  });

  albumSection.innerHTML = `
    <div class="album-hero album-hero-clean">
      <div class="album-progress-ring" style="--album-progress:${porcentagem*3.6}deg">
        <div><strong>${porcentagem}%</strong><span>completo</span></div>
      </div>
      <div class="album-hero-copy">
        <span class="eyebrow">Sua coleção</span>
        <h2>Meu Álbum</h2>
        <p>Clique em qualquer carta conquistada para inspecionar, ler sua frase e compartilhar.</p>
      </div>
    </div>
    <div class="album-metrics">
      <div class="album-metric"><span>Figurinhas únicas</span><strong>${conquistadas}<small>/${total}</small></strong></div>
      <div class="album-metric"><span>Total na coleção</span><strong>${totalFigurinhas}</strong></div>
      <div class="album-metric"><span>Repetidas</span><strong>${repetidas}</strong></div>
    </div>
    <div class="cards album-grid album-grid-premium">${cards}</div>`;
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
    const itens = albuns.filter(item => item.usuario_id === usuario.id);
    const unicas = itens.length;
    const total = itens.reduce((soma, item) => soma + Number(item.quantidade || 0), 0);
    const repetidas = itens.reduce(
      (soma, item) => soma + Math.max(Number(item.quantidade || 0) - 1, 0),
      0
    );
    const porcentagem = figurinhas.length
      ? Math.round((unicas / figurinhas.length) * 100)
      : 0;

    return { ...usuario, unicas, total, repetidas, porcentagem };
  }).sort((a, b) =>
    b.unicas - a.unicas ||
    b.total - a.total ||
    Number(b.pacotes_abertos || 0) - Number(a.pacotes_abertos || 0)
  );

  rankingLista.innerHTML = ranking.map((pessoa, index) => {
    const posicao = index === 0
      ? "🥇"
      : index === 1
        ? "🥈"
        : index === 2
          ? "🥉"
          : `${index + 1}º`;

    const classePodio = index < 3 ? ` ranking-entry-podium ranking-entry-podium-${index + 1}` : "";

    return `
      <article class="ranking-entry${classePodio}">
        <div class="ranking-entry-rank">${posicao}</div>

        <div class="ranking-entry-user">
          <div class="ranking-entry-avatar">${pessoa.nome.charAt(0).toUpperCase()}</div>
          <div class="ranking-entry-user-text">
            <strong>${pessoa.nome}</strong>
            <span>${pessoa.setor}</span>
          </div>
        </div>

        <div class="ranking-entry-collection">
          <small>COLEÇÃO</small>
          <strong>${pessoa.unicas}<span>/${figurinhas.length}</span></strong>
          <em>figurinhas únicas</em>
        </div>

        <div class="ranking-entry-stat">
          <strong>${pessoa.total}</strong>
          <span>figurinhas</span>
        </div>

        <div class="ranking-entry-stat">
          <strong>${pessoa.repetidas}</strong>
          <span>repetidas</span>
        </div>

        <div class="ranking-entry-stat">
          <strong>${pessoa.pacotes_abertos || 0}</strong>
          <span>pacotes</span>
        </div>

        <div class="ranking-entry-score">
          <strong>${pessoa.porcentagem}%</strong>
          <span>completo</span>
        </div>
      </article>
    `;
  }).join("");
}

async function atualizarGerencial() {
  if(!usuarioAtual||!usuarioAtual.admin)return;
  const lista=document.getElementById("listaGerencial");const metricas=document.getElementById("painelMetricasGerencial");
  const {data:usuarios,error}=await db.from("profiles").select("*").order("nome",{ascending:true});
  if(error){lista.innerHTML="<p>Erro ao carregar painel gerencial.</p>";return;}
  const {data:albuns}=await db.from("album").select("quantidade");
  const totalPacotes=usuarios.reduce((s,u)=>s+Number(u.pacotes||0),0),totalAbertos=usuarios.reduce((s,u)=>s+Number(u.pacotes_abertos||0),0),totalColecionadas=(albuns||[]).reduce((s,i)=>s+Number(i.quantidade||0),0);
  metricas.innerHTML=`<div class="admin-metric-card"><span>Funcionários</span><strong>${usuarios.length}</strong><small>contas ativas</small></div><div class="admin-metric-card"><span>Pacotes disponíveis</span><strong>${totalPacotes}</strong><small>somando todos</small></div><div class="admin-metric-card"><span>Pacotes abertos</span><strong>${totalAbertos}</strong><small>desde o lançamento</small></div><div class="admin-metric-card"><span>Figurinhas coletadas</span><strong>${totalColecionadas}</strong><small>incluindo repetidas</small></div>`;
  lista.innerHTML=usuarios.map(u=>`<div class="admin-row admin-row-premium"><div class="admin-user-info"><div class="admin-avatar">${u.nome.charAt(0).toUpperCase()}</div><div><h4>${u.nome}</h4><span>${u.setor} · @${u.login}</span></div></div><div class="admin-package-count"><small>Pacotes</small><strong>${u.pacotes||0}</strong></div><div class="admin-actions admin-actions-premium"><div class="package-actions"><input type="number" id="pacoteInput${u.id}" min="1" value="1"><button onclick="adicionarPacotes('${u.id}')">+</button><button class="btn-remove-package" onclick="removerPacotes('${u.id}')">−</button></div><button class="btn-password" onclick="abrirModalSenha('${u.id}','${String(u.nome).replace(/'/g,"&#39;")}')">🔑 Senha</button></div></div>`).join("");
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

  const { data: usuarioDestino } = await db
    .from("profiles")
    .select("nome")
    .eq("id", idPessoa)
    .single();

  await registrarLog(
    "PACOTE RECEBIDO",
    `${usuarioDestino.nome} recebeu ${quantidade} pacote(s) de ${usuarioAtual.nome}.`
  );

  if (idPessoa === usuarioAtualId) {
    usuarioAtual.pacotes = novoTotal;
    atualizarContadorPacotes();
  }

  await atualizarGerencial();
  await atualizarRanking();
  await carregarLogs();
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

  const { data: usuarioDestino } = await db
    .from("profiles")
    .select("nome")
    .eq("id", idPessoa)
    .single();

  await registrarLog(
    "PACOTE REMOVIDO",
    `${usuarioDestino.nome} perdeu ${quantidade} pacote(s) por ação de ${usuarioAtual.nome}.`
  );

  if (idPessoa === usuarioAtualId) {
    usuarioAtual.pacotes = novoTotal;
    atualizarContadorPacotes();
  }

  await atualizarGerencial();
  await atualizarRanking();
  await carregarLogs();
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
    chance = 3;
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

async function registrarLog(acao, detalhe = "") {
  if (!usuarioAtual) return;

  await db.from("logs").insert({
    usuario_nome: usuarioAtual.nome,
    acao,
    detalhe
  });
}

async function carregarLogs() {
  const lista = document.getElementById("listaLogs");

  if (!lista) return;

  const { data, error } = await db
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    lista.innerHTML = "<p>Erro ao carregar transparência.</p>";
    return;
  }

  lista.innerHTML = "";

  data.forEach(log => {
const data = new Date(log.created_at);
data.setHours(data.getHours() - 3);
const dataFormatada = data.toLocaleString("pt-BR");

    lista.innerHTML += `
      <div class="log-item">
        <strong class="log-user">${log.usuario_nome}</strong>
        <span class="log-action">${log.acao}</span>
        <p class="log-detail">${log.detalhe || ""}</p>
        <small>${dataFormatada}</small>
      </div>
    `;
  });
}


function abrirMenuMobile(){document.querySelector(".sidebar")?.classList.add("mobile-open");document.getElementById("menuBackdrop")?.classList.remove("hidden");document.getElementById("btnMenuMobile")?.classList.add("menu-open");}
function fecharMenuMobile(){document.querySelector(".sidebar")?.classList.remove("mobile-open");document.getElementById("menuBackdrop")?.classList.add("hidden");document.getElementById("btnMenuMobile")?.classList.remove("menu-open");}
document.getElementById("btnMenuMobile")?.addEventListener("click",()=>document.querySelector(".sidebar")?.classList.contains("mobile-open")?fecharMenuMobile():abrirMenuMobile());
function abrirModalSenha(userId,nome){if(!usuarioAtual?.admin)return alert("Somente administradores podem redefinir senhas.");usuarioSenhaSelecionado={userId,nome};document.getElementById("modalSenhaUserId").value=userId;document.getElementById("modalSenhaUsuario").textContent=nome;document.getElementById("novaSenhaAdmin").value="";document.getElementById("erroModalSenha").textContent="";document.getElementById("modalSenha").classList.remove("hidden");}
function fecharModalSenha(){document.getElementById("modalSenha")?.classList.add("hidden");usuarioSenhaSelecionado=null;}
async function confirmarRedefinicaoSenha(){if(!usuarioAtual?.admin||!usuarioSenhaSelecionado)return;const senha=document.getElementById("novaSenhaAdmin").value,erro=document.getElementById("erroModalSenha"),botao=document.getElementById("btnConfirmarNovaSenha");erro.textContent="";if(senha.length<6){erro.textContent="A senha precisa ter pelo menos 6 caracteres.";return;}botao.disabled=true;botao.textContent="Salvando...";const {data,error}=await db.functions.invoke("redefinir-senha",{body:{userId:usuarioSenhaSelecionado.userId,novaSenha:senha}});botao.disabled=false;botao.textContent="Salvar nova senha";if(error||data?.error){erro.textContent=data?.error||error?.message||"Não foi possível redefinir a senha.";return;}alert(`Senha de ${usuarioSenhaSelecionado.nome} redefinida com sucesso.`);fecharModalSenha();}
function renderizarParticipantesSorteio(usuarios){participantesSorteio=usuarios||[];const lista=document.getElementById("listaParticipantesSorteio"),total=document.getElementById("totalParticipantesSorteio");if(!lista||!total)return;total.textContent=participantesSorteio.length;lista.innerHTML=participantesSorteio.map(u=>`<span class="participant-chip"><span>${u.nome.charAt(0).toUpperCase()}</span>${u.nome}</span>`).join("");}
async function carregarSorteios(){const hist=document.getElementById("historicoSorteios"),res=document.getElementById("resultadoSorteio");if(!hist)return;const {data:usuarios}=await db.from("profiles").select("id,nome,setor").order("nome",{ascending:true});renderizarParticipantesSorteio(usuarios||[]);const {data,error}=await db.from("sorteios").select("*").order("created_at",{ascending:false}).limit(12);if(error){hist.innerHTML='<p class="empty-state">Execute o SQL de criação da tabela sorteios.</p>';return;}if(!data?.length){hist.innerHTML='<p class="empty-state">Nenhum sorteio realizado ainda.</p>';return;}const ultimo=data[0],nomesUltimo=(ultimo.sorteados||[]).map(i=>i.nome);if(res&&!sorteioEmAndamento)res.innerHTML=`<small>Último resultado</small><strong>${nomesUltimo.join(", ")}</strong>`;hist.innerHTML=data.map(s=>`<div class="draw-history-item"><strong>${(s.sorteados||[]).map(i=>i.nome).join(", ")}</strong><span>por ${s.admin_nome}</span><small>${new Date(s.created_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</small></div>`).join("");}
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animarRoleta(vencedores) {
  const wheel = document.getElementById("rouletteWheel");
  const nome = document.getElementById("rouletteName");
  const resultado = document.getElementById("resultadoSorteio");
  const card = document.querySelector(".roulette-card");
  const nomes = participantesSorteio.map(item => item.nome);

  if (!wheel || !nome || !resultado || nomes.length === 0) return;

  card?.classList.add("is-drawing");
  wheel.classList.remove("winner");
  wheel.classList.add("spinning");
  resultado.innerHTML = `
    <div class="draw-loading">
      <span></span><span></span><span></span>
      <strong>Sorteando funcionários...</strong>
    </div>
  `;

  const etapas = 30;

  for (let etapa = 0; etapa < etapas; etapa++) {
    const nomeAleatorio = nomes[Math.floor(Math.random() * nomes.length)] || "Sorteando...";
    nome.classList.remove("name-pop");
    void nome.offsetWidth;
    nome.textContent = nomeAleatorio;
    nome.classList.add("name-pop");

    const progresso = etapa / (etapas - 1);
    const atraso = 55 + Math.pow(progresso, 2.5) * 210;
    await esperar(atraso);
  }

  wheel.classList.remove("spinning");
  wheel.classList.add("winner");
  nome.textContent = "Temos vencedores!";
  nome.classList.remove("name-pop");
  void nome.offsetWidth;
  nome.classList.add("name-pop");

  await esperar(500);

  resultado.innerHTML = `
    <small class="winner-eyebrow">Resultado do sorteio</small>
    <div class="winner-list winner-list-fluid">
      ${vencedores.map((vencedor, index) => `
        <div class="winner-card winner-card-fluid" style="--winner-delay:${index * 120}ms">
          <div class="winner-number">${index + 1}</div>
          <div>
            <strong>${vencedor.nome}</strong>
            <small>${vencedor.setor}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  await esperar(700);
  card?.classList.remove("is-drawing");
}

async function sortearFuncionarios(){if(!usuarioAtual?.admin||sorteioEmAndamento)return;const quantidade=Number(document.getElementById("quantidadeSorteados").value),botao=document.getElementById("btnSortearFuncionarios");sorteioEmAndamento=true;botao.disabled=true;botao.textContent="Sorteando...";const {data,error}=await db.functions.invoke("sortear-funcionarios",{body:{quantidade}});if(error||data?.error){sorteioEmAndamento=false;botao.disabled=false;botao.textContent="Girar roleta";alert(data?.error||error?.message||"Não foi possível realizar o sorteio.");return;}await animarRoleta(data.sorteados||[]);sorteioEmAndamento=false;botao.disabled=false;botao.textContent="Girar novamente";await carregarSorteios();await carregarLogs();}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){fecharModalSenha();fecharMenuMobile();}});

async function carregarTudoOnline() {
  await carregarFigurinhasBanco();
  carregarFigurinhasDisponiveis();
  await carregarAlbumUsuario();
  await atualizarPerfilUsuario();

  atualizarAlbum();
  atualizarContadorPacotes();
  await atualizarRanking();
  await atualizarGerencial();
  await carregarSorteios();
  await carregarLogs();
}

async function verificarSessaoAtiva() {
  await carregarFigurinhasBanco();

  const { data } = await db.auth.getSession();

  if (data.session && data.session.user) {
    await carregarPerfil(data.session.user.id);
  }
}

verificarSessaoAtiva();
