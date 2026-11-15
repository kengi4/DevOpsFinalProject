# CloudPulse — DevOps Deployment Health Monitor & Release Board

Індивідуальний підсумковий DevOps-проєкт у межах дисципліни (студент: **Nikita Tregubov**).  
Застосунок автоматично тестується, контейнеризується у Docker, публікується у Docker Hub та розгортається на віртуальну машину **Google Cloud Compute Engine**, інфраструктура для якої автоматично створюється та керується через **Terraform**.

---

## 1. Призначення застосунку

**CloudPulse** — легкий вебсервіс на Node.js + Express із вебінтерфейсом та REST API для моніторингу стану контейнера після релізу й ведення чеклиста перевірок розгортання:

- `GET /` — інтерактивна панель моніторингу (Cloud Target, Version, Environment, Container Host, Uptime, RAM) і Release Verification Checklist.
- `GET /health` — liveness-проба для Docker `HEALTHCHECK` і CI/CD перевірки (повертає `200 OK`, версію та uptime).
- `GET /ready` — readiness-проба зі станом сховища перевірок.
- `GET /api/info` — телеметрія середовища (`appName`, `version`, `environment`, `cloudProvider`, `hostname`, `nodeVersion`, `memory`).
- `GET /api/checks` (`?status=pending|verified`), `POST /api/checks`, `PATCH /api/checks/:id/toggle`, `DELETE /api/checks/:id` — CRUD API для чеклиста перевірок деплою.

---

## 2. Структура проєкту

```text
DevOpsFinalProject/
├── .github/workflows/ci-cd.yml
├── .gitignore
├── .gitattributes
└── students/nikitatregubov/
    ├── .github/workflows/ci-cd.yml
    ├── infra/
    │   ├── versions.tf
    │   ├── variables.tf
    │   ├── main.tf
    │   ├── outputs.tf
    │   └── startup.sh.tftpl
    ├── src/
    │   ├── app.js
    │   ├── server.js
    │   ├── checksStore.js
    │   └── public/
    ├── tests/
    │   └── app.test.js
    ├── Dockerfile
    ├── .dockerignore
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    └── README.md
```

---

## 3. Локальний запуск і перевірка

### Варіант A: Запуск у Docker (рекомендовано перед деплоєм)

Перейдіть у папку проєкту:

```powershell
cd students/nikitatregubov
```

Зберіть оптимізований Docker-образ:

```powershell
docker build -t cloudpulse:local .
```

Запустіть контейнер:

```powershell
docker run -d --name cloudpulse-local -p 3000:3000 cloudpulse:local
```

Перевірте роботу застосунку:

```powershell
curl http://localhost:3000/health
curl http://localhost:3000/api/info
```

Вебінтерфейс буде доступний за адресою: `http://localhost:3000`

Зупинка та видалення локального контейнера:

```powershell
docker stop cloudpulse-local
docker rm cloudpulse-local
```

### Варіант B: Локальний запуск через Node.js (розробка й тести)

Вимога: Node.js `>= 20.0.0` (проєкт протестовано на Node.js 24).

```powershell
cd students/nikitatregubov
npm ci
npm run check
npm test
npm start
```

---

## 4. GitHub Secrets

Налаштуйте у **Settings → Secrets and variables → Actions → New repository secret**:

| Секрет | Опис |
|---|---|
| `DOCKER_USERNAME` | Ім'я користувача Docker Hub |
| `DOCKER_TOKEN` | Access Token Docker Hub з правами Read & Write |
| `GCP_PROJECT_ID` | ID проєкту Google Cloud |
| `GCP_TF_STATE_BUCKET` | Назва GCS-бакета для збереження remote state Terraform |
| `GCP_SA_KEY` | JSON-ключ Service Account Google Cloud |
| `GCE_SSH_KEY_B64` | Приватний SSH-ключ у Base64 для деплою на GCE VM |

---

## 5. Інфраструктура Google Cloud (Terraform)

Для розгортання використовується **Google Cloud Compute Engine** (`students/nikitatregubov/infra/`).

