const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const Usuario = require("../models/Usuario");
const autenticar = require("../middlewares/autenticar");

const router = express.Router();
const clienteGoogle = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
const producao = process.env.NODE_ENV === "production";

// httpOnly: o JavaScript da página não consegue ler o cookie (protege contra roubo por XSS)
// Em produção, com front e API em domínios diferentes, o cookie precisa de sameSite "none" + secure
const opcoesCookie = {
    httpOnly: true,
    secure: producao,
    sameSite: producao ? "none" : "lax",
    path: "/",
};

// Só o que o front-end precisa saber sobre o usuário
function dadosPublicos(usuario) {
    return { _id: usuario._id, nome: usuario.nome, email: usuario.email, foto: usuario.foto };
}

// POST /api/usuarios/google -> login e cadastro (o usuário é criado no primeiro acesso)
router.post("/google", async (req, res, next) => {
    try {
        const { credencial } = req.body;
        if (!credencial) {
            return res.status(400).json({ erro: "Credencial do Google não enviada." });
        }

        // Confere com o Google se o token é verdadeiro, não expirou e foi emitido para ESTE aplicativo
        let dados;
        try {
            const ticket = await clienteGoogle.verifyIdToken({
                idToken: credencial,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            dados = ticket.getPayload();
        } catch (erro) {
            return res.status(401).json({ erro: "Não foi possível validar o login com o Google." });
        }

        if (!dados.email_verified) {
            return res.status(401).json({ erro: "O e-mail desta conta Google não está verificado." });
        }

        // Acha o usuário pelo googleId; se não existir, cria (upsert) e, se existir, atualiza nome/foto
        const usuario = await Usuario.findOneAndUpdate(
            { googleId: dados.sub },
            { $set: { nome: dados.name || dados.email, email: dados.email, foto: dados.picture || "" } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true }
        ).lean();

        const token = jwt.sign({ sub: usuario._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        res.cookie("token", token, { ...opcoesCookie, maxAge: SETE_DIAS });
        res.json(dadosPublicos(usuario));
    } catch (erro) {
        if (erro.code === 11000) {
            return res.status(409).json({ erro: "Já existe um usuário cadastrado com este e-mail." });
        }
        next(erro);
    }
});

// GET /api/usuarios/eu -> quem está logado (o front usa para saber se a sessão vale)
router.get("/eu", autenticar, async (req, res, next) => {
    try {
        const usuario = await Usuario.findById(req.usuarioId).lean();

        if (!usuario) {
            res.clearCookie("token", opcoesCookie);
            return res.status(401).json({ erro: "Usuário não encontrado. Faça login novamente." });
        }

        res.json(dadosPublicos(usuario));
    } catch (erro) {
        next(erro);
    }
});

// POST /api/usuarios/sair -> apaga o cookie de sessão
router.post("/sair", (req, res) => {
    res.clearCookie("token", opcoesCookie);
    res.status(204).end();
});

module.exports = router;