<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Virtual Try-On (HuggingFace API Gratuita)

## ⚡ Configuração Rápida

**Pré-requisitos**
- Node.js
- Token gratuito do HuggingFace

### Passos

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Obtenha um Token HuggingFace Gratuito**
   - Acesse [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   - Clique em "New token"
   - Selecione "Read" access
   - Copie o token gerado

3. **Configure o Token**

   Abra ou crie `.env.local`:
   ```env
   HUGGINGFACE_API_KEY=seu_token_aqui
   ```

4. **Inicie o Servidor**
   ```bash
   npm run dev
   ```

5. **Acesse a Aplicação**
   - Abra http://localhost:5173
   - Upload da roupa (imagem)
   - Upload do vídeo de referência
   - Clique "Criar Conteúdo com Influencer"

## 🎯 Como Usar

1. **Look da Marca**: Selecione a imagem da roupa desejada
2. **Vídeo da Influencer**: Selecione um vídeo com uma pessoa em movimento
3. **Descrição**: Customize a descrição da transformação (opcional)
4. **Gerar**: Clique para processar
5. **Resultado**: Baixe o vídeo processado

## 📊 Limitações da API Gratuita

- **Rate Limit**: 15 requisições por minuto
- **Tempo**: 30-60 segundos por vídeo
- **Tamanho**: Máximo 512MB por requisição
- **Fila**: Pode haver espera durante picos de uso

## 🔧 Solução de Problemas

**Erro: "Configure HUGGINGFACE_API_KEY"**
- Verificar se `.env.local` foi criado corretamente
- Verificar se o token está válido no [dashboard HuggingFace](https://huggingface.co/settings/tokens)

**Erro: "API Error 429"**
- Rate limit excedido, aguarde alguns segundos
- Use a API mais tarde se houver fila

**Erro: "Erro na API HuggingFace"**
- Verifique a conexão com internet
- Tente novamente em alguns minutos