### Що створює Terraform
- `google_compute_network` (`cloudpulse-vpc`) і `google_compute_subnetwork` (`cloudpulse-subnet`, `10.10.0.0/24`) — ізольована VPC-мережа.
- `google_compute_firewall` (`cloudpulse-allow-http`, `cloudpulse-allow-ssh`) — правила вхідного трафіку на порт `80` (HTTP) та `22` (SSH).
- `google_compute_address` (`cloudpulse-ip`) — статична зовнішня IPv4-адреса.
- `google_compute_instance` (`cloudpulse-vm`) — віртуальна машина `e2-micro` (`us-central1-a`, диск 20 GB `pd-standard`, Debian 12) зі `startup.sh.tftpl`, який автоматично встановлює та запускає Docker.
- **Remote State у Google Cloud Storage (`backend "gcs"`)** — гарантує збереження стану між запусками GitHub Actions і запобігає помилкам повторного створення ресурсів.

### Підготовка Google Cloud (одноразово перед першим запуском)
1. Створіть або оберіть проєкт у Google Cloud Console з активним Billing.
2. Увімкніть API:
   - **Compute Engine API** (`compute.googleapis.com`)
   - **Cloud Storage API** (`storage.googleapis.com`)
3. Створіть GCS-бакет для Terraform state (наприклад, `<project-id>-tfstate`).
4. Створіть Service Account (наприклад, `github-deployer`) з ролями:
   - `Compute Admin` (`roles/compute.admin`)
   - `Storage Admin` (`roles/storage.admin`) — або `Storage Object Admin` на бакет стану
   Згенеруйте JSON-ключ та збережіть його вміст у секрет `GCP_SA_KEY` (локально ключ у репозиторій не зберігати).
5. Згенеруйте SSH-ключ для деплою та закодуйте приватний ключ у Base64 для `GCE_SSH_KEY_B64` (PowerShell):
   ```powershell
   ssh-keygen -t ed25519 -C "devops@cloudpulse" -f "$HOME\.ssh\gce_deploy_key"
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\.ssh\gce_deploy_key"))
   ```

### Локальний запуск Terraform

```powershell
cd students/nikitatregubov/infra
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\sa-key.json"
$env:TF_VAR_project_id = "devopsfinalproject-514810"
$env:TF_VAR_ssh_public_key = (Get-Content "$HOME\.ssh\gce_deploy_key.pub" -Raw).Trim()

terraform init -backend-config="bucket=YOUR_TF_STATE_BUCKET" -backend-config="prefix=students/nikitatregubov/terraform.tfstate"
terraform plan
terraform apply
```

Знищення інфраструктури після перевірки:

```powershell
terraform destroy
```

Також інфраструктуру можна знищити через GitHub Actions: **Actions → CloudPulse CI/CD → Run workflow → `action: destroy`**.

---

## 6. Як працює CI/CD пайплайн

Повний цикл автоматизації налаштовано у [`.github/workflows/ci-cd.yml`](../../.github/workflows/ci-cd.yml):

```text
git push -> main
   │
   ▼
[1. test]
   ├─ npm ci, npm run check, npm test (перевірка API і бізнес-логіки)
   ├─ docker build (перевірка збірки Dockerfile без пушу)
   └─ terraform fmt -check && terraform validate
   │
   ▼
[2. build_and_push]
   ├─ Авторизація у Docker Hub (DOCKER_USERNAME / DOCKER_TOKEN)
   └─ Збірка (з GHA-кешем) і пуш образів :sha-<7chars> та :latest
   │
   ▼
[3. terraform]
   ├─ Авторизація у GCP через GCP_SA_KEY
   ├─ terraform init з GCS remote state (GCP_TF_STATE_BUCKET)
   ├─ terraform plan + terraform apply (ідемпотентне створення/оновлення VM та мережі)
   └─ Експорт зовнішньої IP-адреси VM (vm_external_ip)
   │
   ▼
[4. deploy]
   ├─ Декодування SSH-ключа (GCE_SSH_KEY_B64) і очікування готовності SSH + Docker на VM
   ├─ docker pull точного тегу sha-<7chars> на GCE VM
   ├─ Перезапуск контейнера cloudpulse на порту 80:3000 (--restart unless-stopped)
   └─ Перевірка живих ендпоінтів http://<VM_IP>/health та http://<VM_IP>/api/info
```

### Оптимізація Dockerfile
- Використано multi-stage збірку на базі мінімального образу `node:24-alpine`.
- Спершу копіюються лише `package.json` та `package-lock.json` і виконується `npm ci --omit=dev` — це забезпечує ефективне кешування шару залежностей Docker.
- Фінальний образ містить лише production-залежності та папку `src/`, працює під непривілейованим користувачем `USER node`, має вбудований `HEALTHCHECK` та запускає `node src/server.js` напряму для коректної обробки `SIGTERM`.
