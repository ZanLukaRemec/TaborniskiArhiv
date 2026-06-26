# Taborniški arhiv

Spletna aplikacija za arhiviranje taborniških poročil in osnovno administracijo sistema.

Projekt je razdeljen na dva dela:

- `frontend` - React aplikacija z Vite
- `backend` - Express API z MySQL povezavo

## Zagon v razvoju

Backend:

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Privzeti razvojni naslovi:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

## Lokalna baza

Razvojna baza naj teče lokalno in ni del repozitorija. SQL dumpi so ignorirani z `*.sql`.

Primer zagona MariaDB z Dockerjem:

```bash
docker run --name taborniski-arhiv-db -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 3306:3306 -d mariadb:10.3
```

Nato v containerju ustvari bazo `SISIII2026_89231391` in uvozi SQL dump iz lokalnega računalnika.

## Veje

Razvoj poteka na veji `develop`. Stabilne, preverjene različice se združujejo v `main`.
