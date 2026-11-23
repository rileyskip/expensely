# Expensely

Expensely is a personal expense tracker. Accounts and expenses are stored in Neon Postgres for the signed-in user.

## Run

```bash
npm install
npm start
```

The dev server uses port 3000 unless that port is taken. To use another port:

```bash
PORT=3010 npm start
```

`npm run build` writes the site to `dist`. `npm run preview` serves that build with the same account API.

The first visit asks you to create the admin account. After that, open Access and add anyone else who should be able to sign in. A blocked or removed account cannot log in. The same accounts work from any browser that can reach this server, because they are stored in the linked Neon database (`.env.local`, from `neon deploy`).

## Where data lives

Usernames, password hashes, expenses, paycheck settings, recorded balances, transfers, and description choices live in Neon Postgres for that user. The browser keeps only an HttpOnly session cookie. A copy still sitting in local storage is uploaded once for that account, then removed. Signing in on another browser shows the same ledger.

## Expenses

- Add, edit, and delete expenses. Edit and Delete are in the row menu. Add New Expense can add an expense, a paycheck, or a transfer in.
- Descriptions are color coded in the table and on the Insights chart. Built-in categories have set colors. A custom description gets a stable color from its name.
- Each row shows the estimated remaining balance after that transaction, in recorded order. A recorded balance sets the amount. Later paychecks and transfers in add to it. Later spending and transfers out subtract.
- Filter the table by month and by description.
- Spending by category and suggestions are on the Insights tab, so the expense table stays on its own view.
- Pick a description from the list, type one under Other, or add a choice that stays on this account. Remove choice takes a saved choice off those lists. Expenses already saved keep their description.
- The first paycheck sets the amount, how often it arrives, and the starting date. Later paychecks use that schedule. Weekly, every 2 weeks, and every 30 days are built in.
- Mark a row as Transferred in when that amount came into the account. Count as spending puts it back with the other payments. A transfer in adds to the estimated balance and stays separate from the paycheck schedule.
- Mark a payment as recurring. The next calendar month shows an Upcoming row on that same day, together with every paycheck in that month. Those rows are left out of spending totals.
- Record an account balance on a date. Suggestions start from that amount, then add later paychecks and transfers in, and subtract later spending.

Suggestions compare category spending, the paycheck schedule, upcoming bills, and the estimated remaining balance.
