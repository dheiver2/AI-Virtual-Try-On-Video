# Guia de Teste - Virtual Try-On com API Replicate 🚀

## Pré-requisitos

✅ Node.js instalado
✅ Token Replicate (gratuito)

---

## Passo 1: Obter Token Replicate

1. Acesse [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. Faça login ou crie uma conta (gratuita - $200 crédito!)
3. Você verá seu token de API (começará com `r8_`)
4. **Copie o token**

---

## Passo 2: Configurar Variável de Ambiente

### Option A: Via Arquivo `.env.local` (Recomendado)

Crie ou edite `.env.local` na raiz do projeto:

```env
REPLICATE_API_TOKEN=r8_sua_chave_aqui_muito_longa_xyz123abc
```

### Option B: Via Variável de Ambiente do Sistema

**Windows (PowerShell):**
```powershell
$env:REPLICATE_API_TOKEN="r8_sua_chave_aqui"
npm run dev
```

**Windows (CMD):**
```cmd
set REPLICATE_API_TOKEN=r8_sua_chave_aqui
npm run dev
```

**Linux/Mac:**
```bash
export REPLICATE_API_TOKEN=r8_sua_chave_aqui
npm run dev
```

---

## Passo 3: Preparar Arquivos de Teste

Você já tem os arquivos:
- **Imagem de roupa**: Imagem da mulher em roupa esportiva (Download.mp4 ou similar)
- **Vídeo de referência**: `Download.mp4`

### ✨ Ou use esses exemplos:

1. **Roupa (Imagem)**
   - Baixe uma imagem de roupa em alta resolução
   - Formatos: JPG, PNG
   - Tamanho recomendado: <5MB

2. **Vídeo (Referência)**
   - Use um vídeo curto (10-30 segundos)
   - Formato: MP4, MOV
   - Tamanho máximo: 512MB
   - Pelo menos uma pessoa visível em movimento

---

## Passo 4: Iniciar a Aplicação

```bash
npm run dev
```

Você verá algo como:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## Passo 5: Testar a Interface

1. **Abra** http://localhost:5173 no navegador
2. **Clique** em "Começar Agora"
3. **Upload "Look da Marca"** (a imagem de roupa)
4. **Upload "Vídeo da Influencer"** (o vídeo de referência)
5. **Ajuste a descrição** (opcional)
6. **Clique** em "Criar Conteúdo com Influencer"
7. **Aguarde** 30-60 segundos

---

## Passo 6: Verificar Resultado

✅ Se funcionou:
- Você verá o vídeo processado na aba "Saída"
- Poderá fazer download com o botão de controle do vídeo

❌ Se receber erro:

### Erro: "Configure REPLICATE_API_TOKEN"
- Verifique se `.env.local` existe
- Verifique se o token está correto em https://replicate.com/account/api-tokens
- Reinicie o servidor: `npm run dev`

### Erro: "Timeout: processamento levou muito tempo"
- Replicate pode estar processando lentamente
- Tente novamente em alguns minutos

### Erro: "Erro ao iniciar processamento"
- Token inválido ou expirado
- Copie um novo token de https://replicate.com/account/api-tokens

---

## Teste Rápido com Script

```bash
# Valida configuração dos arquivos
node test-api.js ./Downloads/clothing.jpg ./Downloads/video.mp4
```

---

## Limitações do Tier Gratuito Replicate

| Limite | Valor |
|--------|-------|
| **Créditos iniciais** | $200 grátis (suficiente para ~400 tentativas) |
| **Duração máxima** | 60 segundos por processamento |
| **Tamanho de arquivo** | Sem limite aparente |
| **Modelo** | IDM-VTON (melhor qualidade) |
| **Velocidade** | Pode haver fila em horários de pico |

---

## Dicas de Sucesso 💡

1. **Imagem de roupa**: Use uma imagem clara e bem iluminada
2. **Vídeo**: Certifique-se de que a pessoa está bem visível
3. **Conexão**: Mantenha uma conexão estável com a internet
4. **Tamanho**: Redimensione vídeos grandes antes de enviar

---

## Próximas Etapas

- [ ] Testar com suas próprias imagens de roupas
- [ ] Personalizar a descrição da transformação
- [ ] Gerar múltiplos vídeos com diferentes roupas
- [ ] Integrar com sua loja online

---

## Suporte

- **Erro no HuggingFace Token?** → [Documentação HF](https://huggingface.co/docs/hub/security-tokens)
- **Dúvidas sobre Virtual Try-On?** → [HuggingFace Spaces](https://huggingface.co/spaces)
- **Issues do Projeto?** → Verifique o GitHub

---

**Bom teste! 🎬✨**
