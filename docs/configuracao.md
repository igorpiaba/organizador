# Configuração do Organizador (passo a passo)

## Parte 1 — Banco (Supabase)

1. **Criar o projeto**
   - Entre em https://supabase.com/dashboard e clique em **New project**.
   - Nome: `organizador`. Região: **South America (São Paulo)**.
   - Crie uma senha do banco e guarde num lugar seguro. Você não vai precisar dela no dia a dia.
   - Clique em **Create new project** e espere uns 2 minutos até ele terminar de criar.

2. **Criar as tabelas**
   - No menu da esquerda, abra **SQL Editor** e depois **New query**.
   - Abra o arquivo `supabase/schema.sql` deste projeto, copie tudo e cole no editor.
   - Clique em **Run**. Deve aparecer "Success. No rows returned".

3. **Criar o seu usuário**
   - Abra **Authentication**, depois **Users**, depois **Add user** e **Send invitation**.
   - Digite o seu e-mail e envie.
   - Abra o e-mail que chegar e clique em **Accept the invite**. Pode fechar a página que abrir.

4. **Fechar o cadastro para mais ninguém entrar**
   - Abra **Authentication** e depois **Sign In / Providers**.
   - Desligue **Allow new users to sign up** e clique em **Save**.

5. **Endereços permitidos para o link de login**
   - Abra **Authentication** e depois **URL Configuration**.
   - Em **Site URL**, coloque `https://igorpiaba.github.io/organizador/`.
   - Em **Redirect URLs**, adicione as duas linhas abaixo e clique em **Save**:
     - `https://igorpiaba.github.io/organizador/`
     - `http://localhost:8000/`

5b. **Código de login no e-mail (para o app do iPhone)**
   - No iPhone, o app instalado na tela inicial não aproveita o login feito no Safari. Por isso o e-mail precisa trazer um código para digitar no app.
   - Abra **Authentication**, depois **Emails** (ou **Email Templates**), depois **Magic Link**.
   - No fim do texto, acrescente esta linha e clique em **Save**:
     ```
     <p>Ou digite este código no app: <strong>{{ .Token }}</strong></p>
     ```

6. **Carregar as tarefas iniciais**
   - Volte em **SQL Editor** e abra uma **New query**.
   - Cole o conteúdo de `supabase/seed.sql` e clique em **Run**.

7. **Guardar a chave secreta no Mac**
   - Não cole a chave secreta no chat. Ela vai só para o Keychain do Mac.
   - No Supabase, abra **Project Settings**, depois **API Keys**, depois a aba **Legacy API Keys**.
   - Abra o app **Terminal** do Mac (Cmd+Espaço, digite "Terminal" e aperte Enter).
   - Cole este comando e aperte Enter:
     ```
     security add-generic-password -s organizador-supabase -a url -w
     ```
     Ele pede a senha duas vezes. Nas duas, cole o **Project URL**, que fica em Project Settings → Data API e começa com `https://` e termina com `.supabase.co`. Nada aparece na tela enquanto você cola, e é assim mesmo.
   - Depois cole este comando e aperte Enter:
     ```
     security add-generic-password -s organizador-supabase -a service_key -w
     ```
     Nas duas vezes, cole a chave **service_role**. Ela fica escondida: clique em **Reveal** e depois copie.

8. **Mandar para o Claude só o que é público**
   - O **Project URL**.
   - A chave **anon** (aba Legacy API Keys).
   - Essas duas podem ir no chat, porque a anon só funciona com o seu login.

## Parte 2 — Publicação (o Claude faz, você só confirma)

- O repositório `igorpiaba/organizador` é criado no GitHub e o app é publicado em `https://igorpiaba.github.io/organizador/`.
- As chaves vão do Keychain direto para os segredos do GitHub, sem aparecer na tela.
- Os avisos usam um bot próprio, o **@AgendadoPeixe_bot** (token no Keychain, serviço `organizador-telegram`), no grupo **Avisos Piaba**. O @DronhaBot ficou só para o monitor-bets, porque o bot do monitor consome as mensagens dele.
- Chega uma mensagem de teste nesse chat, e você confirma que recebeu.

## Parte 3 — Instalar no iPhone

1. Abra `https://igorpiaba.github.io/organizador/` no **Safari**. Tem que ser o Safari, não o Chrome.
2. Toque no botão **Compartilhar**, o quadrado com uma seta para cima, na barra de baixo.
3. Role e toque em **Adicionar à Tela de Início**, depois em **Adicionar**.
4. Abra o app pelo ícone novo, digite seu e-mail e toque em **Entrar com link**.
5. Abra o e-mail **no próprio iPhone** e toque no link. Você volta para o app já logado.

No Mac é o mesmo endereço no navegador, com o mesmo login por link.
