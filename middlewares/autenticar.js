const jwt = require("jsonwebtoken");

// Barra quem não está logado. Se estiver, deixa o id do usuário em req.usuarioId.
function autenticar(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ erro: "Faça login para continuar." });
    }

    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET);
        req.usuarioId = sub;
        next();
    } catch {
        res.status(401).json({ erro: "Sessão expirada. Faça login novamente." });
    }
}

module.exports = autenticar;