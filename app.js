require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const Produto = require("./models/Produto");
const Usuario = require("./models/Usuario");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/estoque";
const producao = process.env.NODE_ENV === "production";

// Aceita "https://site.com/caminho/" e usa só a origem ("https://site.com"), que é o que o CORS compara
function normalizarOrigem(origem) {
    try {
        return new URL(origem).origin;
    } catch {
        return origem;
    }
}

// O site publicado está sempre liberado. Os endereços de teste local só valem fora de produção.
const ORIGENS_PADRAO = [
    "https://almird863.github.io",
    ...(producao ? [] : ["http://localhost:5500", "http://127.0.0.1:5500"]),
];

// FRONTEND_URL (opcional) acrescenta outras origens, separadas por vírgula
const ORIGENS_EXTRAS = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean)
    .map(normalizarOrigem);

const ORIGENS_PERMITIDAS = [...new Set([...ORIGENS_PADRAO, ...ORIGENS_EXTRAS])];
console.log("Origens permitidas (CORS):", ORIGENS_PERMITIDAS.join(", "));

if (!process.env.JWT_SECRET || !process.env.GOOGLE_CLIENT_ID) {
    console.error("Defina JWT_SECRET e GOOGLE_CLIENT_ID no arquivo .env (veja o .env.example).");
    process.exit(1);
}

// credentials: true deixa o navegador enviar o cookie de sessão para esta API
app.use(cors({ origin: ORIGENS_PERMITIDAS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// API
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api", require("./routes/produtos"));
app.use("/api", (req, res) => {
    res.status(404).json({ erro: "Rota não encontrada" });
});

// Tratamento de erros
app.use((erro, req, res, next) => {
    console.error(erro);
    res.status(500).json({ erro: "Erro interno do servidor" });
});

async function iniciar() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB conectado");

        // Alinha os índices do banco com os modelos. Isso troca o antigo "código único no sistema todo"
        // por "código único por usuário", sem precisar mexer no MongoDB à mão.
        await Promise.all([Produto.syncIndexes(), Usuario.syncIndexes()]);

        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });
    } catch (erro) {
        console.error("Não foi possível iniciar o servidor:", erro.message);
        process.exit(1);
    }
}

iniciar();