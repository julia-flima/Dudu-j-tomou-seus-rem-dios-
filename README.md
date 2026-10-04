# 🐶 Dudu já tomou seus remédios?

Um app carinhoso de checklist diária de remédios, com tema de shiba inu e ilustrações chibi da **Bubu** — feito para ajudar o Dudu a não esquecer nenhum remédio do dia. 💊💕

<p align="center">
  <img src="icon-512.png" width="160" alt="Ícone do app: chibi da Bubu">
</p>

## ✨ O que ele faz

- ✅ **Checklist diária** com os remédios: Mesacol MMX, Duspatalin, Revoc e Doss
- ➕ Campo para **adicionar outros remédios**
- ✏️ **Editar a lista permanente**: no modo *Editar lista* dá pra tirar qualquer remédio (com confirmação). Remédios tirados vão para **Remédios guardados**, com o histórico preservado, e podem voltar pra lista quando quiser
- ⏰ **Horário de cada remédio tomado** aparece abaixo do nome (com 🌙 quando foi marcado de madrugada)
- ↕️ **Reordenar os remédios**: segure um item e arraste (ou use o ⠿ no modo de edição; no teclado, Alt+↑/↓)
- 💾 **Backup**: salve um arquivo `.json` com todos os dados e restaure depois — útil se você limpa os dados do navegador
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

## 🤖 Aplicativo Android (APK)

Além da PWA, o app também existe como **aplicativo Android de verdade**, feito com [Tauri 2](https://v2.tauri.app/) usando o mesmo `index.html`. No aplicativo, os dados ficam guardados no próprio app — **limpar os dados do navegador não apaga nada**. (Só desinstalar o app apaga; faça um backup antes.)

### Baixar o APK

- **Última versão de teste**: aba **Actions** → workflow **APK Android** → abra a execução mais recente → baixe o artefato `remedios-do-dudu-apk` (vem em `.zip`, o APK está dentro).
- **Versões oficiais**: página de **Releases**. Para publicar uma nova: aba **Actions** → **APK Android** → **Run workflow**, preencha a versão (ex.: `v1.1.0`) e rode — ou crie uma tag `v*` no git. Lembre de subir o `version` em `src-tauri/tauri.conf.json` antes.

No celular, abra o `.apk` e permita "instalar apps desta fonte" quando o Android pedir.

### Passar os dados da PWA para o app

1. Na PWA (Firefox/Chrome): **💾 Backup → ⬇️ Salvar backup**
2. No aplicativo: **💾 Backup → ⬆️ Restaurar** e escolha o arquivo salvo

### 🔑 Chave de assinatura (faça uma vez só!)

O Android só deixa **atualizar** um app instalado se a nova versão for assinada com a **mesma chave**. Sem uma chave fixa, cada build usa uma chave temporária e, pra atualizar, seria preciso desinstalar (perdendo os dados). Para criar a chave fixa:

```bash
keytool -genkeypair -v -keystore remedios.jks -storetype PKCS12 \
  -alias remedios -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 remedios.jks   # no macOS: base64 -i remedios.jks
```

Depois, no GitHub: **Settings → Secrets and variables → Actions → New repository secret**, e crie:

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o texto gerado pelo `base64` |
| `ANDROID_KEYSTORE_PASSWORD` | a senha escolhida no `keytool` |
| `ANDROID_KEY_ALIAS` | `remedios` |

Guarde o `remedios.jks` e a senha em lugar seguro (e **não** suba o arquivo pro repositório).

### Rodar/compilar no computador

Precisa de [Node.js](https://nodejs.org), [Rust](https://rustup.rs) e, para Android, Android Studio com SDK + NDK ([guia do Tauri](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev                  # abre o app no computador
npm run tauri android init         # só na primeira vez
npm run tauri android build -- --apk
```

## 📂 Estrutura do projeto

| Arquivo | Função |
|---|---|
| `index.html` | O app inteiro (interface, lógica e ilustrações embutidas) |
| `manifest.json` | Configuração da PWA (nome, cores, ícones) |
| `sw.js` | Service worker — deixa o app funcionar offline |
| `icon-192.png` / `icon-512.png` | Ícones da Bubu para a tela inicial |
| `src-tauri/` | Projeto Tauri 2 (aplicativo Android/desktop) |
| `scripts/copiar-web.mjs` | Copia o web app para `dist/`, que o Tauri empacota |
| `.github/workflows/android.yml` | Gera o APK no GitHub Actions |

## 🔧 Como personalizar

- **Remédios padrão** (usados só na primeira vez que o app abre): edite a lista `MEDS_PADRAO` no início do `<script>` em `index.html`. Depois disso, a lista é editada pelo próprio app
- **Mensagens**: procure os textos em `humor.textContent` e no balão `.fala`
- Depois de editar, é só reenviar o arquivo pro repositório — o app instalado se atualiza sozinho na próxima abertura com internet (o histórico não se perde!)

---

Feito com amor pela Bubu 🐾
