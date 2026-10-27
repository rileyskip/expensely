# Expensely

Expensely is a personal expense tracker. It runs in the browser and keeps each account on that browser.

## Run

```bash
npm install
npm start
```

The dev server uses port 3000 unless that port is taken. To use another port:

```bash
PORT=3010 npm start
```

Open the address the server prints and register a username.

## Where data lives

Accounts, passwords, expenses, paycheck settings, description choices, and recorded balances stay in the browser for that exact address. Restarting the dev server does not remove them. The app never sends logins or expenses anywhere.

A new computer, a fresh clone, another browser, or another port starts empty. Two tabs in the same browser at the same address share one set of accounts. The login form submits the username and password that are in the fields, including a login the browser has saved for that address.

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
