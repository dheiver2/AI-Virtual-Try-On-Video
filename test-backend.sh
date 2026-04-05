#!/bin/bash
# Teste direto do backend Replicate (sem precisar do frontend)
# Uso: bash test-backend.sh

set -e

# Ler token do .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "❌ REPLICATE_API_TOKEN não encontrado no .env.local"
  exit 1
fi

TOKEN="$REPLICATE_API_TOKEN"
API="https://api.replicate.com/v1/predictions"

echo "══════════════════════════════════════════════"
echo "  Teste Backend Virtual Try-On (Replicate)    "
echo "══════════════════════════════════════════════"
echo ""

# ── Teste 1: Verificar token ──
echo "▶ Verificando token Replicate..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token $TOKEN" \
  "$API?limit=1")

if [ "$STATUS" = "200" ]; then
  echo "  ✓ Token válido!"
else
  echo "  ❌ Token inválido (HTTP $STATUS)"
  exit 1
fi
echo ""

# ── Teste 2: IDM-VTON com imagens de teste ──
echo "▶ Testando IDM-VTON (try-on de imagem)..."
echo "  Enviando prediction..."

TRYON_RESP=$(curl -s -X POST "$API" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985",
    "input": {
      "human_img": "https://replicate.delivery/pbxt/KgxMaMljFpGFDre40bJBOKmFAL68smTOiHBpbFNAxwMVKR0p/image.png",
      "garm_img": "https://replicate.delivery/pbxt/KgxMbxbNMKBaHFB8PP0wmmYNSOj7vD1dmwMxrCCwBRxNkQ8B/garment.png",
      "garment_des": "Short Sleeve Round Neck T-shirt",
      "category": "upper_body",
      "crop": true,
      "steps": 30,
      "seed": 42
    }
  }')

TRYON_ID=$(echo "$TRYON_RESP" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
TRYON_STATUS=$(echo "$TRYON_RESP" | python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
TRYON_ERROR=$(echo "$TRYON_RESP" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail','') or d.get('error',''))" 2>/dev/null || echo "")

if [ -z "$TRYON_ID" ] || [ "$TRYON_ID" = "None" ]; then
  echo "  ❌ Falha ao criar prediction IDM-VTON"
  echo "  Resposta: $TRYON_RESP"
  exit 1
fi

echo "  ✓ Prediction criada: $TRYON_ID (status: $TRYON_STATUS)"
echo "  Aguardando resultado (máx 5min)..."

# Polling
for i in $(seq 1 60); do
  sleep 5
  POLL=$(curl -s -H "Authorization: Token $TOKEN" "$API/$TRYON_ID")
  S=$(echo "$POLL" | python -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")

  if [ "$S" = "succeeded" ]; then
    OUTPUT=$(echo "$POLL" | python -c "import sys,json; o=json.load(sys.stdin)['output']; print(o if isinstance(o,str) else o[0])" 2>/dev/null || echo "")
    echo "  ✓ IDM-VTON sucesso!"
    echo "  Resultado: $OUTPUT"
    break
  elif [ "$S" = "failed" ] || [ "$S" = "canceled" ]; then
    ERR=$(echo "$POLL" | python -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null || echo "")
    echo "  ❌ IDM-VTON $S: $ERR"
    exit 1
  fi

  printf "  ⏳ %ds... (status: %s)\r" $((i*5)) "$S"
done

echo ""
echo "══════════════════════════════════════════════"
echo "  ✓ Backend funcionando corretamente!"
echo "══════════════════════════════════════════════"
echo ""
echo "Próximo passo: npm run dev"
