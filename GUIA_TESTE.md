# Guia de Teste - Virtual Try-On com API Gratuita 🚀

## Pré-requisitos

✅ Node.js instalado
✅ Token HuggingFace (gratuito)

---

## Passo 1: Obter Token HuggingFace

1. Acesse [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Faça login ou crie uma conta (gratuita)
3. Clique em **"New token"**
4. Dê um nome: `virtual-tryon-app`
5. Role de "Read" ↔️ Configure com permissão "Read"
6. Clique em **"Generate a token"**
7. **Copie o token** (será exibido uma única vez)

---

## Passo 2: Configurar Variável de Ambiente

### Option A: Via Arquivo `.env.local` (Recomendado)

Crie ou edite `.env.local` na raiz do projeto:

```env
HUGGINGFACE_API_KEY=hf_sua_chave_aqui_muito_longa_xyz123abc
```

### Option B: Via Variável de Ambiente do Sistema

**Windows (PowerShell):**
```powershell
$env:HUGGINGFACE_API_KEY="hf_sua_chave_aqui"
npm run dev
```

**Windows (CMD):**
```cmd
set HUGGINGFACE_API_KEY=hf_sua_chave_aqui
npm run dev
```

**Linux/Mac:**
```bash
export HUGGINGFACE_API_KEY=hf_sua_chave_aqui
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

### Erro: "Configure HUGGINGFACE_API_KEY"
- Verifique se `.env.local` existe
- Reinicie o servidor: `npm run dev`

### Erro: "API Error 429"
- Sua cota de requisições expirou
- Aguarde alguns minutos

### Erro: "Erro na API HuggingFace (500)"
- A API pode estar sobrecarregada
- Tente novamente em alguns minutos
- Ou acesse [HuggingFace Spaces](https://huggingface.co/spaces) para testar diretamente

---

## Teste Rápido com Script

```bash
# Valida configuração dos arquivos
node test-api.js ./Downloads/clothing.jpg ./Downloads/video.mp4
```

---

## Limitações da API Gratuita

| Limite | Valor |
|--------|-------|
| **Taxa** | 15 requisições/minuto |
| **Tamanho máx** | 512MB por vídeo |
| **Tempo processamento** | 30-60 segundos |
| **Tipo processamento** | Virtual try-on de imagem |

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
