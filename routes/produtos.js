const express = require("express");
const mongoose = require("mongoose");
const Produto = require("../models/Produto");

const router = express.Router();

// Ordena códigos como números ("2" antes de "10"), mesmo guardados como texto
const ORDEM_NUMERICA = { locale: "pt", numericOrdering: true };

function comEstoqueBaixo(produto) {
    return { ...produto, estoqueBaixo: produto.quantidade <= produto.estoqueMinimo };
}

// Confere os dados enviados no cadastro. Devolve { dados } ou { erro }.
function validarProduto(corpo) {
    const nome = String(corpo.nome ?? "").trim();
    const categoria = String(corpo.categoria ?? "").trim();

    const vazio = (valor) => valor === undefined || valor === null || valor === "";
    const quantidade = vazio(corpo.quantidade) ? NaN : Number(corpo.quantidade);
    const estoqueMinimo = vazio(corpo.estoqueMinimo) ? 10 : Number(corpo.estoqueMinimo);

    if (!nome) return { erro: "Informe o nome do produto." };
    if (!categoria) return { erro: "Escolha uma categoria." };
    if (!Number.isInteger(quantidade) || quantidade < 0) {
        return { erro: "A quantidade deve ser um número inteiro, de 0 para cima." };
    }
    if (!Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
        return { erro: "O estoque mínimo deve ser um número inteiro, de 0 para cima." };
    }

    return { dados: { nome, categoria, quantidade, estoqueMinimo } };
}

// Próximo código sequencial: "001", "002", ...
async function gerarCodigo() {
    const ultimo = await Produto.findOne()
        .sort({ codigo: -1 })
        .collation(ORDEM_NUMERICA)
        .lean();

    const proximo = ultimo ? parseInt(ultimo.codigo, 10) + 1 : 1;
    return String(Number.isNaN(proximo) ? 1 : proximo).padStart(3, "0");
}

// GET /api/produtos -> lista todos os produtos
router.get("/produtos", async (req, res, next) => {
    try {
        const produtos = await Produto.find().sort({ codigo: 1 }).collation(ORDEM_NUMERICA).lean();
        res.json(produtos.map(comEstoqueBaixo));
    } catch (erro) {
        next(erro);
    }
});

// POST /api/produtos -> cadastra um produto novo
router.post("/produtos", async (req, res, next) => {
    try {
        const { dados, erro } = validarProduto(req.body);
        if (erro) {
            return res.status(400).json({ erro });
        }

        const produto = await Produto.create({ ...dados, codigo: await gerarCodigo() });

        res.status(201).json(comEstoqueBaixo(produto.toObject()));
    } catch (erro) {
        // 11000 = código duplicado (dois cadastros ao mesmo tempo)
        if (erro.code === 11000) {
            return res.status(409).json({ erro: "Outro produto foi cadastrado ao mesmo tempo. Tente de novo." });
        }
        next(erro);
    }
});

// PUT /api/produtos/:id -> atualiza um produto existente (o código não muda)
router.put("/produtos/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ erro: "Identificador de produto inválido." });
        }

        const { dados, erro } = validarProduto(req.body);
        if (erro) {
            return res.status(400).json({ erro });
        }

        const produto = await Produto.findByIdAndUpdate(id, dados, {
            returnDocument: "after", // devolve o produto já atualizado
            runValidators: true,
        }).lean();

        if (!produto) {
            return res.status(404).json({ erro: "Produto não encontrado. Ele pode ter sido removido." });
        }

        res.json(comEstoqueBaixo(produto));
    } catch (erro) {
        next(erro);
    }
});

// DELETE /api/produtos/:id -> exclui um produto
router.delete("/produtos/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ erro: "Identificador de produto inválido." });
        }

        const produto = await Produto.findByIdAndDelete(id);
        if (!produto) {
            return res.status(404).json({ erro: "Produto não encontrado. Ele pode já ter sido removido." });
        }

        res.status(204).end(); // 204 = deu certo, sem conteúdo para devolver
    } catch (erro) {
        next(erro);
    }
});

// GET /api/resumo -> números para o bloco "Resumo"
router.get("/resumo", async (req, res, next) => {
    try {
        const [resultado] = await Produto.aggregate([
            {
                $group: {
                    _id: null,
                    totalProdutos: { $sum: 1 },
                    totalUnidades: { $sum: "$quantidade" },
                    estoqueBaixo: {
                        $sum: {
                            $cond: [{ $lte: ["$quantidade", "$estoqueMinimo"] }, 1, 0],
                        },
                    },
                },
            },
            { $project: { _id: 0 } },
        ]);

        res.json(resultado || { totalProdutos: 0, totalUnidades: 0, estoqueBaixo: 0 });
    } catch (erro) {
        next(erro);
    }
});

module.exports = router;