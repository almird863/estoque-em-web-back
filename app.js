require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors")

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGO_URI 
const ORIGENS_PERMITIDAS = "http://localhost:5500,http://127.0.0.1:5500"
    .split(",")
    .map((origem) => origem.trim());

app.use(cors({ origin: ORIGENS_PERMITIDAS}))
app.use(express.json());

// API
app.use("/api", require("./routes/produtos"))
app.use("/api", (req, res) => {
    res.status(404).json({ erro: "Rota não encontrada" });
});

// Tratamento de erros
app.use((erro, req, res, next) => {
    console.error(erro);
    res.status(500).json({ erro: "Erro interno do servidor" });
});

mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log("MongoDB conectado");
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });
    })
    .catch((erro) => {
        console.error("Não foi possível conectar ao MongoDB:", erro.message);
        process.exit(1);
    });