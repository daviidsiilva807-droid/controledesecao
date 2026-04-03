(function () {
  const DB_KEY = "controleSecao_usuarios_v1";
  const SESSION_KEY = "controleSecao_sessao_v1";
  const ADMIN_LOGIN = "daviidsiilva807";
  const ADMIN_SENHA = "L4ndeH4ck@100";

  function normalizarLogin(login) {
    return (login || "").trim().toLowerCase();
  }

  function carregarUsuarios() {
    const bruto = localStorage.getItem(DB_KEY);
    if (!bruto) {
      return [];
    }

    try {
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
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
        criadoEm: new Date().toISOString(),
        criadoPor: "sistema"
      });
    } else {
      adminExistente.senha = ADMIN_SENHA;
      adminExistente.papel = "admin";
    }

    salvarUsuarios(usuarios);
  }

  function autenticar(login, senha) {
    garantirAdminPadrao();

    const loginNormalizado = normalizarLogin(login);
    const usuarios = carregarUsuarios();

    const usuario = usuarios.find((u) => normalizarLogin(u.login) === loginNormalizado && u.senha === senha);
    if (!usuario) {
      return { ok: false, mensagem: "Login ou senha invalidos." };
    }

    const sessao = {
      login: usuario.login,
      papel: usuario.papel,
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
    sair,
    exigirLogin,
    criarUsuarioVendedor,
    listarVendedores
  };
})();
