# Лабораторная работа 3

Тема: разработка серверной части ИС фотоцентра и REST API.
Стек продолжается из работ 1 и 2: Node.js, Express, SQL Server, mssql.

## Запуск

1. Откройте папку проекта в редакторе. SQL Server должен быть запущен.
2. Проверьте `.env`: нужны DB_SERVER, DB_USER и DB_PASSWORD. Учебный скрипт сам выбирает `PhotoCenterLab12`, не изменяя файл конфигурации.
3. Установите зависимости: `npm install`.
4. Запустите: `npm run lab3`.
5. Откройте [Swagger UI](http://127.0.0.1:3001/docs/).

По умолчанию сервер слушает только 127.0.0.1:3001. Для другого порта в PowerShell: `$env:LAB3_PORT='3002'; npm run lab3`.
База `PhotoCenterLab12` уже создана и заполнена в лабораторной №2. На другом компьютере сначала создайте её скриптами `labs/sql/` или командой `node scripts/labs-db.cjs --setup`.

Обычный запуск сайта `npm start` продолжает использовать DB_DATABASE из `.env` и порт 3000 (либо PORT). Для демонстрационных POST-запросов используйте именно `npm run lab3`.

## Выполнение через Swagger

1. Раскройте `POST /api/auth/login`, нажмите **Try it out**, затем **Execute**. Учебные данные: `{"login":"lab_ivanova","password":"demo"}`. Ожидается 200. Сессионная cookie отправляется браузером автоматически; Authorize не нужен.
2. `GET /api/services` → **Try it out → Execute**. Ожидается 200 и три услуги из базы лабораторной №2.
3. `GET /api/services/{id}` с ID 1 → 200; с ID 2147483647 → 404. Если записей с такими ID нет/есть после изменений учебной базы, выберите соответствующий существующий/отсутствующий ID из списка.
4. `POST /api/services` с отрицательной ценой → 422:

```json
{"Название":"Учебная печать A5","Тип":"Печать документов","Цена":-10}
```

5. Исправьте цену на 25 и выполните запрос снова → 201. Сервер вернёт назначенный ID и заголовок Location. Цена — JSON-число, а не строка `"25"`.
6. Проверьте созданную запись через GET по полученному ID.
7. После демонстрации удалите только созданную вами учебную услугу через `DELETE /api/services/{id}` → 204. Услуги, связанные с заказами, удалить нельзя → 409.

Входные поля: Название (непустая строка до 150 символов), Тип (до 50), Цена (от 0.01 до 99999999.99, не более двух знаков после запятой). Попытка передать ID_Услуги или другое лишнее поле возвращает 422. Некорректный JSON возвращает 400, запрос без сессии — 401.

## Что соответствует методичке

| Методичка Python | Реализация фотоцентра |
| --- | --- |
| FastAPI, main.py, uvicorn | Express, server.js, npm run lab3 |
| GET /items и /items/{id} | GET /api/services и /api/services/{id} |
| POST со схемой Pydantic | schemas/service.js и middleware валидации |
| Depends(get_session) | createServicesRouter(repository), createServicesRepository({ getPool, sql }) |
| Session, SQLModel | mssql ConnectionPool и параметризованные запросы |
| Swagger UI /docs | swagger-ui-express /docs/, спецификация /openapi.json |

В Express нет встроенного Depends и автоматической генерации схем по Pydantic. Репозиторий передаётся фабрике маршрутов явно; описание OpenAPI написано в `docs/openapi.js`. Общая схема входных полей импортируется из `schemas/service.js`. Это адаптация лабораторной к согласованному стеку, а не реализация на FastAPI.

## Файлы

- `server.js` — сборка зависимостей, маршруты, Swagger и обработка ошибок.
- `routes/services.js` — GET/POST/PUT/DELETE и проверка ID.
- `repositories/services.js` — SQL-доступ; общий пул передаётся через getPool.
- `schemas/service.js` — входная схема и проверки. ID назначает SQL Server.
- `docs/openapi.js` — описание документируемого API, схем и ответов.
- `scripts/start-lab3.cjs` — учебный запуск на PhotoCenterLab12.
- `scripts/verify-lab3.cjs` — интеграционная проверка API с реальным SQL Server.
- `tests/services.test.cjs` — проверка внедрения зависимости без SQL Server.
- `lab3-verification.json` — фактический протокол 35 HTTP-проверок.
- `lab3-screenshots/` — реальные ответы Swagger: 200, 422, 201, 404.
- `Лабораторная_3.docx` — отчёт с ответами на контрольные вопросы и скриншотами.

## Проверки и защита

`npm test` — 3 теста: хеширование, вход и защита маршрутов, API услуг с подставным репозиторием.

`npm run lab3:check` — 35 HTTP-проверок на отдельной учебной БД. Скрипт создаёт одну временную услугу и удаляет её после проверки, проверяет ответы, Swagger и исходное число услуг. Запуск перезаписывает текстовый протокол, но не сбрасывает БД и не меняет рабочую базу.

На защите покажите Swagger, выполните GET, ошибочный и корректный POST, объясните 201/404/422, параметр @id и передачу репозитория в роутер. Для внесения изменений в Git: `git add .`, `git commit -m "feat: implement lab 3 REST API with validation and Swagger"`, `git push`.

Документация библиотек: [Express middleware](https://expressjs.com/en/guide/using-middleware/), [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express).
