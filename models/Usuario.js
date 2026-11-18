const mongoose = require("mongoose");

// Não há senha: quem confirma a identidade é o Google.
const usuarioSchema = new mongoose.Schema(
    {
        googleId: { type: String, required: true, unique: true }, // identificador fixo da conta Google
        nome: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        foto: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Usuario", usuarioSchema);