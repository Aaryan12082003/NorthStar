# Northstar

Northstar is a team task workspace. People sign in, see the work that is theirs, and move it from to-do through review. Managers assign tasks, approve submissions, and read a report that weighs on-time delivery, volume, and overdue work together.

The interface is a light dashboard: white sidebar, blue accents, and the same shell on every screen.

## Run it locally

You need Node.js 22, PostgreSQL 16, and Redis.

```bash
createdb northstar   # or use the role in server/.env.example
cp server/.env.example server/.env
cd server && npm install && npx prisma db migrate --yes && npm run seed
cd ../client && npm install --legacy-peer-deps
```

In two terminals:

```bash
cd server && npm run dev    # API on http://127.0.0.1:4732
cd client && npm run dev    # app on http://127.0.0.1:4731
```

Open [http://127.0.0.1:4731](http://127.0.0.1:4731).

Every demo account uses the password `Northstar123!`.

| Email | Role |
| --- | --- |
| ananya@northstar.dev | Admin |
| rahul@northstar.dev | Manager |
| priya@northstar.dev | Employee |
| amit@northstar.dev | Employee |
| kavya@northstar.dev | Manager |
| dev@northstar.dev | Employee |
| meera@northstar.dev | Employee |

Deadlines and reminder days use each person's time zone. The seeded team is on Asia/Kolkata.

## What works

- Sign in and sign out, with a session cookie
- Dashboard counts, charts, upcoming tasks, and activity from the database
- Task list, filters, pagination, and a drag-and-drop board
- Calendar by deadline
- Task detail with checklist, comments, file uploads, and review
- Projects with progress taken from completed tasks
- Team profiles and admin invites
- Notification center, including deadline reminders from a background job
- Reports with a date range and CSV or Excel export
- Live updates over Socket.IO when tasks change

Employees only see tasks assigned to them. They can start work and submit it for review. Managers and admins assign work and approve or return it. Admins also manage membership and the workspace name.

Overdue is calculated from the deadline. It is not a status in the workflow.

If Redis is running, reminders are scheduled with BullMQ every minute. If Redis is down, the same scan still runs in-process so reminders are not lost.

## Docker

```bash
docker compose up --build
```

The app is then served at [http://localhost:4732](http://localhost:4732). The first boot applies migrations and seeds the demo workspace.

## Tests

```bash
cd server && npm test
```
