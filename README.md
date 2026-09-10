# 🐶 Dudu já tomou seus remédios?

Um app carinhoso de checklist diária de remédios, com tema de shiba inu e ilustrações chibi da **Bubu** — feito para ajudar o Dudu a não esquecer nenhum remédio do dia. 💊💕

<p align="center">
  <img src="icon-512.png" width="160" alt="Ícone do app: chibi da Bubu">
</p>

## ✨ O que ele faz

- ✅ **Checklist diária** com os remédios: Mesacol MMX, Duspatalin, Revoc e Doss
- ➕ Campo para **adicionar outros remédios** (e remover os extras)
- 🎭 **A Bubu e o shiba reagem ao progresso**:
  - Nenhum tomado → Bubu triste e shiba desanimado esperando
  - Parte tomada → Bubu neutra ou feliz, shiba atento ou rindo
  - **Todos tomados** → Bubu comemorando com o shiba pulando e a mensagem *"Parabéns, Dudu! Bubu te ama muito!"* 🎉
- 📊 Barra de progresso do dia
- 🗓️ **Histórico visual dos últimos 7 dias**, com carinha e placar (ex.: 4/4) de cada dia
- 📴 Funciona **offline** depois de instalado (PWA)
- 💾 O progresso fica salvo no próprio celular — cada dia tem sua checklist

## 📱 Como instalar no celular

1. Abra o link do app no **Chrome**: `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
2. Toque no menu **⋮** → **"Adicionar à tela inicial"** (ou **"Instalar app"**)
3. Pronto! O ícone da Bubu aparece na tela inicial e o app abre em tela cheia, como um aplicativo normal.

No iPhone: abra no **Safari** → botão de compartilhar → **"Adicionar à Tela de Início"**.

## 📂 Estrutura do projeto

| Arquivo | Função |
|---|---|
| `index.html` | O app inteiro (interface, lógica e ilustrações embutidas) |
| `manifest.json` | Configuração da PWA (nome, cores, ícones) |
| `sw.js` | Service worker — deixa o app funcionar offline |
| `icon-192.png` / `icon-512.png` | Ícones da Bubu para a tela inicial |

## 🔧 Como personalizar

- **Remédios padrão**: edite a lista `MEDS_PADRAO` no início do `<script>` em `index.html`
- **Mensagens**: procure os textos em `humor.textContent` e no balão `.fala`
- Depois de editar, é só reenviar o arquivo pro repositório — o app instalado se atualiza sozinho na próxima abertura com internet (o histórico não se perde!)

---

Feito com amor pela Bubu 🐾
