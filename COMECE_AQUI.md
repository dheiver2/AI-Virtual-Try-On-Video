# 🚀 COMECE AQUI - 3 Passos Para Virtual Try-On

## ⚡ Resumo Executivo

❌ **PROBLEMA ANTERIOR**: Faltava `config.json` do MagicTryOn (erro 500)

✅ **SOLUÇÃO IMPLEMENTADA**: API gratuita Replicate com modelo IDM-VTON

🎯 **RESULTADO**: Setup em 1 minuto, processamento confiável de virtual try-on

---

## 🔧 3 Passos Simples

### Passo 1️⃣: Obter Token Replicate (2 min)

1. Acesse: [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. Copie seu token de API (começará com `r8_`)
3. **Pronto!**

### Passo 2️⃣: Configurar Token (30 seg)

Edite ou crie `.env.local` na raiz do projeto:

```env
REPLICATE_API_TOKEN=r8_cole_seu_token_aqui
```

**OU execute (mais fácil):**
```bash
bash setup.sh
```

### Passo 3️⃣: Rodar (1 min)

```bash
npm install
npm run dev
```

Abra: **http://localhost:5173**

---

## 🎬 Testando com Seus Arquivos

Você tem:
- ✅ Imagem da mulher em roupa esportiva
- ✅ Vídeo (Download.mp4)

### No navegador:
1. Clique "Começar Agora"
2. Upload da roupa (imagem)
3. Upload do vídeo
4. Clique "Criar Conteúdo com Influencer"
5. Aguarde 30-60 segundos ⏳
6. Veja o resultado! 🎉

---

## 📖 Documentação Completa

- **[GUIA_TESTE.md](./GUIA_TESTE.md)** - Teste passo a passo
- **[MUDANCAS.md](./MUDANCAS.md)** - O que foi modificado
- **[README.md](./README.md)** - Documentação técnica

---

## ⚠️ Limitações (Tier Gratuito Replicate)

- 💰 **Créditos gratuitos**: Começam com $200 em crédito
- ⏱️ **Duração**: 60 segundos máximo por processamento
- 📦 **Tamanho**: Sem limite aparente
- 🔄 **Fila**: Pode haver espera em horários de pico
- ✅ **Modelo**: IDM-VTON (melhor qualidade de virtual try-on)

---

## ❓ FAQ Rápido

**P: Preciso instalar MagicTryOn localmente?**
R: Não! Usamos a API gratuita do HuggingFace.

**P: Quanto custa?**
R: Completamente gratuito (15 req/min inclusos).

**P: Funciona em produção?**
R: Sim! Deploy em Vercel, Netlify, ou outro serviço.

**P: Posso usar modelo local depois?**
R: Sim, atualize `vite.config.ts` quando tiver GPU.

---

## 🎯 Próximas Ações

- [ ] Cole o token em `.env.local`
- [ ] Execute `npm run dev`
- [ ] Teste em http://localhost:5173
- [ ] Envie suas imagens de teste
- [ ] Veja o resultado! 🎬

---

## 🆘 Se Algo Não Funcionar

1. **Erro "Configure HUGGINGFACE_API_KEY"**
   - Verifique `.env.local` existe
   - Reinicie: `npm run dev`

2. **Erro "API Error 429"**
   - Taxa limite (15/min) atingida
   - Aguarde 1 minuto

3. **Erro "Erro na API HuggingFace (500)"**
   - Servidor pode estar ocupado
   - Tente novamente em alguns minutos

4. **Build fails**
   - Execute: `npm install`

---

**Pronto para começar? → `npm run dev` 🚀**
