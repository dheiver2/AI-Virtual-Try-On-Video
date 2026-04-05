#!/bin/bash

# Script de configuração rápida para Virtual Try-On API
# Uso: bash setup.sh

echo "====================================="
echo "Virtual Try-On Setup"
echo "====================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado"
    echo "Instale de: https://nodejs.org"
    exit 1
fi

echo "✓ Node.js encontrado: $(node -v)"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

echo ""
echo "====================================="
echo "Configuração da API HuggingFace"
echo "====================================="
echo ""
echo "1. Acesse: https://huggingface.co/settings/tokens"
echo "2. Clique em 'New token'"
echo "3. Selecione 'Read' access"
echo "4. Copie o token gerado"
echo ""

# Tentar ler token do .env.local existente
if [ -f .env.local ]; then
    HF_TOKEN=$(grep HUGGINGFACE_API_KEY .env.local | cut -d'=' -f2)
    if [ -n "$HF_TOKEN" ] && [ "$HF_TOKEN" != "seu_token_aqui" ]; then
        echo "✓ Token já configurado no .env.local"
        echo ""
    fi
fi

# Se não houver token, solicitar
if [ -z "$HF_TOKEN" ] || [ "$HF_TOKEN" = "seu_token_aqui" ]; then
    read -p "Cole seu token HuggingFace: " HF_TOKEN

    if [ -z "$HF_TOKEN" ]; then
        echo "❌ Token não fornecido"
        exit 1
    fi

    # Criar/atualizar .env.local
    echo "HUGGINGFACE_API_KEY=$HF_TOKEN" > .env.local
    echo "✓ Token salvo em .env.local"
fi

echo ""
echo "====================================="
echo "Setup Completo! ✨"
echo "====================================="
echo ""
echo "Próximo passo:"
echo "  npm run dev"
echo ""
echo "Depois abra: http://localhost:5173"
echo ""
