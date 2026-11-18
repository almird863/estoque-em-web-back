const mongoose = require("mongoose");

const produtoSchema = new mongoose.Schema(
    {
        // Dono do produto: cada usuário só enxerga os próprios produtos
        usuario: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
        codigo: { type: String, required: true, trim: true },
        nome: { type: String, required: true, trim: true },
        categoria: { type: String, required: true, trim: true },
        quantidade: { type: Number, required: true, min: 0, default: 0 },
        // Quando a quantidade fica igual ou abaixo disso, o produto conta como "estoque baixo"
        estoqueMinimo: { type: Number, min: 0, default: 10 },
    },
    { timestamps: true }
);

// O código só precisa ser único dentro do estoque de cada usuário
// (dois usuários podem ter, cada um, o seu produto "001")
produtoSchema.index({ usuario: 1, codigo: 1 }, { unique: true });

module.exports = mongoose.model("Produto", produtoSchema);