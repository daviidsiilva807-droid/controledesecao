(function () {
  const DB_KEY = "controleSecao_usuarios_v1";
  const SESSION_KEY = "controleSecao_sessao_v1";
  const ADMIN_LOGIN = "daviidsiilva807";
  const ADMIN_SENHA = "L4ndeH4ck@100";
  const DIA_EM_MS = 1000 * 60 * 60 * 24;
  const PLANOS = {
    30: { dias: 30, valor: 20 },
    90: { dias: 90, valor: 50 }
  };

  function normalizarLogin(login) {
    return (login || "").trim().toLowerCase();
  }

  function obterPlanoPadrao(dias) {
    return PLANOS[dias] || PLANOS[30];
  }

  function adicionarDias(data, dias) {
    const dataBase = new Date(data);
    dataBase.setDate(dataBase.getDate() + dias);
    return dataBase.toISOString();
  }

  function calcularDiasRestantes(dataFim) {
    if (!dataFim) {
      return 0;
    }

    const diferenca = new Date(dataFim).getTime() - Date.now();
    return Math.max(0, Math.ceil(diferenca / DIA_EM_MS));
  }

  function sincronizarVencimentos(usuarios) {
    const agora = Date.now();

    usuarios.forEach((usuario) => {
      if (normalizarLogin(usuario.login) === normalizarLogin(ADMIN_LOGIN)) {
        usuario.ativo = true;
        usuario.vitalicio = true;
        usuario.planoDias = null;
        usuario.planoValor = null;
        usuario.assinaturaInicioEm = usuario.assinaturaInicioEm || new Date().toISOString();
        usuario.assinaturaFimEm = null;
        usuario.motivoBloqueio = "";
        return;
      }

      if (usuario.ativo && usuario.assinaturaFimEm && new Date(usuario.assinaturaFimEm).getTime() < agora) {
        usuario.ativo = false;
        usuario.motivoBloqueio = "Plano vencido por falta de pagamento.";
        usuario.desativadoEm = new Date().toISOString();
        usuario.desativadoPor = "sistema";
      }
    });
  }

  function normalizarUsuario(usuario) {
    const plano = obterPlanoPadrao(Number(usuario.planoDias) || 30);

    return {
      ...usuario,
      login: normalizarLogin(usuario.login),
      papel: usuario.papel || "vendedor",
      ativo: Boolean(usuario.ativo),
      vitalicio: Boolean(usuario.vitalicio),
      planoDias: Number(usuario.planoDias) || plano.dias,
      planoValor: Number(usuario.planoValor) || plano.valor,
      assinaturaInicioEm: usuario.assinaturaInicioEm || null,
      assinaturaFimEm: usuario.assinaturaFimEm || null,
      criadoEm: usuario.criadoEm || new Date().toISOString(),
      criadoPor: usuario.criadoPor || "sistema",
      motivoBloqueio: usuario.motivoBloqueio || ""
    };
  }

  function carregarUsuarios() {
    const bruto = localStorage.getItem(DB_KEY);
    if (!bruto) {
      return [];
    }

    try {
      const dados = JSON.parse(bruto);
      const usuarios = Array.isArray(dados) ? dados.map(normalizarUsuario) : [];
      sincronizarVencimentos(usuarios);
      salvarUsuarios(usuarios);
      return usuarios;
    } catch (erro) {
      return [];
    }
  }

  function salvarUsuarios(usuarios) {
    localStorage.setItem(DB_KEY, JSON.stringify(usuarios));
  }

  function garantirAdminPadrao() {
    const usuarios = carregarUsuarios();
    const adminLogin = normalizarLogin(ADMIN_LOGIN);

    // Migra o admin antigo padrao para vendedor para evitar dois admins padrao ativos.
    usuarios.forEach((u) => {
      if (normalizarLogin(u.login) === "daviidsiilva" && u.papel === "admin") {
        u.papel = "vendedor";
      }
    });

    const adminExistente = usuarios.find((u) => normalizarLogin(u.login) === adminLogin);
    if (!adminExistente) {
      usuarios.push({
        login: adminLogin,
        senha: ADMIN_SENHA,
        papel: "admin",
        ativo: true,
        vitalicio: true,
        planoDias: null,
        planoValor: null,
        assinaturaInicioEm: new Date().toISOString(),
        assinaturaFimEm: null,
        criadoEm: new Date().toISOString(),
        criadoPor: "sistema"
      });
    } else {
      adminExistente.senha = ADMIN_SENHA;
      adminExistente.papel = "admin";
      adminExistente.ativo = true;
      adminExistente.vitalicio = true;
      adminExistente.planoDias = null;
      adminExistente.planoValor = null;
      if (!adminExistente.assinaturaInicioEm) {
        adminExistente.assinaturaInicioEm = new Date().toISOString();
      }
      adminExistente.assinaturaFimEm = null;
    }

    salvarUsuarios(usuarios);
  }

  function obterUsuario(login) {
    garantirAdminPadrao();
    const loginNormalizado = normalizarLogin(login);
    return carregarUsuarios().find((u) => normalizarLogin(u.login) === loginNormalizado) || null;
  }

  function obterStatusUsuario(login) {
    const usuario = obterUsuario(login);
    if (!usuario) {
      return null;
    }

    const diasRestantes = usuario.ativo ? calcularDiasRestantes(usuario.assinaturaFimEm) : 0;
    const vencido = usuario.ativo && diasRestantes === 0 && usuario.assinaturaFimEm && new Date(usuario.assinaturaFimEm).getTime() < Date.now();

    return {
      login: usuario.login,
      ativo: usuario.ativo,
      vitalicio: Boolean(usuario.vitalicio),
      vencido,
      status: !usuario.ativo ? "desativado" : usuario.vitalicio ? "vitalicio" : vencido ? "vencido" : "ativo",
      planoDias: usuario.planoDias,
      planoValor: usuario.planoValor,
      assinaturaInicioEm: usuario.assinaturaInicioEm,
      assinaturaFimEm: usuario.assinaturaFimEm,
      diasRestantes: usuario.vitalicio ? null : diasRestantes,
      mensagem: !usuario.ativo
        ? (usuario.motivoBloqueio || "Usuario desativado por falta de pagamento.")
        : usuario.vitalicio
          ? "Usuario vitalicio. Acesso liberado sem vencimento."
        : vencido
          ? "Plano vencido. Regularize o pagamento para voltar a acessar."
          : `Plano ativo. Faltam ${diasRestantes} dia(s) para vencer.`
    };
  }

  function ativarUsuario(login, diasPlano, ativadoPor) {
    garantirAdminPadrao();
    const loginNormalizado = normalizarLogin(login);
    const usuarios = carregarUsuarios();
    const usuario = usuarios.find((u) => normalizarLogin(u.login) === loginNormalizado);

    if (!usuario) {
      return { ok: false, mensagem: "Usuario nao encontrado." };
    }

    if (normalizarLogin(usuario.login) === normalizarLogin(ADMIN_LOGIN)) {
      return { ok: false, mensagem: "O usuario administrador e vitalicio e nao pode receber plano." };
    }

    const plano = obterPlanoPadrao(Number(diasPlano) || 30);
    const agora = new Date().toISOString();

    usuario.ativo = true;
    usuario.planoDias = plano.dias;
    usuario.planoValor = plano.valor;
    usuario.assinaturaInicioEm = agora;
    usuario.assinaturaFimEm = adicionarDias(agora, plano.dias);
    usuario.motivoBloqueio = "";
    usuario.desativadoEm = null;
    usuario.desativadoPor = null;
    usuario.ativadoEm = agora;
    usuario.ativadoPor = ativadoPor || "admin";

    salvarUsuarios(usuarios);
    return { ok: true, mensagem: `Usuario ativado no plano de ${plano.dias} dias.` };
  }

  function desativarUsuario(login, motivo, desativadoPor) {
    garantirAdminPadrao();
    const loginNormalizado = normalizarLogin(login);
    const usuarios = carregarUsuarios();
    const usuario = usuarios.find((u) => normalizarLogin(u.login) === loginNormalizado);

    if (!usuario) {
      return { ok: false, mensagem: "Usuario nao encontrado." };
    }

    if (normalizarLogin(usuario.login) === normalizarLogin(ADMIN_LOGIN)) {
      return { ok: false, mensagem: "O usuario administrador e vitalicio e nao pode ser desativado." };
    }

    usuario.ativo = false;
    usuario.motivoBloqueio = motivo || "Usuario desativado por falta de pagamento.";
    usuario.desativadoEm = new Date().toISOString();
    usuario.desativadoPor = desativadoPor || "admin";

    salvarUsuarios(usuarios);
    return { ok: true, mensagem: "Usuario desativado com sucesso." };
  }

  function autenticar(login, senha) {
    garantirAdminPadrao();

    const loginNormalizado = normalizarLogin(login);
    const usuarios = carregarUsuarios();

    const usuario = usuarios.find((u) => normalizarLogin(u.login) === loginNormalizado && u.senha === senha);
    if (!usuario) {
      return { ok: false, mensagem: "Login ou senha invalidos." };
    }

    const status = obterStatusUsuario(usuario.login);
    if (status && !status.ativo) {
      return { ok: false, mensagem: status.mensagem };
    }

    const sessao = {
      login: usuario.login,
      papel: usuario.papel,
      vitalicio: Boolean(usuario.vitalicio),
      planoDias: usuario.vitalicio ? null : (usuario.planoDias || 30),
      planoValor: usuario.vitalicio ? null : (usuario.planoValor || 20),
      assinaturaInicioEm: usuario.assinaturaInicioEm || null,
      assinaturaFimEm: usuario.assinaturaFimEm || null,
      diasRestantes: status ? status.diasRestantes : 0,
      dataLogin: new Date().toISOString()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
    return { ok: true, usuario: sessao };
  }

  function obterSessao() {
    const bruto = localStorage.getItem(SESSION_KEY);
    if (!bruto) {
      return null;
    }

    try {
      return JSON.parse(bruto);
    } catch (erro) {
      return null;
    }
  }

  function sair() {
    localStorage.removeItem(SESSION_KEY);
  }

  function exigirLogin() {
    garantirAdminPadrao();
    const sessao = obterSessao();
    if (!sessao) {
      window.location.href = "index.html";
      return null;
    }

    const status = obterStatusUsuario(sessao.login);
    if (status && !status.ativo) {
      sair();
      window.location.href = "index.html";
      return null;
    }

    if (status) {
      sessao.diasRestantes = status.diasRestantes;
      sessao.planoDias = status.planoDias;
      sessao.planoValor = status.planoValor;
      sessao.assinaturaFimEm = status.assinaturaFimEm;
      sessao.vitalicio = status.vitalicio;
    }

    return sessao;
  }

  function criarUsuarioVendedor(login, senha, criadoPor) {
    garantirAdminPadrao();

    const loginNormalizado = normalizarLogin(login);
    if (!loginNormalizado) {
      return { ok: false, mensagem: "Informe um login." };
    }

    if (!senha || senha.trim().length < 4) {
      return { ok: false, mensagem: "A senha precisa ter pelo menos 4 caracteres." };
    }

    const usuarios = carregarUsuarios();
    const jaExiste = usuarios.some((u) => normalizarLogin(u.login) === loginNormalizado);
    if (jaExiste) {
      return { ok: false, mensagem: "Esse login ja existe." };
    }

    usuarios.push({
      login: loginNormalizado,
      senha: senha.trim(),
      papel: "vendedor",
      ativo: false,
      vitalicio: false,
      planoDias: 30,
      planoValor: 20,
      assinaturaInicioEm: null,
      assinaturaFimEm: null,
      criadoEm: new Date().toISOString(),
      criadoPor: criadoPor || "admin"
    });

    salvarUsuarios(usuarios);
    return { ok: true, mensagem: "Vendedor cadastrado com sucesso." };
  }

  function listarVendedores() {
    garantirAdminPadrao();
    return carregarUsuarios().filter((u) => u.papel === "vendedor");
  }

  window.AuthDB = {
    garantirAdminPadrao,
    autenticar,
    obterSessao,
    obterUsuario,
    obterStatusUsuario,
    ativarUsuario,
    desativarUsuario,
    sair,
    exigirLogin,
    criarUsuarioVendedor,
    listarVendedores
  };
})();
